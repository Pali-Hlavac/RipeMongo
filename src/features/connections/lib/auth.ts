/** Authentication mechanism metadata and conversions for the editor. */
import type { AuthConfig } from "../types";

export type Mechanism = AuthConfig["mechanism"];

export const MECHANISM_OPTIONS: readonly { value: Mechanism; label: string }[] = [
  { value: "none", label: "None" },
  { value: "scram", label: "Username / password (SCRAM)" },
  { value: "x509", label: "X.509 client certificate" },
  { value: "ldap", label: "LDAP (PLAIN)" },
  { value: "aws", label: "AWS IAM" },
  { value: "oidc", label: "OIDC (cloud environment)" },
];

export function isMechanism(value: string): value is Mechanism {
  return MECHANISM_OPTIONS.some((option) => option.value === value);
}

/** The user name of any mechanism, so switching mechanisms keeps what was typed. */
export function usernameOf(auth: AuthConfig): string | null {
  switch (auth.mechanism) {
    case "none":
      return null;
    case "aws":
      return auth.accessKeyId;
    case "scram":
    case "ldap":
    case "x509":
    case "oidc":
      return auth.username;
  }
}

/** Default settings for `mechanism`, carrying over the current user name. */
export function switchMechanism(current: AuthConfig, mechanism: Mechanism): AuthConfig {
  const username = usernameOf(current);
  switch (mechanism) {
    case "none":
      return { mechanism };
    case "scram":
      return { mechanism, username: username ?? "", authSource: null, variant: "auto" };
    case "x509":
      return { mechanism, username };
    case "ldap":
      return { mechanism, username: username ?? "" };
    case "aws":
      return { mechanism, accessKeyId: username };
    case "oidc":
      return { mechanism, username, environment: null, tokenResource: null };
  }
}

/** Whether the mechanism uses the connection's password secret. */
export function usesPassword(mechanism: Mechanism): boolean {
  return mechanism === "scram" || mechanism === "ldap" || mechanism === "aws";
}

/** Converts an empty text input into `null` for optional string fields. */
export function emptyToNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}
