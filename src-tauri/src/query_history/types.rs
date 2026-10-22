//! Saved query model shared with the frontend.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use specta::Type;

/// The text parts of a `find` query, as typed by the user.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct QueryParts {
    pub filter: String,
    pub projection: String,
    pub sort: String,
    pub collation: String,
}

impl QueryParts {
    /// True when every part is blank (nothing worth remembering).
    pub fn is_blank(&self) -> bool {
        [&self.filter, &self.projection, &self.sort, &self.collation]
            .iter()
            .all(|part| part.trim().is_empty())
    }

    /// Same query ignoring surrounding whitespace.
    pub fn same_as(&self, other: &Self) -> bool {
        self.filter.trim() == other.filter.trim()
            && self.projection.trim() == other.projection.trim()
            && self.sort.trim() == other.sort.trim()
            && self.collation.trim() == other.collation.trim()
    }
}

/// A remembered query: a recent run, or a named favorite.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedQuery {
    pub id: String,
    /// Favorites only.
    pub name: Option<String>,
    pub query: QueryParts,
    /// RFC 3339 time of the last run or save.
    pub saved_at: String,
}

/// Recent and favorite queries of one collection.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct CollectionQueries {
    /// Most recent first.
    pub recent: Vec<SavedQuery>,
    pub favorites: Vec<SavedQuery>,
}

/// On-disk document: queries per `<connectionId>/<database>.<collection>`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct HistoryFile {
    pub collections: BTreeMap<String, CollectionQueries>,
}
