/**
 * Typed IPC client. Features call generated `commands.*` from `./bindings` through
 * {@link unwrap} (fallible commands) or {@link call} (infallible ones). Both convert
 * every failure into an {@link IpcError}, so UI code handles exactly one error type.
 */
import type { AppError, ErrorCode } from "./bindings";

export { commands } from "./bindings";

/** Error code for failures raised by Tauri itself (unknown command, ACL denial, ...). */
export const IPC_FAILURE = "IPC_FAILURE";

export type ClientErrorCode = ErrorCode | typeof IPC_FAILURE;

type CommandResult<T> = { status: "ok"; data: T } | { status: "error"; error: unknown };

/** Error thrown by the IPC client; mirrors the backend `AppError`. */
export class IpcError extends Error {
  readonly code: ClientErrorCode;
  readonly hint: string | null;

  constructor(code: ClientErrorCode, message: string, hint: string | null = null) {
    super(message);
    this.name = "IpcError";
    this.code = code;
    this.hint = hint;
  }
}

/** Narrows an unknown value to the backend error shape. */
export function isAppError(value: unknown): value is AppError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

/** Converts anything thrown or returned across IPC into an {@link IpcError}. */
export function toIpcError(error: unknown): IpcError {
  if (error instanceof IpcError) return error;
  if (isAppError(error)) return new IpcError(error.code, error.message, error.hint ?? null);
  if (error instanceof Error) return new IpcError(IPC_FAILURE, error.message);
  if (typeof error === "string") return new IpcError(IPC_FAILURE, error);
  return new IpcError(IPC_FAILURE, "An unknown error occurred while talking to the backend.");
}

/** Awaits an infallible command, normalizing framework-level rejections. */
export async function call<T>(pending: Promise<T>): Promise<T> {
  try {
    return await pending;
  } catch (error) {
    throw toIpcError(error);
  }
}

/** Awaits a fallible command and returns its data or throws an {@link IpcError}. */
export async function unwrap<T>(pending: Promise<CommandResult<T>>): Promise<T> {
  const result = await call(pending);
  if (result.status === "error") throw toIpcError(result.error);
  return result.data;
}
