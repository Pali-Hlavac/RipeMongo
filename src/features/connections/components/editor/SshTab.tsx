import { FormField } from "@/shared/ui/form-field";
import { Checkbox, Input, NativeSelect } from "@/shared/ui/input";

import { DEFAULT_SSH_PORT, defaultSshConfig } from "../../lib/defaults";
import type { SshConfig } from "../../types";
import { FilePathField } from "./FilePathField";
import { SecretField } from "./SecretField";
import { TextField } from "./TextField";
import type { SectionProps } from "./section";

/** Optional SSH tunnel through a bastion host. */
export function SshTab({ draft, stored }: SectionProps) {
  const { profile, secrets, updateConfig, setSecret } = draft;
  const ssh = profile.config.ssh;
  const setSsh = (patch: Partial<SshConfig>) => {
    if (ssh) updateConfig({ ssh: { ...ssh, ...patch } });
  };

  return (
    <div className="grid gap-4">
      <Checkbox
        label="Connect through an SSH tunnel"
        checked={ssh !== null}
        onChange={(event) => {
          updateConfig({ ssh: event.target.checked ? defaultSshConfig() : null });
        }}
      />
      <p className="text-sm text-muted-foreground">
        The tunnel reaches one MongoDB host directly, so it cannot be combined with mongodb+srv://
        or multiple hosts.
      </p>
      {ssh && (
        <>
          <div className="grid grid-cols-[1fr_8rem] gap-4">
            <TextField
              label="SSH host"
              placeholder="bastion.example.com"
              value={ssh.host}
              onChange={(host) => {
                setSsh({ host });
              }}
            />
            <FormField label="SSH port">
              {(control) => (
                <Input
                  {...control}
                  inputMode="numeric"
                  value={ssh.port}
                  onChange={(event) => {
                    setSsh({ port: Number.parseInt(event.target.value, 10) || DEFAULT_SSH_PORT });
                  }}
                />
              )}
            </FormField>
          </div>
          <TextField
            label="SSH user name"
            value={ssh.username}
            onChange={(username) => {
              setSsh({ username });
            }}
          />
          <FormField label="SSH authentication">
            {(control) => (
              <NativeSelect
                {...control}
                value={ssh.auth.method}
                onChange={(event) => {
                  setSsh({
                    auth:
                      event.target.value === "privateKey"
                        ? { method: "privateKey", keyFile: "" }
                        : { method: "password" },
                  });
                }}
              >
                <option value="password">Password</option>
                <option value="privateKey">Private key</option>
              </NativeSelect>
            )}
          </FormField>
          {ssh.auth.method === "password" ? (
            <SecretField
              label="SSH password"
              stored={stored?.sshPassword ?? false}
              update={secrets.sshPassword}
              onChange={(update) => {
                setSecret("sshPassword", update);
              }}
            />
          ) : (
            <>
              <FilePathField
                label="Private key file"
                value={ssh.auth.keyFile || null}
                onChange={(keyFile) => {
                  setSsh({ auth: { method: "privateKey", keyFile: keyFile ?? "" } });
                }}
              />
              <SecretField
                label="Key passphrase (if encrypted)"
                stored={stored?.sshKeyPassphrase ?? false}
                update={secrets.sshKeyPassphrase}
                onChange={(update) => {
                  setSecret("sshKeyPassphrase", update);
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
