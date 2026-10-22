/**
 * Two-way sync between the connection-string field and the structured form. The backend
 * owns parsing and building, so the URI shown here is exactly what is used to connect.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { call, commands, toIpcError, unwrap } from "@/shared/ipc/client";

import type { ConnectionConfig, ConnectionSecrets } from "@/shared/ipc/bindings";

/** Wait this long after the last keystroke before parsing the URI. */
export const URI_PARSE_DEBOUNCE_MS = 300;

interface UriSyncOptions {
  config: ConnectionConfig;
  /** Called with a successfully parsed URI. */
  onParsed: (config: ConnectionConfig, secrets: ConnectionSecrets) => void;
}

export function useUriSync({ config, onParsed }: UriSyncOptions) {
  const [uri, setUri] = useState("");
  const [error, setError] = useState<string | null>(null);
  const editingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onParsedRef = useRef(onParsed);

  useEffect(() => {
    onParsedRef.current = onParsed;
  }, [onParsed]);

  const rebuild = useCallback(async (from: ConnectionConfig) => {
    const built = await call(commands.buildConnectionString(from));
    setUri(built);
    setError(null);
  }, []);

  // Form → URI, unless the user is typing in the URI field.
  useEffect(() => {
    if (editingRef.current) return;
    void rebuild(config);
  }, [config, rebuild]);

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
    },
    [],
  );

  const parse = useCallback(async (value: string) => {
    try {
      const parsed = await unwrap(commands.parseConnectionString(value));
      setError(null);
      onParsedRef.current(parsed.config, parsed.secrets);
    } catch (parseError) {
      setError(toIpcError(parseError).message);
    }
  }, []);

  /** URI field change: keep the text as typed and parse it once typing pauses. */
  const onUriChange = useCallback(
    (value: string) => {
      editingRef.current = true;
      setUri(value);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void parse(value), URI_PARSE_DEBOUNCE_MS);
    },
    [parse],
  );

  /** URI field blur: show the normalized form of a valid URI. */
  const onUriBlur = useCallback(() => {
    editingRef.current = false;
    if (error === null) void rebuild(config);
  }, [config, error, rebuild]);

  return { uri, error, onUriChange, onUriBlur };
}
