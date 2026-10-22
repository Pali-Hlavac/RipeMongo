//! Dump jobs: run `mongodump` for a server, database or collection, with live progress.

mod progress;
mod request;

pub use progress::DumpProgress;
pub use request::{DumpOutput, DumpRequest};

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

/// Starts a dump job. `connection` stays alive (with its tunnel) until the dump ends.
pub fn start_dump(
    jobs: &JobRegistry,
    connection_id: String,
    connection: ToolConnection,
    request: DumpRequest,
) -> Result<JobInfo, ToolsError> {
    let args = request.args()?;
    let credentials = CredentialsFile::new(connection.uri()).map_err(ToolsError::Credentials)?;
    let spec = JobSpec {
        kind: JobKind::Dump,
        title: request.title(),
        connection_id,
        command: Some(display_command(
            Tool::Mongodump,
            connection.display_uri(),
            &args,
        )),
    };
    Ok(jobs.start(spec, move |ctx| async move {
        let total = estimate_documents(
            connection.client(),
            request.database.as_deref(),
            request.collection.as_deref(),
        )
        .await;
        let mut progress = DumpProgress::new(total);
        let invocation = Invocation {
            tool: Tool::Mongodump,
            args,
            credentials,
        };
        run_tool(&ctx, invocation, &mut progress).await?;
        Ok(progress.summary(request.output.path()))
    }))
}

/// Estimated number of documents a dump will write (metadata counts, not exact). `None`
/// when it cannot be determined, for example without the privileges to list databases.
async fn estimate_documents(
    client: &Client,
    database: Option<&str>,
    collection: Option<&str>,
) -> Option<f64> {
    let databases = match database {
        Some(database) => vec![database.to_owned()],
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
        let collections = match collection {
            Some(collection) => vec![collection.to_owned()],
            None => list_collections(&database)
                .await
                .ok()?
                .into_iter()
                .filter(|info| info.kind != CollectionKind::View)
                .map(|info| info.name)
                .collect(),
        };
        for collection in collections {
            let count = database
                .collection::<Document>(&collection)
                .estimated_document_count()
                .await
                .ok()?;
            // Counts fit an f64 exactly far beyond any real collection size.
            #[allow(clippy::cast_precision_loss)]
            {
                total += count as f64;
            }
        }
    }
    Some(total)
}
