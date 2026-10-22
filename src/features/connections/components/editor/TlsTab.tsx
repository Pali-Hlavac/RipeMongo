import { FormField } from "@/shared/ui/form-field";
import { Checkbox, NativeSelect } from "@/shared/ui/input";

import type { TlsConfig } from "../../types";
import { FilePathField } from "./FilePathField";
import { SecretField } from "./SecretField";
import type { SectionProps } from "./section";

const PEM_EXTENSIONS = ["pem", "crt", "cer", "key"];

type TlsMode = "default" | "on" | "off";

function modeOf(enabled: boolean | null): TlsMode {
  if (enabled === null) return "default";
  return enabled ? "on" : "off";
}

const ENABLED_BY_MODE: Record<TlsMode, boolean | null> = { default: null, on: true, off: false };

/** TLS on/off, CA and client certificate files, and relaxed verification switches. */
export function TlsTab({ draft, stored }: SectionProps) {
  const { profile, secrets, updateConfig, setSecret } = draft;
  const tls = profile.config.tls;
  const setTls = (patch: Partial<TlsConfig>) => {
    updateConfig({ tls: { ...tls, ...patch } });
  };

  return (
    <div className="grid gap-4">
      <FormField
        label="TLS / SSL"
        description="Default: on for mongodb+srv:// connections, off otherwise."
      >
        {(control) => (
          <NativeSelect
            {...control}
            value={modeOf(tls.enabled)}
            onChange={(event) => {
              const mode = event.target.value as TlsMode;
              setTls({ enabled: ENABLED_BY_MODE[mode] });
            }}
          >
            <option value="default">Default</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </NativeSelect>
        )}
      </FormField>
      <FilePathField
        label="Certificate authority (CA) file"
        description="Only needed when the server certificate is not signed by a public CA."
        extensions={PEM_EXTENSIONS}
        value={tls.caFile}
        onChange={(caFile) => {
          setTls({ caFile });
        }}
      />
      <FilePathField
        label="Client certificate and key (PEM)"
        description="Required for X.509 authentication or mutual TLS."
        extensions={PEM_EXTENSIONS}
        value={tls.certificateKeyFile}
        onChange={(certificateKeyFile) => {
          setTls({ certificateKeyFile });
        }}
      />
      {tls.certificateKeyFile !== null && (
        <SecretField
          label="Client key password (if encrypted)"
          stored={stored?.tlsKeyPassword ?? false}
          update={secrets.tlsKeyPassword}
          onChange={(update) => {
            setSecret("tlsKeyPassword", update);
          }}
        />
      )}
      <div className="grid gap-2">
        <Checkbox
          label="Allow invalid certificates"
          checked={tls.allowInvalidCertificates}
          onChange={(event) => {
            setTls({ allowInvalidCertificates: event.target.checked });
          }}
        />
        <Checkbox
          label="Allow invalid host names"
          checked={tls.allowInvalidHostnames}
          onChange={(event) => {
            setTls({ allowInvalidHostnames: event.target.checked });
          }}
        />
        {(tls.allowInvalidCertificates || tls.allowInvalidHostnames) && (
          <p role="note" className="text-xs text-destructive">
            Relaxed verification makes man-in-the-middle attacks possible. Use only for testing.
          </p>
        )}
      </div>
    </div>
  );
}
