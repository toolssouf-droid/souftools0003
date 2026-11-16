import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyAdminMasterPassword } from "../lib/auth/adminRoles";
import {
  ensureServerSession,
  isServerAdminSession,
} from "../lib/auth/serverSessionClient";

function verifyMasterAdminPasswordRequiresConfiguration(): void {
  const originalHash = process.env.ADMIN_MASTER_PASSWORD_HASH;
  delete process.env.ADMIN_MASTER_PASSWORD_HASH;

  try {
    assert.equal(verifyAdminMasterPassword("test-master-password"), false);

    process.env.ADMIN_MASTER_PASSWORD_HASH = createHash("sha256")
      .update("test-master-password")
      .digest("hex");
    assert.equal(verifyAdminMasterPassword("test-master-password"), true);
    assert.equal(verifyAdminMasterPassword("incorrect-password"), false);
  } finally {
    if (originalHash === undefined) {
      delete process.env.ADMIN_MASTER_PASSWORD_HASH;
    } else {
      process.env.ADMIN_MASTER_PASSWORD_HASH = originalHash;
    }
  }
}

async function verifySessionSynchronization(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const methods: string[] = [];
  let sessionReads = 0;

  globalThis.fetch = async (_input, init) => {
    const method = init?.method || "GET";
    methods.push(method);

    if (method === "POST") {
      return new Response(JSON.stringify({ status: "synced" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    sessionReads += 1;
    const body =
      sessionReads === 1
        ? { authenticated: false, user: null }
        : {
            authenticated: true,
            user: { id: "admin-1", email: "admin@example.com", role: "super_admin" },
          };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const session = await ensureServerSession();
    assert.deepEqual(methods, ["GET", "POST", "GET"]);
    assert.equal(isServerAdminSession(session), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function verifyUnauthenticatedSessionDoesNotPass(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const methods: string[] = [];

  globalThis.fetch = async (_input, init) => {
    const method = init?.method || "GET";
    methods.push(method);
    return new Response(JSON.stringify({ authenticated: false, user: null }), {
      status: method === "POST" ? 401 : 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const session = await ensureServerSession();
    assert.deepEqual(methods, ["GET", "POST"]);
    assert.equal(isServerAdminSession(session), false);
    assert.equal(
      isServerAdminSession({
        authenticated: false,
        user: { id: "admin-1", email: "admin@example.com", role: "super_admin" },
      }),
      false
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function main(): Promise<void> {
  verifyMasterAdminPasswordRequiresConfiguration();
  await verifySessionSynchronization();
  await verifyUnauthenticatedSessionDoesNotPass();
  console.log("Auth session reliability checks passed.");
}

void main().catch((error: unknown) => {
  console.error("Auth session reliability checks failed:", error);
  process.exitCode = 1;
});
