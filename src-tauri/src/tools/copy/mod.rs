//! Copy jobs: `mongodump --archive` piped into `mongorestore --archive`, from one connection
//! into another (or the same one under another name). Indexes, options and views come along.

mod progress;
mod request;
#[cfg(test)]
mod tests;

pub use progress::CopyProgress;
pub use request::CopyRequest;

use std::collections::HashMap;
use std::time::Duration;

use futures_util::TryStreamExt;
use mongodb::bson::Binary;
use mongodb::Client;

use super::dump::estimate_documents;
use super::pipe::run_pipe;
use super::run::Invocation;
use super::{display_command, CredentialsFile, Tool, ToolsError};
use crate::connections::ToolConnection;
use crate::jobs::{JobInfo, JobKind, JobRegistry, JobSpec};

/// Longest the check for copying onto itself may wait for the collection lists; the dialog
/// waits for it.
const CHECK_TIME_LIMIT: Duration = Duration::from_secs(5);

/// One side of a copy: a live connection and its saved id.
pub struct CopyEnd {
    pub connection_id: String,
    pub connection: ToolConnection,
}

/// Starts a copy job. `target_name` (another connection's name) is added to the title.
/// Both connections stay alive (with their tunnels) until the copy ends.
pub async fn start_copy(
    jobs: &JobRegistry,
    source: CopyEnd,
    target: CopyEnd,
    request: CopyRequest,
    target_name: Option<String>,
) -> Result<JobInfo, ToolsError> {
    let dump_args = request.dump_args()?;
    let restore_args = request.restore_args()?;
    let query = request.source().query_filter()?;
    if source.connection_id == target.connection_id
        && request.source_namespace() == request.target_namespace()
    {
        return Err(onto_itself(&request.target_namespace()));
    }
    ensure_different(
        source.connection.client(),
        target.connection.client(),
        &request,
    )
    .await?;

    let dump_credentials =
        CredentialsFile::new(&source.connection).map_err(ToolsError::Credentials)?;
    let restore_credentials =
        CredentialsFile::new(&target.connection).map_err(ToolsError::Credentials)?;
    let command = format!(
        "{} | {}",
        display_command(Tool::Mongodump, source.connection.display_uri(), &dump_args),
        display_command(
            Tool::Mongorestore,
            target.connection.display_uri(),
            &restore_args
        )
    );
    let destination = match &target_name {
        Some(name) => format!("{} on {name}", request.target_namespace()),
        None => request.target_namespace(),
    };
    let spec = JobSpec {
        kind: JobKind::Copy,
        title: request.title(target_name.as_deref()),
        connection_id: target.connection_id,
        command: Some(command),
    };
    Ok(jobs.start(spec, move |ctx| async move {
        // Keeps the target connection (and its SSH tunnel) open for mongorestore.
        let _target = target.connection;
        let total = estimate_documents(source.connection.client(), &request.source(), query).await;
        let mut progress = CopyProgress::new(total);
        let dump = Invocation {
            tool: Tool::Mongodump,
            args: dump_args,
            credentials: dump_credentials,
            input: None,
        };
        let restore = Invocation {
            tool: Tool::Mongorestore,
            args: restore_args,
            credentials: restore_credentials,
            input: None,
        };
        run_pipe(&ctx, dump, restore, &mut progress).await?;
        Ok(progress.summary(&destination))
    }))
}

/// Refuses a copy whose target collection is the source collection itself, which happens
/// when two saved connections reach the same server: `--drop` would delete the data being
/// read. Collections are compared by their UUID. When the lists cannot be read in time, a
/// copy that replaces collections is refused; any other copy goes ahead (at worst it skips
/// documents that already exist).
async fn ensure_different(
    source: &Client,
    target: &Client,
    request: &CopyRequest,
) -> Result<(), ToolsError> {
    let database = request.database.trim();
    let target_database = request.target_database.trim();
    let lists = tokio::time::timeout(CHECK_TIME_LIMIT, async {
        tokio::join!(
            collection_ids(source, database),
            collection_ids(target, target_database)
        )
    })
    .await;
    let Ok((Ok(from), Ok(to))) = lists else {
        if request.drop {
            return Err(ToolsError::Invalid(format!(
                "RipeMongo could not list the collections of both connections within {} \
                 seconds, so it cannot make sure the target is not the source. Check that both \
                 servers are reachable, or copy without replacing.",
                CHECK_TIME_LIMIT.as_secs()
            )));
        }
        return Ok(());
    };
    let pairs: Vec<(&str, &str)> = match (&request.collection, &request.target_collection) {
        (Some(collection), Some(target)) => vec![(collection.trim(), target.trim())],
        _ => {
            let dump = request.source();
            from.keys()
                .filter(|name| !dump.leaves_out(name))
                .map(|name| (name.as_str(), name.as_str()))
                .collect()
        }
    };
    match pairs.into_iter().find(|(from_name, to_name)| {
        from.get(*from_name)
            .is_some_and(|id| to.get(*to_name) == Some(id))
    }) {
        Some((_, name)) => Err(onto_itself(&format!("{target_database}.{name}"))),
        None => Ok(()),
    }
}

/// Collection UUIDs of a database by name (views have none).
async fn collection_ids(
    client: &Client,
    database: &str,
) -> Result<HashMap<String, Binary>, mongodb::error::Error> {
    let specs: Vec<_> = client
        .database(database)
        .list_collections()
        .await?
        .try_collect()
        .await?;
    Ok(specs
        .into_iter()
        .filter_map(|spec| spec.info.uuid.map(|uuid| (spec.name, uuid)))
        .collect())
}

fn onto_itself(namespace: &str) -> ToolsError {
    ToolsError::Invalid(format!(
        "The target is the source itself: {namespace} would be copied onto itself. Choose \
         another target database or collection name."
    ))
}
