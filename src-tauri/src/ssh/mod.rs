//! SSH tunnels (local port forwarding) to reach MongoDB servers behind a bastion host.
//! See ADR 0013 for the design and its limitations.

mod error;
mod host_keys;
mod tunnel;

pub use error::SshError;
pub use tunnel::{SshCredentials, SshTunnel, LOOPBACK};
