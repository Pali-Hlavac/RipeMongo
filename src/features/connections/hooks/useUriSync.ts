/**
 * Two-way sync between the connection-string field and the structured form. The backend
 * owns parsing and building, so the URI shown here is exactly what is used to connect.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { ConnectionConfig, ParsedConnectionString } from "@/shared/ipc/bindings";
import { call, commands, toIpcError, unwrap } from "@/shared/ipc/client";

/** Wait this long after the last keystroke before parsing the URI. */
export const URI_PARSE_DEBOUNCE_MS = 300;

/** Outcome of {@link UriSync.flush}: nothing pending, the parsed URI, or a parse error. */
export type FlushResult =
  { kind: "idle" } | { kind: "parsed"; parsed: ParsedConnectionString } | { kind: "invalid" };

interface UriSyncOptions {
  config: ConnectionConfig;
  /** Called with every successfully parsed URI. */
  onParsed: (parsed: ParsedConnectionString) => void;
}

export function useUriSync({ config, onParsed }: UriSyncOptions) {
  const [uri, setUri] = useState("");
  const [error, setError] = useState<string | null>(null);
  const editingRef = useRef(false);
  const pendingRef = useRef<string | null>(null);
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

  /** Parses the pending URI text now (cancelling the debounce) and applies it. */
  const flush = useCallback(async (): Promise<FlushResult> => {
    clearTimeout(timerRef.current);
    const value = pendingRef.current;
    if (value === null) return { kind: "idle" };
    pendingRef.current = null;
    try {
      const parsed = await unwrap(commands.parseConnectionString(value));
      setError(null);
      onParsedRef.current(parsed);
      return { kind: "parsed", parsed };
    } catch (parseError) {
      setError(toIpcError(parseError).message);
      return { kind: "invalid" };
    }
  }, []);

  /** URI field change: keep the text as typed and parse it once typing pauses. */
  const onUriChange = useCallback(
    (value: string) => {
      editingRef.current = true;
      pendingRef.current = value;
      setUri(value);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), URI_PARSE_DEBOUNCE_MS);
    },
    [flush],
  );

  /** URI field blur: show the normalized form of a valid URI. */
  const onUriBlur = useCallback(() => {
    editingRef.current = false;
    if (pendingRef.current === null && error === null) void rebuild(config);
  }, [config, error, rebuild]);

  return { uri, error, onUriChange, onUriBlur, flush };
}

export type UriSync = ReturnType<typeof useUriSync>;
