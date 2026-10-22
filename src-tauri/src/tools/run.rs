//! Runs a tool as part of a job: streams its output into the job log, turns output lines
//! into progress, kills it on cancel and turns a failure into a readable error.

use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::sync::mpsc;

use super::{locate, tool_command, CredentialsFile, Tool, ToolsError};
use crate::error::{AppError, ErrorCode};
use crate::jobs::{JobContext, JobProgress};

/// Output lines buffered between the readers and the job.
const LINE_BUFFER: usize = 256;
/// Prefix the tools put before the reason of a fatal error.
const FAILED_PREFIX: &str = "Failed: ";

/// Turns tool output into progress. Lines arrive without the tools' timestamp prefix.
pub trait OutputParser: Send {
    fn line(&mut self, line: &str) -> Option<JobProgress>;
}

/// One run of a tool.
pub struct Invocation {
    pub tool: Tool,
    /// Arguments other than the credentials file.
    pub args: Vec<String>,
    /// Kept alive (and deleted afterwards) for the duration of the run.
    pub credentials: CredentialsFile,
}

/// Runs the tool to completion, or until the job is cancelled.
pub async fn run_tool(
    ctx: &JobContext,
    invocation: Invocation,
    parser: &mut dyn OutputParser,
) -> Result<(), AppError> {
    let Invocation {
        tool,
        args,
        credentials,
    } = invocation;
    let path = locate(tool)?;
    let mut child = tool_command(&path)
        .arg(credentials.arg())
        .args(&args)
        .spawn()
        .map_err(|source| ToolsError::Start { tool, source })?;

    let (sender, mut lines) = mpsc::channel(LINE_BUFFER);
    if let Some(stdout) = child.stdout.take() {
        tokio::spawn(forward_lines(stdout, sender.clone()));
    }
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(forward_lines(stderr, sender));
    }

    let mut failure = None;
    loop {
        tokio::select! {
            line = lines.recv() => {
                let Some(line) = line else { break };
                ctx.log(&line);
                let message = strip_timestamp(&line);
                if let Some(reason) = message.strip_prefix(FAILED_PREFIX) {
                    failure = Some(reason.to_owned());
                }
                if let Some(progress) = parser.line(message) {
                    ctx.progress(progress);
                }
            }
            () = ctx.cancellation().cancelled() => {
                if let Err(error) = child.kill().await {
                    tracing::warn!(%error, %tool, "failed to kill cancelled tool");
                }
                return Err(AppError::new(ErrorCode::OperationFailed, format!("{tool} was cancelled.")));
            }
        }
    }

    let status = child
        .wait()
        .await
        .map_err(|source| ToolsError::Start { tool, source })?;
    drop(credentials);
    if status.success() {
        return Ok(());
    }
    let reason = failure.unwrap_or_else(|| format!("it exited with {status}"));
    Err(AppError::new(
        ErrorCode::OperationFailed,
        format!("{tool} failed: {reason}"),
    )
    .with_hint("The job log has the tool's full output."))
}

async fn forward_lines(stream: impl AsyncRead + Unpin, sender: mpsc::Sender<String>) {
    let mut lines = BufReader::new(stream).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if sender.send(line).await.is_err() {
            break;
        }
    }
}

/// `2026-10-22T21:00:00.000+0200<TAB>message` → `message`.
pub fn strip_timestamp(line: &str) -> &str {
    match line.split_once('\t') {
        Some((stamp, message))
            if stamp.len() >= "2026-10-22T21:00:00".len()
                && stamp.starts_with(|c: char| c.is_ascii_digit())
                && stamp.contains('T') =>
        {
            message
        }
        _ => line,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_the_tools_timestamp_prefix_only() {
        assert_eq!(
            strip_timestamp("2026-10-22T21:00:00.000+0200\twriting shop.items to dump"),
            "writing shop.items to dump"
        );
        assert_eq!(strip_timestamp("no timestamp\there"), "no timestamp\there");
        assert_eq!(strip_timestamp("plain"), "plain");
    }
}
