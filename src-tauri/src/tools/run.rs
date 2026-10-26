//! Runs a tool as part of a job: feeds its standard input if asked, streams its output
//! (without secrets) into the job log, turns output lines into progress, kills it on cancel and turns a failure into
//! a readable error.

use std::io::Write;
use std::process::Stdio;

use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::Child;
use tokio::sync::mpsc;
use tokio_util::io::SyncIoBridge;

use super::{locate, tool_command, CredentialsFile, Tool, ToolsError};
use crate::error::{AppError, ErrorCode};
use crate::jobs::{JobContext, JobProgress};

/// Output lines buffered between the readers and the job.
pub(super) const LINE_BUFFER: usize = 256;
/// Prefix the tools put before the reason of a fatal error.
pub(super) const FAILED_PREFIX: &str = "Failed: ";

/// Turns tool output into progress. Lines arrive without the tools' timestamp prefix.
pub trait OutputParser: Send {
    fn line(&mut self, line: &str) -> Option<JobProgress>;
}

/// Writes a tool's standard input on a blocking thread; errors are messages for the user.
pub type Input = Box<dyn FnOnce(&mut dyn Write) -> Result<(), String> + Send>;

/// One run of a tool.
pub struct Invocation {
    pub tool: Tool,
    /// Arguments other than the credentials file.
    pub args: Vec<String>,
    /// Kept alive (and deleted afterwards) for the duration of the run.
    pub credentials: CredentialsFile,
    /// Data for the tool's standard input; `None` leaves it empty.
    pub input: Option<Input>,
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
        input,
    } = invocation;
    let mut child = spawn(tool, &credentials, &args, input.is_some())?;
    // Closing the pipe (when the input is written or fails) tells the tool the data ended.
    let feeder = match (input, child.stdin.take()) {
        (Some(input), Some(stdin)) => {
            let mut pipe = SyncIoBridge::new(stdin);
            Some(tokio::task::spawn_blocking(move || input(&mut pipe)))
        }
        _ => None,
    };

    let (sender, mut lines) = mpsc::channel(LINE_BUFFER);
    if let Some(stdout) = child.stdout.take() {
        tokio::spawn(forward_lines(stdout, (), sender.clone()));
    }
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(forward_lines(stderr, (), sender));
    }

    let mut failure = None;
    loop {
        tokio::select! {
            line = lines.recv() => {
                let Some(((), line)) = line else { break };
                let line = credentials.redact(&line);
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
    let fed = match feeder {
        Some(feeder) => feeder
            .await
            .map_err(|error| AppError::new(ErrorCode::Internal, error.to_string()))?,
        None => Ok(()),
    };
    if status.success() {
        return fed.map_err(|message| AppError::new(ErrorCode::Io, message));
    }
    let reason = failure.unwrap_or_else(|| format!("it exited with {status}"));
    Err(AppError::new(
        ErrorCode::OperationFailed,
        format!("{tool} failed: {reason}"),
    )
    .with_hint("The job log has the tool's full output."))
}

/// Starts `tool` with the credentials file and `args`; `stdin` gives it a piped standard
/// input instead of an empty one.
pub(super) fn spawn(
    tool: Tool,
    credentials: &CredentialsFile,
    args: &[String],
    stdin: bool,
) -> Result<Child, AppError> {
    let path = locate(tool)?;
    let mut command = tool_command(&path);
    command.arg(credentials.arg()).args(args);
    if stdin {
        command.stdin(Stdio::piped());
    }
    Ok(command
        .spawn()
        .map_err(|source| ToolsError::Start { tool, source })?)
}

/// Sends each line of `stream`, tagged with where it comes from.
pub(super) async fn forward_lines<T: Copy>(
    stream: impl AsyncRead + Unpin,
    tag: T,
    sender: mpsc::Sender<(T, String)>,
) {
    let mut lines = BufReader::new(stream).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if sender.send((tag, line)).await.is_err() {
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
