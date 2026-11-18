import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyAdminMasterPassword } from "../lib/auth/adminRoles";
import {
  ensureServerSession,
  isServerAdminSession,
} from "../lib/auth/serverSessionClient";
import { validateAuthActionUrl } from "../lib/auth/emailService";
import { getOriginFromHeaders } from "../lib/auth/betterAuth";

function verifyAuthActionUrlOrigin(): void {
  const envKeys = [
    "APP_URL",
    "BETTER_AUTH_URL",
    "NEXT_PUBLIC_APP_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "VERCEL_URL",
  ] as const;
  const originalEnv = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]])
  );
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.APP_URL = "https://souftools.example";
    delete process.env.BETTER_AUTH_URL;

    assert.equal(
      validateAuthActionUrl("https://souftools.example/api/auth/verify-email?token=test"),
      "https://souftools.example/api/auth/verify-email?token=test"
    );
    assert.throws(
      () => validateAuthActionUrl("https://attacker.example/api/auth/verify-email?token=test"),
      /configured application origin/
    );
    assert.throws(
      () => validateAuthActionUrl("http://souftools.example/api/auth/verify-email?token=test"),
      /configured application origin/
    );

    for (const key of envKeys) {
      delete process.env[key];
    }
    Reflect.set(process.env, "NODE_ENV", "production");
    assert.equal(
      validateAuthActionUrl(
        "https://souftools0003.enzonic.dev/api/auth/reset-password?token=test"
      ),
      "https://souftools0003.enzonic.dev/api/auth/reset-password?token=test"
    );
    assert.throws(
      () => validateAuthActionUrl("https://attacker.example/api/auth/reset-password?token=test"),
      /configured application origin/
    );
  } finally {
    for (const key of envKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
    else Reflect.set(process.env, "NODE_ENV", originalNodeEnv);
  }
}

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
  verifyAuthActionUrlOrigin();
  verifyMasterAdminPasswordRequiresConfiguration();
  await verifySessionSynchronization();
  await verifyUnauthenticatedSessionDoesNotPass();
  const previewOrigin = getOriginFromHeaders(
    new Headers({
      host: "souftools0003-4285a4de.enzonic.dev",
      "x-forwarded-proto": "https",
    })
  );
  assert.equal(previewOrigin, "https://souftools0003.enzonic.dev");
  console.log("Auth session reliability checks passed.");
}

void main().catch((error: unknown) => {
  console.error("Auth session reliability checks failed:", error);
  process.exitCode = 1;
});
