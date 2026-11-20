type ErrorDetails = {
  cause?: unknown;
  code?: unknown;
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

const RETRYABLE_ERROR_PATTERNS = [
  "sqlite_busy",
  "sqlite_locked",
  "database is locked",
  "database table is locked",
  "cannot start a transaction",
  "econnreset",
  "etimedout",
  "econnrefused",
  "epipe",
  "fetch failed",
  "network",
  "socket hang up",
  "stream closed",
  "hrana",
  "502",
  "503",
  "504",
  "timeout",
];

const TRANSPORT_ERROR_CODES = new Set([
  "econnreset",
  "econnrefused",
  "ehostunreach",
  "enetunreach",
  "epipe",
  "etimedout",
  "und_err_connect_timeout",
  "und_err_headers_timeout",
  "und_err_socket",
]);

function getErrorChain(error: unknown): ErrorDetails[] {
  const chain: ErrorDetails[] = [];
  const pending: unknown[] = [error];
  const seen = new Set<object>();

  while (pending.length > 0 && chain.length < 8) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;

    seen.add(current);
    const details = current as ErrorDetails;
    chain.push(details);
    if (details.cause) pending.push(details.cause);
  }

  return chain;
}

function errorText(details: ErrorDetails): string {
  return `${String(details.message || "").toLowerCase()} ${String(details.code || "").toLowerCase()}`;
}

function getStatus(details: ErrorDetails): number | undefined {
  const status = Number(details.status ?? details.statusCode);
  return Number.isInteger(status) ? status : undefined;
}

export function isRetryableTursoError(error: unknown): boolean {
  return (
    isTursoTransportError(error) ||
    getErrorChain(error).some((details) => {
      const status = getStatus(details);
      if (status !== undefined && status >= 500 && status <= 599) return true;

      const text = errorText(details);
      return RETRYABLE_ERROR_PATTERNS.some(
        (pattern) => text.includes(pattern) || String(details.code || "").toLowerCase().includes(pattern)
      );
    })
  );
}

export function isTursoTransportError(error: unknown): boolean {
  return getErrorChain(error).some((details) => {
    const code = String(details.code || "").toLowerCase();
    const text = errorText(details);
    return (
      TRANSPORT_ERROR_CODES.has(code) ||
      text.includes("fetch failed") ||
      text.includes("socket") ||
      text.includes("connection closed") ||
      text.includes("client is closed")
    );
  });
}

export function isTursoEndpointNotFound(error: unknown): boolean {
  return getErrorChain(error).some(
    (details) =>
      getStatus(details) === 404 ||
      /http status 404\b/i.test(String(details.message || ""))
  );
}
