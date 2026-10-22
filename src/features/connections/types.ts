/** Connection types generated from Rust, re-exported under feature-local names. */
export type {
  ActiveConnectionInfo,
  AuthConfig,
  ConnectionColor,
  ConnectionConfig,
  ConnectionProfile,
  ConnectionsFileInfo,
  HostPort,
  ImportSummary,
  OidcEnvironment,
  ReadPreferenceMode,
  ScramVariant,
  SecretUpdate,
  SecretUpdates,
  ServerInfo,
  SshAuthMethod,
  SshConfig,
  StoredSecrets,
  TlsConfig,
  UriOption,
} from "@/shared/ipc/bindings";

/** Names of the secrets a connection can have (keys of `SecretUpdates`). */
export type SecretName =
  "password" | "awsSessionToken" | "tlsKeyPassword" | "sshPassword" | "sshKeyPassphrase";
