/** Pure transitions of the connection editor draft. */
import type { ParsedConnectionString } from "@/shared/ipc/bindings";

import type { ConnectionProfile, SecretUpdates } from "../types";
import { mergeUriSecrets } from "./secrets";

export interface DraftValues {
  profile: ConnectionProfile;
  secrets: SecretUpdates;
}

/**
 * Applies a parsed connection string to the draft. The SSH tunnel is not part of URIs, so
 * the draft's SSH settings are kept; secrets found in the URI become `set` updates.
 */
export function withParsedUri(draft: DraftValues, parsed: ParsedConnectionString): DraftValues {
  return {
    profile: { ...draft.profile, config: { ...parsed.config, ssh: draft.profile.config.ssh } },
    secrets: mergeUriSecrets(draft.secrets, parsed.secrets),
  };
}

/** Stable fingerprint of the settings a test ran with, to match results to the form. */
export function settingsFingerprint({ profile, secrets }: DraftValues): string {
  return JSON.stringify({ config: profile.config, secrets });
}
