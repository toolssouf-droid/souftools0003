import assert from "node:assert/strict";
import { getOriginFromHeaders, shouldUseSecureCookies } from "../lib/auth/betterAuth";
import { mapSyncBootstrapResponse } from "../lib/sync/bootstrapMapper";

function verifyRequestOrigins(): void {
  assert.equal(
    getOriginFromHeaders(new Headers({ host: "192.168.11.160:3000" })),
    "http://192.168.11.160:3000",
    "plain HTTP on a LAN address must not be interpreted as HTTPS"
  );
  assert.equal(
    getOriginFromHeaders(new Headers({ host: "example.com", "x-forwarded-proto": "https" })),
    "https://example.com",
    "forwarded HTTPS must be preserved"
  );
  assert.equal(
    getOriginFromHeaders(new Headers({ host: "example.com" })),
    "https://example.com",
    "public hosts should default to HTTPS"
  );
  assert.equal(
    getOriginFromHeaders(new Headers({ host: "example.com", "x-forwarded-proto": "http, https" })),
    "http://example.com",
    "the first forwarded protocol must be used"
  );
  assert.equal(
    shouldUseSecureCookies(new Headers({ host: "192.168.11.160:3000" })),
    false,
    "HTTP preview cookies must work on a private LAN address"
  );
  assert.equal(
    shouldUseSecureCookies(new Headers({ host: "example.com", "x-forwarded-proto": "http" })),
    true,
    "production cookies must remain secure for non-local hosts"
  );
}

function verifyBootstrapMapping(): void {
  const snapshot = mapSyncBootstrapResponse({
    success: true,
    data: {
      sync: { cursor: "cursor-1" },
      conversations: [
        {
          id: "conversation-1",
          title: "Shared chat",
          modelId: "core",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      activeConversationId: "conversation-1",
      initialMessages: [
        {
          id: "message-1",
          sender: "user",
          content: "Hello from another device",
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      preferences: { defaultModelId: "core", webSearchEnabled: true },
      devices: [{ id: "device-1" }, { id: "device-2" }],
      notifications: { unreadCount: 3 },
    },
  });

  assert.equal(snapshot.cursor, "cursor-1");
  assert.equal(snapshot.activeSessionId, "conversation-1");
  assert.equal(snapshot.sessions[0]?.modelId, "core");
  assert.equal(snapshot.sessions[0]?.messages[0]?.content, "Hello from another device");
  assert.equal(snapshot.messages[0]?.role, "user");
  assert.equal(snapshot.preferences?.webSearchEnabled, true);
  assert.equal(snapshot.activeDevicesCount, 2);
  assert.equal(snapshot.unreadNotifications, 3);
  assert.throws(() => mapSyncBootstrapResponse({ success: false }), /Bootstrap error/);
}

verifyRequestOrigins();
verifyBootstrapMapping();
console.log("Sync reliability checks passed.");
