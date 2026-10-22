//! Describes the deployment behind a client using `hello` and `buildInfo`.

use mongodb::bson::{doc, Document};
use mongodb::Client;
use serde::Serialize;
use specta::Type;

/// Deployment shape as seen from the connected member.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum TopologyKind {
    Standalone,
    ReplicaSet,
    Sharded,
}

/// What the overview tab shows about a connected server.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    /// MongoDB server version, e.g. `8.0.4`.
    pub version: String,
    pub topology: TopologyKind,
    pub replica_set_name: Option<String>,
    /// Replica set members as reported by the server (`host:port`).
    pub hosts: Vec<String>,
    pub primary: Option<String>,
    /// Whether the member we talk to accepts writes.
    pub writable: bool,
}

/// `hello.msg` value that identifies a mongos router.
const MONGOS_MESSAGE: &str = "isdbgrid";

/// Runs `hello` + `buildInfo` against the admin database.
pub async fn fetch_server_info(client: &Client) -> Result<ServerInfo, mongodb::error::Error> {
    let admin = client.database("admin");
    let hello = admin.run_command(doc! { "hello": 1 }).await?;
    let build_info = admin.run_command(doc! { "buildInfo": 1 }).await?;
    Ok(describe(&hello, &build_info))
}

fn describe(hello: &Document, build_info: &Document) -> ServerInfo {
    let replica_set_name = hello.get_str("setName").ok().map(str::to_owned);
    let topology = if hello.get_str("msg").ok() == Some(MONGOS_MESSAGE) {
        TopologyKind::Sharded
    } else if replica_set_name.is_some() {
        TopologyKind::ReplicaSet
    } else {
        TopologyKind::Standalone
    };
    let hosts = hello
        .get_array("hosts")
        .map(|hosts| {
            hosts
                .iter()
                .filter_map(|host| host.as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    ServerInfo {
        version: build_info
            .get_str("version")
            .unwrap_or("unknown")
            .to_owned(),
        topology,
        replica_set_name,
        hosts,
        primary: hello.get_str("primary").ok().map(str::to_owned),
        writable: hello.get_bool("isWritablePrimary").unwrap_or(false),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_topologies() {
        let build = doc! { "version": "8.0.4" };
        let standalone = describe(&doc! { "isWritablePrimary": true }, &build);
        assert_eq!(standalone.topology, TopologyKind::Standalone);
        assert!(standalone.writable);
        assert_eq!(standalone.version, "8.0.4");

        let replica = describe(
            &doc! { "setName": "rs0", "hosts": ["a:1", "b:2"], "primary": "a:1" },
            &build,
        );
        assert_eq!(replica.topology, TopologyKind::ReplicaSet);
        assert_eq!(replica.hosts, ["a:1", "b:2"]);
        assert_eq!(replica.primary.as_deref(), Some("a:1"));

        let sharded = describe(&doc! { "msg": "isdbgrid" }, &build);
        assert_eq!(sharded.topology, TopologyKind::Sharded);
    }
}
