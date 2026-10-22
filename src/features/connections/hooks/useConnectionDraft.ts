/** Editable copy of a connection profile plus pending keychain secret updates. */
import { useCallback, useState } from "react";

import type { ConnectionSecrets } from "@/shared/ipc/bindings";

import { KEEP_ALL_SECRETS, mergeUriSecrets } from "../lib/secrets";
import type {
  ConnectionConfig,
  ConnectionProfile,
  SecretName,
  SecretUpdate,
  SecretUpdates,
} from "../types";

export function useConnectionDraft(initial: ConnectionProfile) {
  const [profile, setProfile] = useState(initial);
  const [secrets, setSecrets] = useState<SecretUpdates>(KEEP_ALL_SECRETS);

  const updateProfile = useCallback((patch: Partial<Omit<ConnectionProfile, "config">>) => {
    setProfile((current) => ({ ...current, ...patch }));
  }, []);

  const updateConfig = useCallback((patch: Partial<ConnectionConfig>) => {
    setProfile((current) => ({ ...current, config: { ...current.config, ...patch } }));
  }, []);

  const setSecret = useCallback((name: SecretName, update: SecretUpdate) => {
    setSecrets((current) => ({ ...current, [name]: update }));
  }, []);

  /** Applies a parsed connection string; the SSH tunnel is not part of URIs, so it is kept. */
  const applyParsedUri = useCallback((config: ConnectionConfig, found: ConnectionSecrets) => {
    setProfile((current) => ({ ...current, config: { ...config, ssh: current.config.ssh } }));
    setSecrets((current) => mergeUriSecrets(current, found));
  }, []);

  return { profile, secrets, updateProfile, updateConfig, setSecret, applyParsedUri };
}

export type ConnectionDraft = ReturnType<typeof useConnectionDraft>;
