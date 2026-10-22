/** Defaults for new connections and sub-settings in the editor. */
import type { ConnectionConfig, ConnectionProfile, SshConfig } from "../types";

export const DEFAULT_PORT = 27017;
export const DEFAULT_SSH_PORT = 22;
export const DEFAULT_HOST = "localhost";

/** A local server without auth: mirrors `ConnectionConfig::default()` in Rust. */
export function defaultConfig(): ConnectionConfig {
  return {
    scheme: "standard",
    hosts: [{ host: DEFAULT_HOST, port: DEFAULT_PORT }],
    auth: { mechanism: "none" },
    tls: {
      enabled: null,
      caFile: null,
      certificateKeyFile: null,
      allowInvalidCertificates: false,
      allowInvalidHostnames: false,
    },
    replicaSet: null,
    readPreference: null,
    directConnection: null,
    appName: null,
    defaultDatabase: null,
    extraOptions: [],
    ssh: null,
  };
}

/** An unsaved profile (empty id) for the "New connection" editor. */
export function newProfile(): ConnectionProfile {
  return {
    id: "",
    name: "",
    folder: null,
    favorite: false,
    color: null,
    config: defaultConfig(),
  };
}

export function defaultSshConfig(): SshConfig {
  return { host: "", port: DEFAULT_SSH_PORT, username: "", auth: { method: "password" } };
}

/** A sensible display name derived from the first host, e.g. "localhost:27017". */
export function suggestName(config: ConnectionConfig): string {
  const first = config.hosts[0];
  if (!first) return "";
  return first.port === null ? first.host : `${first.host}:${first.port}`;
}
