import { FormField } from "@/shared/ui/form-field";
import { NativeSelect } from "@/shared/ui/input";

import {
  MECHANISM_OPTIONS,
  emptyToNull,
  isMechanism,
  switchMechanism,
  usesPassword,
} from "../../lib/auth";
import type { AuthConfig, OidcEnvironment, ScramVariant } from "../../types";
import { SecretField } from "./SecretField";
import { TextField } from "./TextField";
import type { SectionProps } from "./section";

const OIDC_ENVIRONMENTS: readonly { value: OidcEnvironment; label: string }[] = [
  { value: "azure", label: "Azure managed identity" },
  { value: "gcp", label: "Google Cloud service account" },
  { value: "k8s", label: "Kubernetes service account" },
];

/** Authentication mechanism and its fields. Passwords go to the keychain. */
export function AuthTab({ draft, stored }: SectionProps) {
  const { profile, secrets, updateConfig, setSecret } = draft;
  const auth = profile.config.auth;
  const setAuth = (next: AuthConfig) => {
    updateConfig({ auth: next });
  };

  return (
    <div className="grid gap-4">
      <FormField label="Authentication method">
        {(control) => (
          <NativeSelect
            {...control}
            value={auth.mechanism}
            onChange={(event) => {
              if (isMechanism(event.target.value))
                setAuth(switchMechanism(auth, event.target.value));
            }}
          >
            {MECHANISM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>

      {(auth.mechanism === "scram" || auth.mechanism === "ldap") && (
        <TextField
          label="User name"
          value={auth.username}
          onChange={(username) => {
            setAuth({ ...auth, username });
          }}
        />
      )}
      {(auth.mechanism === "x509" || auth.mechanism === "oidc") && (
        <TextField
          label={
            auth.mechanism === "oidc" ? "User name / client id (optional)" : "User name (optional)"
          }
          description={
            auth.mechanism === "x509"
              ? "Usually derived from the client certificate subject."
              : undefined
          }
          value={auth.username ?? ""}
          onChange={(value) => {
            setAuth({ ...auth, username: emptyToNull(value) });
          }}
        />
      )}
      {auth.mechanism === "aws" && (
        <TextField
          label="Access key id (optional)"
          description="Leave empty to use credentials from the environment or instance role."
          value={auth.accessKeyId ?? ""}
          onChange={(value) => {
            setAuth({ ...auth, accessKeyId: emptyToNull(value) });
          }}
        />
      )}

      {usesPassword(auth.mechanism) && (
        <SecretField
          label={auth.mechanism === "aws" ? "Secret access key" : "Password"}
          stored={stored?.password ?? false}
          update={secrets.password}
          onChange={(update) => {
            setSecret("password", update);
          }}
        />
      )}
      {auth.mechanism === "aws" && (
        <SecretField
          label="Session token (optional)"
          stored={stored?.awsSessionToken ?? false}
          update={secrets.awsSessionToken}
          onChange={(update) => {
            setSecret("awsSessionToken", update);
          }}
        />
      )}

      {auth.mechanism === "scram" && (
        <div className="grid grid-cols-2 gap-4">
          <TextField
            label="Authentication database"
            description="Defaults to the database in the connection string, or admin."
            value={auth.authSource ?? ""}
            onChange={(value) => {
              setAuth({ ...auth, authSource: emptyToNull(value) });
            }}
          />
          <FormField label="SCRAM variant">
            {(control) => (
              <NativeSelect
                {...control}
                value={auth.variant}
                onChange={(event) => {
                  setAuth({ ...auth, variant: event.target.value as ScramVariant });
                }}
              >
                <option value="auto">Negotiate automatically</option>
                <option value="sha256">SCRAM-SHA-256</option>
                <option value="sha1">SCRAM-SHA-1</option>
              </NativeSelect>
            )}
          </FormField>
        </div>
      )}
      {auth.mechanism === "x509" && (
        <p className="text-sm text-muted-foreground">
          Enable TLS and choose a client certificate on the TLS tab.
        </p>
      )}
      {auth.mechanism === "oidc" && (
        <>
          <FormField label="Environment">
            {(control) => (
              <NativeSelect
                {...control}
                value={auth.environment ?? ""}
                onChange={(event) => {
                  const environment = OIDC_ENVIRONMENTS.find((e) => e.value === event.target.value);
                  setAuth({ ...auth, environment: environment?.value ?? null });
                }}
              >
                <option value="">Choose…</option>
                {OIDC_ENVIRONMENTS.map((environment) => (
                  <option key={environment.value} value={environment.value}>
                    {environment.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <TextField
            label="Token resource / audience"
            value={auth.tokenResource ?? ""}
            onChange={(value) => {
              setAuth({ ...auth, tokenResource: emptyToNull(value) });
            }}
          />
          <p className="text-sm text-muted-foreground">
            Interactive browser sign-in (OIDC workforce flow) is not supported yet.
          </p>
        </>
      )}
    </div>
  );
}
