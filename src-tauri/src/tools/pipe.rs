//! Runs two tools as one job, the first one's standard output piped into the second one's
//! standard input (copies: `mongodump --archive | mongorestore --archive`). Nothing touches
//! the disk. Both outputs go into the job log, each line prefixed with its tool.

use std::process::ExitStatus;

use tokio::sync::mpsc;

use super::run::{forward_lines, spawn, strip_timestamp, Invocation, FAILED_PREFIX, LINE_BUFFER};
use super::{Tool, ToolsError};
use crate::error::{AppError, ErrorCode};
use crate::jobs::{JobContext, JobProgress};

/// Turns the output of both tools into progress.
pub trait PipeOutputParser: Send {
    fn line(&mut self, tool: Tool, line: &str) -> Option<JobProgress>;
}

/// What one side of the pipe did.
#[derive(Default)]
struct Outcome {
    status: Option<ExitStatus>,
    /// The tool's own reason (`Failed: …`).
    failure: Option<String>,
    /// Some failures (such as "error connecting to host") come without `Failed:`.
    last_line: Option<String>,
}

/// Runs `source | sink` to completion, or until the job is cancelled. Their `input` is
/// ignored. When both fail, the one that stopped first is blamed: the other one only lost
/// its pipe.
pub async fn run_pipe(
    ctx: &JobContext,
    source: Invocation,
    sink: Invocation,
    parser: &mut dyn PipeOutputParser,
) -> Result<(), AppError> {
    let tools = [source.tool, sink.tool];
    let mut first = spawn(source.tool, &source.credentials, &source.args, false)?;
    // If this fails, dropping `first` kills it.
    let mut second = spawn(sink.tool, &sink.credentials, &sink.args, true)?;
    let (Some(mut output), Some(mut input)) = (first.stdout.take(), second.stdin.take()) else {
        return Err(AppError::new(
            ErrorCode::Internal,
            "The tools started without a pipe between them.",
        ));
    };
    // Ends at the end of the data (closing the second tool's input) or when the second tool
    // stops reading (closing the first tool's output).
    let pump = tokio::spawn(async move { tokio::io::copy(&mut output, &mut input).await });

    let (sender, mut lines) = mpsc::channel(LINE_BUFFER);
    if let Some(stderr) = first.stderr.take() {
        tokio::spawn(forward_lines(stderr, 0, sender.clone()));
    }
    if let Some(stdout) = second.stdout.take() {
        tokio::spawn(forward_lines(stdout, 1, sender.clone()));
    }
    if let Some(stderr) = second.stderr.take() {
        tokio::spawn(forward_lines(stderr, 1, sender));
    }

    let mut outcomes = [Outcome::default(), Outcome::default()];
    let mut failed_first = None;
    let mut lines_open = true;
    while lines_open || outcomes.iter().any(|outcome| outcome.status.is_none()) {
        tokio::select! {
            line = lines.recv(), if lines_open => {
                let Some((side, line)) = line else {
                    lines_open = false;
                    continue;
                };
                let tool: Tool = tools[side];
                let line = sink.credentials.redact(&source.credentials.redact(&line));
                ctx.log(&format!("{tool}: {line}"));
                let message = strip_timestamp(&line);
                let outcome = &mut outcomes[side];
                if let Some(reason) = message.strip_prefix(FAILED_PREFIX) {
                    outcome.failure.get_or_insert_with(|| reason.to_owned());
                }
                outcome.last_line = Some(message.to_owned());
                if let Some(progress) = parser.line(tool, message) {
                    ctx.progress(progress);
                }
            }
            status = first.wait(), if outcomes[0].status.is_none() => {
                let status = status.map_err(|source| ToolsError::Start { tool: tools[0], source })?;
                if !status.success() {
                    failed_first.get_or_insert(0);
                }
                outcomes[0].status = Some(status);
            }
            status = second.wait(), if outcomes[1].status.is_none() => {
                let status = status.map_err(|source| ToolsError::Start { tool: tools[1], source })?;
                if !status.success() {
                    failed_first.get_or_insert(1);
                }
                outcomes[1].status = Some(status);
            }
            () = ctx.cancellation().cancelled() => {
                for (child, tool) in [(&mut first, tools[0]), (&mut second, tools[1])] {
                    if let Err(error) = child.kill().await {
                        tracing::warn!(%error, %tool, "failed to kill cancelled tool");
                    }
                }
                pump.abort();
                return Err(AppError::new(ErrorCode::OperationFailed, "The copy was cancelled."));
            }
        }
    }
    drop((source, sink));
    let pumped = pump
        .await
        .map_err(|error| AppError::new(ErrorCode::Internal, error.to_string()))?;

    if let Some(side) = failed_first {
        let tool = tools[side];
        let Outcome {
            status,
            failure,
            last_line,
        } = std::mem::take(&mut outcomes[side]);
        let reason = failure.or(last_line).unwrap_or_else(|| match status {
            Some(status) => format!("it exited with {status}"),
            None => "it stopped".to_owned(),
        });
        return Err(AppError::new(
            ErrorCode::OperationFailed,
            format!("{tool} failed: {reason}"),
        )
        .with_hint("The job log has the full output of both tools."));
    }
    pumped.map(drop).map_err(|error| {
        AppError::new(
            ErrorCode::Io,
            format!(
                "Could not pass the data from {} to {}: {error}",
                tools[0], tools[1]
            ),
        )
    })
}
