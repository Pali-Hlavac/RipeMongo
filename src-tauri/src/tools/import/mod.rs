//! Import jobs: run `mongoimport` with a JSON file, or with a delimited text file that
//! RipeMongo reads and passes on as CSV with typed columns.

mod columns;
mod feed;
mod preview;
mod progress;
mod request;
#[cfg(test)]
mod tests;
mod types;

pub use columns::{suggest_type, ColumnType, TypeSuggestion};
pub use preview::{inspect_import_file, ImportPreview, PreviewColumn};
pub use progress::ImportProgress;
pub use request::ImportRequest;
pub use types::{ImportColumn, ImportFormat, ImportMode, ParseErrors};

use std::path::PathBuf;
use std::sync::atomic::AtomicU64;
use std::sync::Arc;

use feed::CsvFeed;

use super::run::{run_tool, Input, Invocation};
use super::{display_command, CredentialsFile, Tool, ToolsError};
use crate::connections::ToolConnection;
use crate::jobs::{JobInfo, JobKind, JobRegistry, JobSpec};

/// Starts an import job. `connection` stays alive (with its tunnel) until the import ends.
pub fn start_import(
    jobs: &JobRegistry,
    connection_id: String,
    connection: ToolConnection,
    request: ImportRequest,
) -> Result<JobInfo, ToolsError> {
    let args = request.args()?;
    let path = PathBuf::from(request.path.trim());
    let metadata = std::fs::metadata(&path).map_err(|error| {
        ToolsError::Invalid(format!("Could not read {}: {error}", path.display()))
    })?;
    // File sizes fit an f64 exactly far beyond any real file.
    #[allow(clippy::cast_precision_loss)]
    let size = metadata.len() as f64;
    let csv = (request.format == ImportFormat::Csv)
        .then(|| request.delimiter_byte())
        .transpose()?
        .map(|delimiter| CsvFeed {
            path: path.clone(),
            delimiter,
            header: request.header,
            columns: request.included_columns(),
            read: Arc::new(AtomicU64::new(0)),
        });
    let credentials = CredentialsFile::new(connection.uri()).map_err(ToolsError::Credentials)?;
    let mut command = display_command(Tool::Mongoimport, connection.display_uri(), &args);
    if csv.is_some() {
        command.push_str(" < (the file's rows as CSV, see the log)");
    }
    let spec = JobSpec {
        kind: JobKind::Import,
        title: request.title(),
        connection_id,
        command: Some(command),
    };
    let namespace = format!("{}.{}", request.database.trim(), request.collection.trim());
    let note = csv.as_ref().map(|feed| feed_note(&request, feed));
    Ok(jobs.start(spec, move |ctx| async move {
        // Keeps the connection (and its SSH tunnel) open for the tool.
        let _connection = connection;
        let fed = csv.as_ref().map(|feed| Arc::clone(&feed.read));
        let mut progress = ImportProgress::new(size, fed);
        if let Some(note) = note {
            ctx.log(&note);
        }
        let input = csv.map(|feed| -> Input { Box::new(move |out| feed.run(out)) });
        let invocation = Invocation {
            tool: Tool::Mongoimport,
            args,
            credentials,
            input,
        };
        run_tool(&ctx, invocation, &mut progress).await?;
        Ok(progress.summary(&namespace))
    }))
}

/// First log line of a CSV import: what RipeMongo does with the file before mongoimport.
fn feed_note(request: &ImportRequest, feed: &CsvFeed) -> String {
    let delimiter = match feed.delimiter {
        b'\t' => "tab".to_owned(),
        byte => format!("“{}”", char::from(byte)),
    };
    let header = if feed.header {
        ", without the header line"
    } else {
        ""
    };
    format!(
        "RipeMongo reads {} (values separated by {delimiter}{header}, {} of {} columns) and \
         passes the rows to mongoimport as CSV.",
        feed.path.display(),
        feed.columns.len(),
        request.columns.len()
    )
}
