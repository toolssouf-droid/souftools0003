import assert from "node:assert/strict";
import {
  isRetryableTursoError,
  isTursoEndpointNotFound,
  isTursoTransportError,
} from "../lib/db/tursoErrors";

const connectionTimeout = Object.assign(new Error("Failed query"), {
  code: "SERVER_ERROR",
  cause: Object.assign(new Error("fetch failed"), {
    cause: Object.assign(new Error("Connect Timeout Error"), {
      code: "UND_ERR_CONNECT_TIMEOUT",
    }),
  }),
});

const endpointNotFound = Object.assign(new Error("Failed query"), {
  code: "SERVER_ERROR",
  cause: Object.assign(new Error("Server returned HTTP status 404"), {
    status: 404,
  }),
});

const closedClient = Object.assign(new Error("Failed query"), {
  cause: new Error("The client is closed"),
});

assert.equal(isRetryableTursoError(connectionTimeout), true);
assert.equal(isTursoTransportError(connectionTimeout), true);
assert.equal(isRetryableTursoError(closedClient), true);
assert.equal(isTursoTransportError(closedClient), true);
assert.equal(isRetryableTursoError(endpointNotFound), false);
assert.equal(isTursoEndpointNotFound(endpointNotFound), true);
assert.equal(isRetryableTursoError(new Error("SQLITE_BUSY: database is locked")), true);
assert.equal(isRetryableTursoError(new Error("Invalid credentials")), false);

console.log("Turso nested error classification checks passed.");
