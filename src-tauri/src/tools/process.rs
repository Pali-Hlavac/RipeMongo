//! Starting a tool as a child process the app fully controls.

use std::path::Path;
use std::process::Stdio;

use tokio::process::Command;

/// Windows `CREATE_NO_WINDOW`: the tools are console programs and would otherwise open a
/// console window next to the (windowed) app.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// A command for `program` with no stdin, captured output, no console window, and that is
/// killed if the app drops it (for example when a job is cancelled or the app exits).
pub fn tool_command(program: &Path) -> Command {
    let mut command = Command::new(program);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}
