//! Dump jobs: run `mongodump` for a server, database or collection, with live progress.

mod args;
mod progress;
mod request;
#[cfg(test)]
mod tests;

pub use args::MAX_PARALLEL_COLLECTIONS;
pub use progress::DumpProgress;
pub use request::{DumpOutput, DumpRequest};

use std::time::Duration;

use mongodb::bson::Document;
use mongodb::Client;

use super::run::{run_tool, Invocation};
use super::{display_command, CredentialsFile, Tool, ToolsError};
use crate::collections::{list_collections, CollectionKind};
use crate::connections::ToolConnection;
use crate::databases::list_databases;
use crate::jobs::{JobInfo, JobKind, JobRegistry, JobSpec};

/// Databases `mongodump` skips when dumping a whole server.
const SKIPPED_DATABASES: [&str; 2] = ["local", "config"];
/// Longest the server may spend counting the documents that match a query filter.
const COUNT_TIME_LIMIT: Duration = Duration::from_secs(10);

/// Starts a dump job. `connection` stays alive (with its tunnel) until the dump ends. `name`
/// (of a saved dump) is added to the job title.
pub fn start_dump(
    jobs: &JobRegistry,
    connection_id: String,
    connection: ToolConnection,
    request: DumpRequest,
    name: Option<&str>,
) -> Result<JobInfo, ToolsError> {
    let args = request.args()?;
    let query = request.query_filter()?;
    let credentials = CredentialsFile::new(&connection).map_err(ToolsError::Credentials)?;
    let title = match name {
        Some(name) => format!("{} ({name})", request.title()),
        None => request.title(),
    };
    let spec = JobSpec {
        kind: JobKind::Dump,
        title,
        connection_id,
        command: Some(display_command(
            Tool::Mongodump,
            connection.display_uri(),
            &args,
        )),
    };
    Ok(jobs.start(spec, move |ctx| async move {
        let total = estimate_documents(connection.client(), &request, query).await;
        let mut progress = DumpProgress::new(total);
        let invocation = Invocation {
            tool: Tool::Mongodump,
            args,
            credentials,
            input: None,
        };
        run_tool(&ctx, invocation, &mut progress).await?;
        Ok(progress.summary(request.output.path()))
    }))
}

/// Estimated number of documents a dump will write (metadata counts, or a time-limited count
/// with a query filter). `None` when it cannot be determined, for example without the
/// privileges to list databases.
pub(crate) async fn estimate_documents(
    client: &Client,
    request: &DumpRequest,
    query: Option<Document>,
) -> Option<f64> {
    let databases = match &request.database {
        Some(database) => vec![database.clone()],
        None => list_databases(client)
            .await
            .ok()?
            .into_iter()
            .map(|database| database.name)
            .filter(|name| !SKIPPED_DATABASES.contains(&name.as_str()))
            .collect(),
    };
    let mut total = 0.0;
    for name in databases {
        let database = client.database(&name);
        let collections = match &request.collection {
            Some(collection) => vec![collection.clone()],
            None => list_collections(&database)
                .await
                .ok()?
                .into_iter()
                .filter(|info| info.kind != CollectionKind::View && !request.leaves_out(&info.name))
                .map(|info| info.name)
                .collect(),
        };
        for collection in collections {
            let collection = database.collection::<Document>(&collection);
            let count = match &query {
                Some(filter) => collection
                    .count_documents(filter.clone())
                    .max_time(COUNT_TIME_LIMIT)
                    .await
                    .ok()?,
                None => collection.estimated_document_count().await.ok()?,
            };
            // Counts fit an f64 exactly far beyond any real collection size.
            #[allow(clippy::cast_precision_loss)]
            {
                total += count as f64;
            }
        }
    }
    Some(total)
}
