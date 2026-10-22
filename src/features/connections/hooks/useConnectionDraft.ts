/** Editable copy of a connection profile plus pending keychain secret updates. */
import { useCallback, useState } from "react";

import type { ParsedConnectionString } from "@/shared/ipc/bindings";

import { withParsedUri, type DraftValues } from "../lib/draft";
import { KEEP_ALL_SECRETS } from "../lib/secrets";
import type { ConnectionConfig, ConnectionProfile, SecretName, SecretUpdate } from "../types";

export function useConnectionDraft(initial: ConnectionProfile) {
  const [values, setValues] = useState<DraftValues>({
    profile: initial,
    secrets: KEEP_ALL_SECRETS,
  });

  const updateProfile = useCallback((patch: Partial<Omit<ConnectionProfile, "config">>) => {
    setValues((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
  }, []);

  const updateConfig = useCallback((patch: Partial<ConnectionConfig>) => {
    setValues((current) => ({
      ...current,
      profile: { ...current.profile, config: { ...current.profile.config, ...patch } },
    }));
  }, []);

  const setSecret = useCallback((name: SecretName, update: SecretUpdate) => {
    setValues((current) => ({ ...current, secrets: { ...current.secrets, [name]: update } }));
  }, []);

  const applyParsedUri = useCallback((parsed: ParsedConnectionString) => {
    setValues((current) => withParsedUri(current, parsed));
  }, []);

  return {
    values,
    profile: values.profile,
    secrets: values.secrets,
    updateProfile,
    updateConfig,
    setSecret,
    applyParsedUri,
  };
}

export type ConnectionDraft = ReturnType<typeof useConnectionDraft>;
