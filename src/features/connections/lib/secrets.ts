/** Helpers for keychain-backed secret fields in the connection editor. */
import type { SecretName, SecretUpdate, SecretUpdates } from "../types";

export const KEEP: SecretUpdate = { action: "keep" };

/** Leave every stored secret untouched. */
export const KEEP_ALL_SECRETS: SecretUpdates = {
  password: KEEP,
  awsSessionToken: KEEP,
  tlsKeyPassword: KEEP,
  sshPassword: KEEP,
  sshKeyPassphrase: KEEP,
};

/** Update produced by typing into a secret field: empty input means "unchanged". */
export function updateFromInput(value: string): SecretUpdate {
  return value === "" ? KEEP : { action: "set", value };
}

/** Secrets found in a pasted URI become `set` updates; absent ones are left as they were. */
export function mergeUriSecrets(
  current: SecretUpdates,
  found: Partial<Record<SecretName, string | null>>,
): SecretUpdates {
  const next = { ...current };
  for (const [name, value] of Object.entries(found) as [SecretName, string | null][]) {
    if (value) next[name] = { action: "set", value };
  }
  return next;
}

/** Text currently typed into a secret field (empty unless a new value is being set). */
export function inputValue(update: SecretUpdate): string {
  return update.action === "set" ? update.value : "";
}
