export function getAbortError(signal?: AbortSignal, fallbackMessage = "Operation aborted."): Error {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;

  const error = new Error(
    typeof reason === "string" && reason ? reason : fallbackMessage
  );
  error.name = reason && typeof reason === "object" && "name" in reason
    ? String(reason.name)
    : "AbortError";
  return error;
}

export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === "AbortError" || candidate.code === "ABORT_ERR";
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw getAbortError(signal);
}
