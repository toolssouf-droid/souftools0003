/**
 * Comprehensive Turso Database Integration Verification Suite
 *
 * Verifies all 11 core migration pillars against Turso/libSQL:
 *  1. Strict Fail-Closed Config (no silent fallback)
 *  2. Schema & Idempotent Migrations + PRAGMA foreign_keys
 *  3. Transaction Atomicity & Rollback
 *  4. Users, Devices, Preferences, SyncEvents & SyncCursors
 *  5. Conversations, Messages & IDOR Ownership Isolation
 *  6. Projects, ProjectFiles & Cascade Deletion
 *  7. Memories, Settings, AccessLogs & Cross-User Isolation
 *  8. AES-256-GCM Security Vault & User/System Key Isolation
 *  9. WorkerQueue Claim/Lease Concurrency, Retry Backoff & Checkpoints
 * 10. AgentTaskStore, Subtasks DAG, Checkpoints & WhatsApp Auth/Pairing
 * 11. ScheduledTasks Claim/Lease, WatchHistory, Notifications, Audit & Health
 *
 * Usage:
 *   npx tsx scripts/verify-turso-migration.ts
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const TMP_DIR = path.resolve(process.cwd(), ".turso_verify_tmp");
const TMP_DB_PATH = path.join(TMP_DIR, "verify.db");
const TMP_DB_URL = `file:${TMP_DB_PATH}`;

// Ensure deterministic test encryption key if missing in shell environment
if (!process.env.DATA_ENCRYPTION_KEY && !process.env.ENCRYPTION_MASTER_KEY) {
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
}

import { validateTursoEnv } from "../lib/db/migrate";
import {
  getReadyDb,
  getTursoClient,
  resetDbConnection,
  ensureMigrationsRun,
  checkDatabaseHealth,
  DatabaseMaintenanceService,
  UserRepository,
  ConversationRepository,
  MemoryRepository,
  ProjectRepository,
  AgentRepository,
  WorkerJobRepository,
  WatchHistoryRepository,
  ScheduledTaskRepository,
  NotificationRepository,
  AuditRepository,
  WhatsAppAuthRepository,
  WhatsAppPairedUsersRepository,
  UserSessionRepository,
  RuntimeSessionRepository,
  RuntimeErrorRepository,
  PushSubscriptionRepository,
  TelegramRepository,
  SettingsRepository,
} from "../lib/db";
import * as schema from "../lib/db/schema";
import { eq } from "drizzle-orm";
import { KeyVault } from "../lib/security/vault";
import { recordSyncEvent, getSyncDelta, updateDeviceCursor } from "../lib/sync/syncEngine";
import { globalAgentTaskStore } from "../lib/agent/agentTaskStore";
import type { AgentState } from "../lib/agent/agentState";
import {
  resolveAuthUser,
  signAuthCookieToken,
  verifyAuthCookieToken,
  AUTH_SIG_COOKIE_NAME,
} from "../lib/auth/serverAuth";
import { serverErrorManager } from "../lib/errors/errorManager";
import { webPushManager } from "../lib/notifications/webPushManager";
import { telegramManager } from "../lib/telegram/telegramManager";
import { sandboxManager } from "../lib/sandbox/sandboxManager";
import { runPgJsonToTursoMigration } from "./migrate-pg-to-turso";
import { NextRequest } from "next/server";

const EXPECTED_TABLES = [
  "_schema_migrations",
  "user",
  "session",
  "account",
  "verification",
  "conversations",
  "messages",
  "message_attachments",
  "memories",
  "memory_access_logs",
  "memory_settings",
  "behavior_profiles",
  "ai_providers",
  "ai_models",
  "ai_keys",
  "ai_health",
  "ai_usage",
  "routing_logs",
  "storage_objects",
  "projects",
  "project_files",
  "runtime_sessions",
  "runtime_logs",
  "admin_logs",
  "settings",
  "analytics_events",
  "analytics_daily_aggregates",
  "analytics_tool_metrics",
  "analytics_model_metrics",
  "analytics_security_events",
  "analytics_system_snapshots",
  "agent_tasks",
  "agent_checkpoints",
  "agent_subtasks",
  "agent_events",
  "agent_tool_calls",
  "agent_artifacts",
  "agent_errors",
  "agent_runs",
  "worker_jobs",
  "user_devices",
  "user_preferences",
  "notifications",
  "sync_events",
  "sync_cursors",
  "encrypted_vault_keys",
  "watch_history",
  "scheduled_tasks",
  "user_learning_patterns",
  "whatsapp_auth_sessions",
  "whatsapp_paired_users",
  "runtime_errors",
  "push_subscriptions",
  "telegram_paired_users",
  "telegram_oauth_tokens",
];

async function runSuite(name: string, fn: () => Promise<void>) {
  const start = Date.now();
  await fn();
  console.log(`PASS [${Date.now() - start}ms] ${name}`);
}

async function main() {
  if (fs.existsSync(TMP_DIR)) {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const prevUrl = process.env.TURSO_DATABASE_URL;
  const prevToken = process.env.TURSO_AUTH_TOKEN;

  try {
    // ------------------------------------------------------------------
    // Suite 1: Strict Fail-Closed Config Validation
    // ------------------------------------------------------------------
    await runSuite("1. Strict Fail-Closed Turso Env Validation", async () => {
      delete process.env.TURSO_DATABASE_URL;
      delete process.env.TURSO_AUTH_TOKEN;
      assert.throws(() => validateTursoEnv(), /TURSO_DATABASE_URL is not configured/);

      process.env.TURSO_DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
      assert.throws(() => validateTursoEnv(), /PostgreSQL connection strings are unsupported/);

      process.env.TURSO_DATABASE_URL = "libsql://example-db.turso.io";
      assert.throws(() => validateTursoEnv(), /TURSO_AUTH_TOKEN is required/);

      process.env.TURSO_DATABASE_URL = TMP_DB_URL;
      const cfg = validateTursoEnv();
      assert.equal(cfg.isLocalFile, true);
      assert.equal(cfg.isRemote, false);
    });

    resetDbConnection();

    // ------------------------------------------------------------------
    // Suite 2: Idempotent Schema Migrations & Foreign Key Enforcement
    // ------------------------------------------------------------------
    await runSuite("2. Idempotent Schema Migrations & PRAGMA foreign_keys", async () => {
      await ensureMigrationsRun();
      // Reset flag and run a second time to verify idempotency
      global._soufMigrationsComplete = undefined;
      global._soufMigrationPromise = undefined;
      await ensureMigrationsRun();

      const client = getTursoClient();
      const fkRes = await client.execute("PRAGMA foreign_keys;");
      const fkEnabled = Number(Object.values(fkRes.rows[0] || {})[0] ?? 0);
      assert.equal(fkEnabled, 1, "PRAGMA foreign_keys must be enabled");

      const tablesRes = await client.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`
      );
      const foundTables = new Set((tablesRes.rows || []).map((r: any) => String(r.name)));
      for (const expected of EXPECTED_TABLES) {
        assert.ok(foundTables.has(expected), `Expected table missing from Turso schema: ${expected}`);
      }
    });

    // ------------------------------------------------------------------
    // Suite 3: Transaction Atomicity & Rollback
    // ------------------------------------------------------------------
    await runSuite("3. Transaction Atomicity & Rollback", async () => {
      const db = await getReadyDb();
      const rollbackUserId = "usr_rollback_test";

      await assert.rejects(async () => {
        await db.transaction(async (tx) => {
          await tx.insert(schema.users).values({
            id: rollbackUserId,
            email: "rollback@souftools.test",
            name: "Rollback User",
          });
          throw new Error("Simulated mid-transaction failure");
        });
      }, /Simulated mid-transaction failure/);

      const found = await UserRepository.getById(rollbackUserId);
      assert.equal(found, null, "Rolled-back user row must not persist");
    });

    // ------------------------------------------------------------------
    // Suite 4: Users, Preferences, Devices, SyncEvents & FK Safety
    // ------------------------------------------------------------------
    await runSuite("4. Users, Preferences, Devices, Sync & FK Constraints", async () => {
      const db = await getReadyDb();

      // Verify FK constraint blocks orphan preference insert
      await assert.rejects(async () => {
        await db.insert(schema.userPreferences).values({
          id: "pref_orphan",
          userId: "non_existent_user_fk_test",
        });
      });

      const userA = await UserRepository.upsertUser({
        id: "usr_verify_a",
        email: "usera@souftools.test",
        displayName: "User A",
      });
      assert.equal(userA.id, "usr_verify_a");

      await UserRepository.upsertUser({
        id: "usr_verify_b",
        email: "userb@souftools.test",
        displayName: "User B",
      });

      await db.insert(schema.userDevices).values({
        id: "dev_a_1",
        userId: "usr_verify_a",
        name: "Chrome Desktop",
        deviceType: "desktop",
        browser: "Chrome",
        os: "Linux",
      });

      await recordSyncEvent({
        userId: "usr_verify_a",
        entityType: "device",
        entityId: "dev_a_1",
        operation: "created",
        payload: { test: true },
        deviceId: "dev_a_0",
      });

      const deltaRes = await getSyncDelta({ userId: "usr_verify_a", cursor: new Date(0).toISOString() });
      assert.equal(deltaRes.events.length, 1);
      await updateDeviceCursor("usr_verify_a", "dev_a_1", new Date(), deltaRes.events[0].id);
    });

    // ------------------------------------------------------------------
    // Suite 5: Conversations, Messages & IDOR Ownership Isolation
    // ------------------------------------------------------------------
    await runSuite("5. Conversations, Messages & IDOR Isolation", async () => {
      await ConversationRepository.saveConversation("usr_verify_a", {
        id: "conv_verify_1",
        title: "Turso Test Chat",
        modelId: "spark",
        messages: [
          { id: "msg_1", role: "user", sender: "user", content: "Hello Turso" },
          { id: "msg_2", role: "model", sender: "assistant", content: "Ready!" },
        ],
      });

      const ownerView = await ConversationRepository.getConversationById("conv_verify_1", "usr_verify_a");
      assert.ok(ownerView);
      assert.equal(ownerView.messages.length, 2);

      const attackerView = await ConversationRepository.getConversationById("conv_verify_1", "usr_verify_b");
      assert.equal(attackerView, null, "Non-owner must be blocked from reading conversation");

      await ConversationRepository.deleteConversation("usr_verify_b", "conv_verify_1");
      assert.ok(
        await ConversationRepository.getConversationById("conv_verify_1", "usr_verify_a"),
        "Non-owner delete must not affect owner conversation"
      );

      await ConversationRepository.deleteConversation("usr_verify_a", "conv_verify_1");
      assert.equal(await ConversationRepository.getConversationById("conv_verify_1", "usr_verify_a"), null);
    });

    // ------------------------------------------------------------------
    // Suite 6: Projects, ProjectFiles & Cascade Deletion
    // ------------------------------------------------------------------
    await runSuite("6. Projects, Multi-File Persistence & Cascade Delete", async () => {
      await ProjectRepository.upsertProject({
        id: "proj_verify_1",
        userId: "usr_verify_a",
        name: "Verify App",
        framework: "react_nextjs",
      });

      await ProjectRepository.saveProjectFiles("proj_verify_1", {
        "package.json": '{"name":"verify-app"}',
        "src/index.ts": "console.log('v1');",
      });
      await ProjectRepository.saveProjectFiles("proj_verify_1", {
        "src/index.ts": "console.log('v2');",
      });

      const loaded = await ProjectRepository.getProject("proj_verify_1", "usr_verify_a");
      assert.ok(loaded);
      assert.equal(loaded.files["src/index.ts"].content, "console.log('v2');");
      assert.equal(loaded.files["src/index.ts"].version, 2);

      const blocked = await ProjectRepository.deleteProject("proj_verify_1", "usr_verify_b");
      assert.equal(blocked, false, "Cross-user project delete must be rejected");

      const deleted = await ProjectRepository.deleteProject("proj_verify_1", "usr_verify_a");
      assert.equal(deleted, true);

      const db = await getReadyDb();
      const remainingFiles = await db
        .select()
        .from(schema.projectFiles)
        .where(eq(schema.projectFiles.projectId, "proj_verify_1"));
      assert.equal(remainingFiles.length, 0, "Project files must cascade delete");
    });

    // ------------------------------------------------------------------
    // Suite 7: Memories, Settings & Access Logs
    // ------------------------------------------------------------------
    await runSuite("7. Memories, Settings & Cross-User Isolation", async () => {
      const mem = await MemoryRepository.saveMemory("usr_verify_a", {
        id: "mem_verify_1",
        type: "USER_FACT",
        content: "Prefers Turso libSQL with strict Drizzle schemas",
        tags: ["turso", "drizzle"],
      });
      assert.equal(mem.id, "mem_verify_1");

      const ownerMem = await MemoryRepository.getById("usr_verify_a", "mem_verify_1");
      assert.ok(ownerMem);
      const otherMem = await MemoryRepository.getById("usr_verify_b", "mem_verify_1");
      assert.equal(otherMem, null);

      await MemoryRepository.saveSettings("usr_verify_a", { maxContextItems: 12, retentionDays: 90 });
      const settings = await MemoryRepository.getSettings("usr_verify_a");
      assert.equal(settings.maxContextItems, 12);
      assert.equal(settings.retentionDays, 90);

      await MemoryRepository.logAccess("usr_verify_a", {
        action: "retrieve",
        memoryId: "mem_verify_1",
        promptSnippet: "turso setup",
        relevanceScore: 0.95,
      });

      await MemoryRepository.deleteMemory("usr_verify_a", "mem_verify_1", true);
      const afterSoftDelete = await MemoryRepository.listByUser("usr_verify_a", { status: "active" });
      assert.equal(afterSoftDelete.length, 0);
    });

    // ------------------------------------------------------------------
    // Suite 8: AES-256-GCM Security Vault & User/System Isolation
    // ------------------------------------------------------------------
    await runSuite("8. AES-256-GCM Vault Encryption, Isolation & Rotation", async () => {
      // Before any system key exists, User B cannot decrypt User A's key
      const userAStored = await KeyVault.storeProviderKey({
        providerId: "gemini_verify",
        plainKey: "AIzaSyUserAKeySecretValue87654321",
        userId: "usr_verify_a",
        keyLabel: "User A Key",
      });
      assert.equal(userAStored.success, true);

      const userADecrypted = await KeyVault.getDecryptedKey({
        providerId: "gemini_verify",
        userId: "usr_verify_a",
      });
      assert.equal(userADecrypted, "AIzaSyUserAKeySecretValue87654321");

      const userBDecryptedBeforeSys = await KeyVault.getDecryptedKey({
        providerId: "gemini_verify",
        userId: "usr_verify_b",
      });
      assert.equal(userBDecryptedBeforeSys, null, "User B must not see User A's encrypted key");

      const sysStored = await KeyVault.storeProviderKey({
        providerId: "gemini_verify",
        plainKey: "AIzaSySystemKeySecretValue12345678",
        keyLabel: "System Primary",
      });
      assert.equal(sysStored.success, true);

      const sysDecrypted = await KeyVault.getDecryptedKey({ providerId: "gemini_verify" });
      assert.equal(sysDecrypted, "AIzaSySystemKeySecretValue12345678");

      const rotated = await KeyVault.rotateKey({
        providerId: "gemini_verify",
        newPlainKey: "AIzaSyUserAKeyRotatedValue99999999",
        userId: "usr_verify_a",
      });
      assert.equal(rotated.success, true);

      const afterRotate = await KeyVault.getDecryptedKey({
        providerId: "gemini_verify",
        userId: "usr_verify_a",
      });
      assert.equal(afterRotate, "AIzaSyUserAKeyRotatedValue99999999");

      const db = await getReadyDb();
      await db.delete(schema.encryptedVaultKeys).where(eq(schema.encryptedVaultKeys.providerId, "gemini_verify"));
    });

    // ------------------------------------------------------------------
    // Suite 9: WorkerQueue Claim/Lease Concurrency, Retry & Checkpoints
    // ------------------------------------------------------------------
    await runSuite("9. WorkerQueue Atomic Claim/Lease, Retry, Cancel & Resume", async () => {
      const job = await WorkerJobRepository.enqueue({
        id: "job_verify_1",
        type: "verify_job",
        payload: { hello: "world" },
        userId: "usr_verify_a",
        maxAttempts: 2,
      });
      assert.equal(job.status, "queued");

      // Simulate two concurrent workers trying to claim the exact same job
      const [claim1, claim2] = await Promise.all([
        WorkerJobRepository.claimSpecificJob("job_verify_1", "worker_alpha", 60_000),
        WorkerJobRepository.claimSpecificJob("job_verify_1", "worker_beta", 60_000),
      ]);
      const claims = [claim1, claim2].filter(Boolean);
      assert.equal(claims.length, 1, "Only one worker may claim a job atomically");
      const winner = claims[0]!.leaseOwner!;

      assert.equal(await WorkerJobRepository.renewLease("job_verify_1", winner, 90_000), true);
      await WorkerJobRepository.updateCheckpoint("job_verify_1", { step: 2, note: "checkpointed" });

      // Simulate failure -> backoff re-queue
      const retried = await WorkerJobRepository.failJob("job_verify_1", winner, "Transient error", 10);
      assert.equal(retried?.status, "queued");
      assert.equal(retried?.attempts, 1);

      // Simulate stale lease expiration & recovery
      await new Promise((r) => setTimeout(r, 25));
      const claimedAgain = await WorkerJobRepository.claimSpecificJob("job_verify_1", "worker_gamma", 1);
      assert.ok(claimedAgain);
      await new Promise((r) => setTimeout(r, 15));
      const recoveredCount = await WorkerJobRepository.recoverStaleLeases();
      assert.ok(recoveredCount >= 1, "Expired lease must be recovered back to queued");

      await WorkerJobRepository.cancelJob("job_verify_1", "usr_verify_a");
      const cancelled = await WorkerJobRepository.getById("job_verify_1", "usr_verify_a");
      assert.equal(cancelled?.status, "cancelled");

      const resumed = await WorkerJobRepository.resumeJob("job_verify_1", "usr_verify_a");
      assert.equal(resumed?.status, "queued");

      const finalClaim = await WorkerJobRepository.claimSpecificJob("job_verify_1", "worker_final", 60_000);
      assert.ok(finalClaim);
      const completed = await WorkerJobRepository.completeJob("job_verify_1", "worker_final", { ok: true });
      assert.equal(completed?.status, "completed");
    });

    // ------------------------------------------------------------------
    // Suite 10: AgentTaskStore, Subtasks DAG, Checkpoints & WhatsApp Repos
    // ------------------------------------------------------------------
    await runSuite("10. Agent TaskStore, Checkpoints, Subtasks & WhatsApp Repos", async () => {
      const initialState: AgentState = {
        taskId: "agent_verify_1",
        status: "planning",
        userRequest: "Build Turso verified service",
        goal: "Build Turso verified service",
        plan: [],
        currentStep: "",
        completedSteps: [],
        observations: [],
        toolCalls: [],
        toolResults: {},
        errors: [],
        iteration: 0,
        maxSteps: 5,
        startedAt: Date.now(),
        completedAt: null,
        agentSteps: [],
        activities: [],
        toolBudget: {},
        budgetUsed: {},
        metadata: { userId: "usr_verify_a" },
      };

      const state = await globalAgentTaskStore.createTaskAsync("agent_verify_1", initialState);
      assert.equal(state.taskId, "agent_verify_1");

      state.status = "executing";
      state.iteration = 2;
      state.plan = ["Step 1", "Step 2"];
      await globalAgentTaskStore.saveCheckpointAsync("agent_verify_1", 2, "step_2_plan", state);

      // Clear in-memory cache so getTaskAsync must reconstruct cleanly from Turso
      globalAgentTaskStore.deleteTask("agent_verify_1");

      const reloaded = await globalAgentTaskStore.getTaskAsync("agent_verify_1", "usr_verify_a");
      assert.ok(reloaded);
      assert.equal(reloaded.iteration, 2);
      assert.deepEqual(reloaded.plan, ["Step 1", "Step 2"]);

      const idorBlocked = await globalAgentTaskStore.getTaskAsync("agent_verify_1", "usr_verify_b");
      assert.equal(idorBlocked, undefined, "Non-owner must not read another user's agent task");

      await AgentRepository.createSubtask({
        id: "sub_verify_1",
        taskId: "agent_verify_1",
        title: "Verify Schema",
        agentWorker: "backend_engineer",
        dependencies: [],
      });
      await AgentRepository.updateSubtask("sub_verify_1", {
        status: "completed",
        outputResult: { ok: true },
        durationMs: 42,
      });
      const subs = await AgentRepository.getSubtasksByTaskId("agent_verify_1");
      assert.equal(subs.length, 1);
      assert.equal(subs[0].status, "completed");

      await globalAgentTaskStore.cancelTaskAsync("agent_verify_1", "usr_verify_a");
      const afterCancel = await globalAgentTaskStore.getTaskAsync("agent_verify_1", "usr_verify_a");
      assert.equal(afterCancel?.status, "cancelled");

      // WhatsApp Auth & Pairing
      await WhatsAppAuthRepository.setMany("wa_sess_test", [
        { keyId: "creds", data: JSON.stringify({ me: "123" }) },
        { keyId: "pre-key-1", data: JSON.stringify({ k: "v" }) },
      ]);
      assert.equal(await WhatsAppAuthRepository.hasSession("wa_sess_test"), true);
      const loadedKeys = await WhatsAppAuthRepository.getMany("wa_sess_test", ["creds", "pre-key-1"]);
      assert.equal(Object.keys(loadedKeys).length, 2);
      await WhatsAppAuthRepository.clearSession("wa_sess_test");
      assert.equal(await WhatsAppAuthRepository.hasSession("wa_sess_test"), false);

      await WhatsAppPairedUsersRepository.link("213555000111", {
        userId: "usr_verify_a",
        email: "usera@souftools.test",
        firstName: "UserA",
      });
      const paired = await WhatsAppPairedUsersRepository.getByPhone("213555000111");
      assert.equal(paired?.userId, "usr_verify_a");
      await WhatsAppPairedUsersRepository.unlink("213555000111");
    });

    // ------------------------------------------------------------------
    // Suite 11: ScheduledTasks Claim, WatchHistory, Notifications & Health
    // ------------------------------------------------------------------
    await runSuite("11. ScheduledTasks Claim, WatchHistory, Notifications & Health", async () => {
      const dueTs = Date.now() - 1000;
      await ScheduledTaskRepository.createTask({
        id: "sched_verify_1",
        userId: "usr_verify_a",
        channel: "web",
        title: "Turso scheduled reminder",
        targetTimestamp: dueTs,
        targetDateIso: new Date(dueTs).toISOString(),
      });

      const [c1, c2] = await Promise.all([
        ScheduledTaskRepository.claimDueTasks("sched_w1", 60_000),
        ScheduledTaskRepository.claimDueTasks("sched_w2", 60_000),
      ]);
      assert.equal(c1.length + c2.length, 1, "Due scheduled task must be claimed by exactly one worker");

      await ScheduledTaskRepository.rescheduleRecurringTask(
        "sched_verify_1",
        Date.now() + 86_400_000,
        new Date(Date.now() + 86_400_000).toISOString(),
        { delivered: true }
      );
      const rescheduled = await ScheduledTaskRepository.getTaskById("sched_verify_1");
      assert.equal(rescheduled?.status, "pending");

      await WatchHistoryRepository.saveProgress("usr_verify_a", "media_turso_demo", 120, 300, false);
      const wh = await WatchHistoryRepository.getProgress("usr_verify_a", "media_turso_demo");
      assert.equal(wh?.positionSeconds, 120);

      const notif = await NotificationRepository.createNotification({
        id: "notif_verify_1",
        userId: "usr_verify_a",
        title: "Turso Ready",
        message: "All suites passing",
        type: "success",
      });
      assert.ok(notif);
      assert.equal(await NotificationRepository.markAsRead("notif_verify_1", "usr_verify_a"), true);

      await AuditRepository.logAction({
        adminUserId: "usr_verify_a",
        action: "TURSO_VERIFY",
        resourceType: "database",
      });

      const health = await checkDatabaseHealth();
      assert.equal(health.connected, true);
      assert.equal(health.engine, "turso_local");

      const healthStats = await DatabaseMaintenanceService.getDatabaseHealthStats();
      assert.equal(healthStats.status, "healthy");
      assert.ok(healthStats.tableCounts.users >= 2);
    });

    // ------------------------------------------------------------------
    // Suite 12: Runtime Errors, WebPush, Telegram, Sandbox & Restart Persistence
    // ------------------------------------------------------------------
    await runSuite("12. Runtime Errors, WebPush, Telegram, Sandbox & Restart Recovery", async () => {
      // 12a. RuntimeSessionRepository + Admin listing + User scoping
      await RuntimeSessionRepository.upsertSession({
        id: "rt_sess_verify_1",
        userId: "usr_verify_a",
        provider: "native_sandbox",
        sandboxId: "sb_verify_1",
        status: "running",
        memoryMb: 512,
        cpuCores: 1,
        expiresAt: new Date(Date.now() + 3600_000),
      });
      const rtOwn = await RuntimeSessionRepository.getById("rt_sess_verify_1");
      assert.ok(rtOwn);
      assert.equal(rtOwn.userId, "usr_verify_a");
      const rtListA = await RuntimeSessionRepository.listByUser("usr_verify_a", 20);
      assert.ok(rtListA.some((r) => r.id === "rt_sess_verify_1"));
      const rtListB = await RuntimeSessionRepository.listByUser("usr_verify_b", 20);
      assert.equal(rtListB.some((r) => r.id === "rt_sess_verify_1"), false, "User B listByUser must not return User A session");
      const rtAll = await RuntimeSessionRepository.listAll(20);
      assert.ok(rtAll.some((r) => r.id === "rt_sess_verify_1"));

      // 12b. ServerErrorManager persisted solely to Turso runtime_errors
      await serverErrorManager.ensureLoaded();
      const captured = serverErrorManager.recordError({
        title: "Turso Verification Synthetic Error",
        message: "Error persistence test check",
        category: "database",
        severity: "medium",
      });
      await serverErrorManager.flushPendingWrites();

      const errCountRes = await RuntimeErrorRepository.listAll(20);
      assert.ok(errCountRes.some((e) => e.id === captured.id));

      // 12c. WebPushManager VAPID keys & subscriptions stored in Turso
      await webPushManager.ensureInitialized();
      const vapidPub = await webPushManager.getPublicKeyAsync();
      assert.ok(vapidPub && vapidPub.length > 20, "VAPID public key must auto-generate in Turso");
      await webPushManager.saveSubscription(
        "usr_verify_a",
        {
          endpoint: "https://push.example.test/sub/verify-1",
          keys: { p256dh: "p256dh-verify-key", auth: "auth-verify-key" },
        },
        "VerifyAgent"
      );
      const userSubs = await webPushManager.getSubscriptionsForUser("usr_verify_a");
      assert.equal(userSubs.length, 1);

      // 12d. TelegramManager encrypted token, pairing & session persistence in Turso
      await telegramManager.ensureInitialized();
      telegramManager.updateConfig({ botToken: "123456:VERIFY_TELEGRAM_SECRET_TOKEN", botUsername: "VerifyBot" });
      await telegramManager.setGmailToken("99887766", "ya29.verify_gmail_token", "usera@souftools.test", "usr_verify_a", false);
      await telegramManager.flushPendingWrites();

      // Simulate restart / DB connection reset + re-init
      resetDbConnection();
      await serverErrorManager.ensureLoaded(true);
      await webPushManager.ensureInitialized(true);
      await telegramManager.ensureInitialized(true);
      await sandboxManager.ensureLimitsLoaded(true);

      const reloadedErrors = serverErrorManager.getErrors();
      assert.ok(reloadedErrors.some((e) => e.id === captured.id), "Error must survive DB reset");
      assert.equal(await webPushManager.getPublicKeyAsync(), vapidPub, "VAPID public key must survive DB reset");
      const reloadedTgGmail = telegramManager.getGmailDetails("99887766");
      assert.equal(reloadedTgGmail?.accessToken, "ya29.verify_gmail_token", "Encrypted Telegram OAuth token must survive DB reset");
      assert.equal(telegramManager.getConfig().botToken, "123456:VERIFY_TELEGRAM_SECRET_TOKEN");

      // Verify raw DB setting encrypted Telegram token (not plaintext)
      const rawTgSetting = await SettingsRepository.getSetting<any>("telegram_gateway_config");
      assert.ok(rawTgSetting?.botToken && rawTgSetting.botToken !== "123456:VERIFY_TELEGRAM_SECRET_TOKEN", "Bot token must be encrypted in Turso settings");
    });

    // ------------------------------------------------------------------
    // Suite 13: Signed Session Auth, Forged Header Rejection & Revocation
    // ------------------------------------------------------------------
    await runSuite("13. Signed Session Auth, Header Forgery Rejection & DB Revocation", async () => {
      const tokenId = `tok_verify_${crypto.randomBytes(8).toString("hex")}`;
      const expiresAt = new Date(Date.now() + 3600_000);
      await UserSessionRepository.createSession({
        id: `sess_${tokenId}`,
        userId: "usr_verify_a",
        token: tokenId,
        expiresAt,
      });

      const signedCookie = signAuthCookieToken({
        sid: tokenId,
        uid: "usr_verify_a",
        email: "usera@souftools.test",
        role: "user",
        exp: expiresAt.getTime(),
      });

      // Verify valid signed token
      const decoded = verifyAuthCookieToken(signedCookie);
      assert.equal(decoded?.uid, "usr_verify_a");

      // Forged x-user-email without cookie MUST fail closed (null)
      const forgedReq = new NextRequest("http://localhost:3000/api/v1/chat/sessions", {
        headers: {
          "x-user-email": "toolssouf@gmail.com",
          "x-user-id": "usr_admin_forged",
        },
      });
      const forgedResolved = await resolveAuthUser(forgedReq);
      assert.equal(forgedResolved, null, "Forged x-user-email header must NEVER authenticate");

      // Tampered cookie signature MUST fail closed (null)
      const tamperedCookie = signedCookie.slice(0, -4) + "abcd";
      const tamperedReq = new NextRequest("http://localhost:3000/api/v1/chat/sessions", {
        headers: { cookie: `${AUTH_SIG_COOKIE_NAME}=${tamperedCookie}` },
      });
      assert.equal(await resolveAuthUser(tamperedReq), null, "Tampered signed session must be rejected");

      // Valid signed cookie backed by active DB session resolves authenticated user
      const validReq = new NextRequest("http://localhost:3000/api/v1/chat/sessions", {
        headers: { cookie: `${AUTH_SIG_COOKIE_NAME}=${signedCookie}` },
      });
      const resolvedValid = await resolveAuthUser(validReq);
      assert.equal(resolvedValid?.id, "usr_verify_a");

      // Revoking session in Turso immediately invalidates token even before exp
      await UserSessionRepository.revokeByToken(tokenId);
      const afterRevoke = await resolveAuthUser(validReq);
      assert.equal(afterRevoke, null, "Revoked DB session must invalidate signed cookie");
    });

    // ------------------------------------------------------------------
    // Suite 14: Idempotent Legacy PG-JSON -> Turso Import Verification
    // ------------------------------------------------------------------
    await runSuite("14. Idempotent PG-JSON -> Turso Migration Script", async () => {
      const sampleJsonPath = path.join(TMP_DIR, "legacy-sample.json");
      const migDbPath = path.join(TMP_DIR, "mig-target.db");
      const samplePayload = {
        tables: {
          user: [
            {
              id: "usr_mig_1",
              email: "migrated@souftools.test",
              name: "Migrated User",
              role: "user",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
          runtime_errors: [
            {
              id: "err_mig_1",
              title: "Legacy PG Error",
              message: "Imported from PG export",
              status: "resolved",
              severity: "warning",
              category: "system",
              timestamp: "2026-01-01T00:00:00.000Z",
              lastOccurrence: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        },
      };
      fs.writeFileSync(sampleJsonPath, JSON.stringify(samplePayload), "utf-8");

      const firstRun = await runPgJsonToTursoMigration({
        sourceJson: sampleJsonPath,
        targetUrl: `file:${migDbPath}`,
        dryRun: false,
        backupDir: path.join(TMP_DIR, "backups"),
      });
      assert.equal(firstRun.success, true);
      assert.equal(firstRun.totalInsertedRows, 2);

      // Re-run second time: must be 100% idempotent with 0 newly inserted duplicate rows
      const secondRun = await runPgJsonToTursoMigration({
        sourceJson: sampleJsonPath,
        targetUrl: `file:${migDbPath}`,
        dryRun: false,
        backupDir: path.join(TMP_DIR, "backups"),
      });
      assert.equal(secondRun.success, true);
      assert.equal(secondRun.totalInsertedRows, 0, "Re-running migration must insert 0 duplicate rows");
    });

    console.log("\nALL 14 TURSO VERIFICATION SUITES PASSED SUCCESSFULLY.");
  } finally {
    resetDbConnection();
    if (prevUrl === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = prevUrl;
    if (prevToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = prevToken;

    if (fs.existsSync(TMP_DIR)) {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    }
  }
}

main().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
