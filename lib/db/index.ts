/**
 * SoufTools Database Service & Repository Layer
 * 100% Turso (libSQL) Architecture via Drizzle ORM & @libsql/client
 *
 * Features:
 * - Single explicit database engine: Turso Cloud (`libsql://` / `https://`) or local libSQL file (`file:`).
 * - Zero silent fallback to PostgreSQL, PGlite, Firestore, or memory.
 * - Connection pooling / singleton caching across Next.js HMR, automatic retry with exponential backoff,
 *   transactional multi-step operations, and atomic Claim/Lease semantics for distributed workers & agents.
 */

import { createClient, type Client } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { eq, desc, and, or, lte, lt, gt, inArray, isNull, sql } from "drizzle-orm";
import {
  ensureAgentTaskLeaseColumns,
  MIGRATION_STATEMENTS,
  validateTursoEnv,
  type TursoConnectionConfig,
} from "./migrate";
import {
  isRetryableTursoError,
  isTursoEndpointNotFound,
} from "./tursoErrors";
import { isUserAdmin } from "@/lib/auth/adminRoles";
import { terminalLogger } from "@/lib/logger/terminalLogger";
import { encryptKey, decryptKey } from "@/lib/encryption";
import fs from "fs";
import path from "path";

export type TursoDatabase = LibSQLDatabase<typeof schema>;

// Global cached singletons for Next.js hot-reloads
declare global {
  var _soufTursoClient: Client | undefined;
  var _soufDrizzleDb: TursoDatabase | undefined;
  var _soufTursoConfigKey: string | undefined;
  var _soufMigrationPromise: Promise<void> | undefined;
  var _soufMigrationsComplete: boolean | undefined;
}

function isFatalClientError(err: unknown): boolean {
  const msg = String((err as any)?.message || err || "").toLowerCase();
  return msg.includes("client is closed") || msg.includes("stream closed") || msg.includes("connection closed");
}

function ensureLocalFileDir(url: string) {
  if (!url.toLowerCase().startsWith("file:")) return;
  const rawPath = url.slice(5).split("?")[0];
  if (!rawPath || rawPath === ":memory:") return;
  const resolved = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getTursoConfig(): TursoConnectionConfig {
  return validateTursoEnv();
}

export function resetDbConnection(): void {
  if (global._soufTursoClient) {
    try {
      global._soufTursoClient.close();
    } catch (closeError) {
      console.error("[Turso] Failed to close the database client cleanly:", closeError);
    }
  }
  global._soufTursoClient = undefined;
  global._soufDrizzleDb = undefined;
  global._soufTursoConfigKey = undefined;
  global._soufMigrationPromise = undefined;
  global._soufMigrationsComplete = undefined;
}

export async function closeDb(): Promise<void> {
  resetDbConnection();
}

export function getTursoClient(): Client {
  const cfg = validateTursoEnv();
  const configKey = `${cfg.url}|${cfg.authToken || ""}`;

  if (global._soufTursoClient && global._soufTursoConfigKey === configKey) {
    return global._soufTursoClient;
  }

  if (global._soufTursoClient && global._soufTursoConfigKey !== configKey) {
    resetDbConnection();
  }

  if (cfg.isLocalFile) {
    ensureLocalFileDir(cfg.url);
  }

  const client = createClient({
    url: cfg.url,
    authToken: cfg.authToken,
  });

  global._soufTursoClient = client;
  global._soufTursoConfigKey = configKey;
  return client;
}

async function seedLegacyUsersIfPresent(client: Client): Promise<void> {
  try {
    const legacyUsersPath = path.join(process.cwd(), ".server_vault_data", "users.json");
    if (!fs.existsSync(legacyUsersPath)) return;
    const raw = fs.readFileSync(legacyUsersPath, "utf-8");
    if (!raw || !raw.trim()) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;

    for (const [uid, u] of Object.entries(parsed) as [string, any][]) {
      if (u && u.email) {
        const cleanEmail = String(u.email).toLowerCase().trim();
        const isAdmin = isUserAdmin(cleanEmail) || u.role === "super_admin";
        const role = isAdmin ? "super_admin" : (u.role || "user");
        const name = u.displayName || u.name || cleanEmail.split("@")[0];
        const createdMs = new Date(u.createdAt || Date.now()).getTime();
        await client.execute({
          sql: `INSERT OR IGNORE INTO "user" (id, email, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
          args: [uid, cleanEmail, name, role, createdMs, createdMs],
        });
      }
    }
  } catch (seedErr) {
    console.warn("[Turso] Legacy user seed notice:", seedErr);
  }
}

export async function ensureMigrationsRun(): Promise<void> {
  if (global._soufMigrationsComplete) return;
  if (global._soufMigrationPromise) {
    return global._soufMigrationPromise;
  }

  global._soufMigrationPromise = (async () => {
    const client = getTursoClient();
    const cfg = validateTursoEnv();

    await client.execute("PRAGMA foreign_keys = ON;");
    if (cfg.isLocalFile) {
      await client.execute("PRAGMA busy_timeout = 5000;");
      await client.execute("PRAGMA journal_mode = WAL;");
    }

    for (const stmt of MIGRATION_STATEMENTS) {
      await client.execute(stmt);
    }

    await ensureAgentTaskLeaseColumns(client);

    await client.execute({
      sql: `INSERT OR IGNORE INTO "_schema_migrations" (id, version, applied_at) VALUES (?, ?, ?)`,
      args: ["turso_v1_initial_schema", 1, Date.now()],
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO "_schema_migrations" (id, version, applied_at) VALUES (?, ?, ?)`,
      args: ["turso_v2_full_platform_schema", 2, Date.now()],
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO "_schema_migrations" (id, version, applied_at) VALUES (?, ?, ?)`,
      args: ["turso_v3_nexus_engine_schema", 3, Date.now()],
    });
    await client.execute({
      sql: `INSERT OR IGNORE INTO "_schema_migrations" (id, version, applied_at) VALUES (?, ?, ?)`,
      args: ["turso_v4_agent_task_lease_fencing", 4, Date.now()],
    });

    await seedLegacyUsersIfPresent(client);
    global._soufMigrationsComplete = true;
    terminalLogger.db(`Connected to Turso (${cfg.isRemote ? "Cloud" : "Local libSQL"}) & verified schema.`, true);
  })();

  try {
    await global._soufMigrationPromise;
  } catch (err) {
    global._soufMigrationPromise = undefined;
    throw err;
  }
}

export function getDb(): TursoDatabase {
  const client = getTursoClient();
  if (!global._soufDrizzleDb) {
    global._soufDrizzleDb = drizzle(client, { schema });
  }
  if (!global._soufMigrationsComplete && !global._soufMigrationPromise) {
    ensureMigrationsRun().catch((err) => {
      console.error("[Turso] Background schema initialization error:", err?.message || err);
    });
  }
  return global._soufDrizzleDb;
}

export async function getReadyDb(): Promise<TursoDatabase> {
  const database = getDb();
  await ensureMigrationsRun();
  return database;
}

export function isDbConnected(): boolean {
  try {
    validateTursoEnv();
    return Boolean(getTursoClient());
  } catch {
    return false;
  }
}

export async function executeWithRetry<T>(
  operation: (database: TursoDatabase) => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 120;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const database = await getReadyDb();
      return await operation(database);
    } catch (err) {
      lastError = err;
      if (isTursoEndpointNotFound(err)) {
        throw new Error(
          "[Turso] The remote endpoint returned HTTP 404. Verify that TURSO_DATABASE_URL points to an active database and TURSO_AUTH_TOKEN belongs to it.",
          { cause: err }
        );
      }
      if (isFatalClientError(err)) {
        resetDbConnection();
      }
      if (attempt >= maxAttempts || (!isRetryableTursoError(err) && !isFatalClientError(err))) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 60);
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  engine: "turso_cloud" | "turso_local";
  latencyMs: number;
  serverVersion: string;
  sizeBytes: number;
  error?: string;
}> {
  const startedAt = Date.now();
  try {
    const cfg = validateTursoEnv();
    await ensureMigrationsRun();
    const client = getTursoClient();

    const verRes = await client.execute("SELECT sqlite_version() AS version");
    const serverVersion = String((verRes.rows[0] as any)?.version || "libSQL");

    let sizeBytes = 0;
    try {
      const pageCountRes = await client.execute("PRAGMA page_count;");
      const pageSizeRes = await client.execute("PRAGMA page_size;");
      const pageCount = Number((pageCountRes.rows[0] as any)?.page_count ?? Object.values(pageCountRes.rows[0] || {})[0] ?? 0);
      const pageSize = Number((pageSizeRes.rows[0] as any)?.page_size ?? Object.values(pageSizeRes.rows[0] || {})[0] ?? 4096);
      sizeBytes = pageCount * pageSize;
    } catch (metricsError) {
      console.warn("[Turso] Could not read local database size metrics:", metricsError);
    }

    return {
      connected: true,
      engine: cfg.isRemote ? "turso_cloud" : "turso_local",
      latencyMs: Date.now() - startedAt,
      serverVersion: `Turso libSQL (${serverVersion})`,
      sizeBytes,
    };
  } catch (err: any) {
    return {
      connected: false,
      engine: "turso_cloud",
      latencyMs: Date.now() - startedAt,
      serverVersion: "unavailable",
      sizeBytes: 0,
      error: err?.message || String(err),
    };
  }
}

// Proxied Drizzle ORM instance ensuring lazy initialization on demand
export const db = new Proxy({} as TursoDatabase, {
  get(_target, prop) {
    const instance = getDb() as any;
    const val = instance[prop];
    return typeof val === "function" ? val.bind(instance) : val;
  },
}) as TursoDatabase;

function chunkArray<T>(items: T[], chunkSize = 400): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function toTimestampMs(val: unknown): number {
  if (val instanceof Date) return val.getTime();
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string") {
    const parsed = Date.parse(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

// ==========================================
// 1. User Repository (Turso)
// ==========================================

export const UserRepository = {
  async getById(userId: string) {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);
      return rows[0] || null;
    } catch (err) {
      console.error("[Turso UserRepository.getById] error:", err);
      return null;
    }
  },

  async getByEmail(email: string) {
    const cleanEmail = email.toLowerCase().trim();
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.users)
        .where(sql`lower(trim(${schema.users.email})) = ${cleanEmail}`)
        .limit(1);
      return rows[0] || null;
    } catch (err) {
      console.error("[Turso UserRepository.getByEmail] error:", err);
      return null;
    }
  },

  async upsertUser(data: {
    id: string;
    email: string;
    displayName?: string;
    photoUrl?: string;
    role?: string;
  }) {
    const cleanEmail = data.email.toLowerCase().trim();
    const isAdmin = isUserAdmin(cleanEmail);
    const existing = await this.getById(data.id);
    const role = isAdmin
      ? "super_admin"
      : existing?.role === "admin" || existing?.role === "super_admin"
      ? existing.role
      : "user";
    const database = await getReadyDb();
    const now = new Date();

    try {
      if (existing) {
        const updated = await database
          .update(schema.users)
          .set({
            email: cleanEmail,
            name: data.displayName || existing.name,
            image: data.photoUrl || existing.image,
            role: existing.role === "super_admin" ? "super_admin" : role,
            updatedAt: now,
          })
          .where(eq(schema.users.id, data.id))
          .returning();
        return updated[0] || existing;
      }

      // Check if another user row already holds this email to avoid UNIQUE email conflict on auto-provisioned accounts
      const byEmail = await this.getByEmail(cleanEmail);
      if (byEmail) {
        return byEmail;
      }

      const inserted = await database
        .insert(schema.users)
        .values({
          id: data.id,
          email: cleanEmail,
          name: data.displayName || cleanEmail.split("@")[0],
          image: data.photoUrl || null,
          role,
          storageUsedBytes: 0,
          storageLimitBytes: 150 * 1024 * 1024,
          isBanned: false,
          metadata: {},
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: {
            email: cleanEmail,
            name: data.displayName || cleanEmail.split("@")[0],
            image: data.photoUrl || null,
            role,
            updatedAt: now,
          },
        })
        .returning();
      return inserted[0];
    } catch (err) {
      console.error("[Turso UserRepository.upsertUser] error:", err);
      return {
        id: data.id,
        email: cleanEmail,
        name: data.displayName || cleanEmail.split("@")[0],
        image: data.photoUrl || null,
        role,
        storageUsedBytes: 0,
        storageLimitBytes: 150 * 1024 * 1024,
        isBanned: false,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      };
    }
  },

  async listAllUsers() {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.users)
        .orderBy(desc(schema.users.createdAt));
    } catch (err) {
      console.error("[Turso UserRepository.listAllUsers] error:", err);
      return [];
    }
  },

  async updateStorageUsage(userId: string, deltaBytes: number) {
    const database = await getReadyDb();
    try {
      await database
        .update(schema.users)
        .set({
          storageUsedBytes: sql`MAX(0, ${schema.users.storageUsedBytes} + ${deltaBytes})`,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId));
    } catch (err) {
      console.error("[Turso UserRepository.updateStorageUsage] error:", err);
    }
  },
};

// ==========================================
// 2. Conversation & Message Repository (Turso)
// ==========================================

export interface ConversationMessageDTO {
  id: string;
  role: string;
  sender: string;
  content: string;
  reasoning: string | null;
  sources: any[];
  toolCalls: any[];
  attachments: any[];
  agentSteps?: any[];
  metadata?: Record<string, any>;
  status?: string;
  error?: string;
  modelUsed?: string;
  timestamp: number;
  createdAt: number;
}

const persistedMessageMetadataFields = [
  "widgetData",
  "activityState",
  "reasoningSteps",
  "reflectionSteps",
  "hypotheses",
  "confidenceScore",
  "reasoningMode",
  "suggestions",
  "selectedSuggestions",
  "webSearchUsed",
  "queriesUsed",
  "pagesRead",
  "usedMemories",
  "candidateNewMemory",
  "providerUsed",
  "keyUsedMasked",
] as const;

function collectMessageMetadata(message: any): Record<string, any> {
  const metadata: Record<string, any> =
    message.metadata && typeof message.metadata === "object" ? { ...message.metadata } : {};

  for (const field of persistedMessageMetadataFields) {
    if (message[field] !== undefined) metadata[field] = message[field];
  }

  return metadata;
}

function getDisplayMessageMetadata(metadata: Record<string, any>): Record<string, any> {
  const displayMetadata: Record<string, any> = {};

  for (const field of persistedMessageMetadataFields) {
    if (metadata[field] !== undefined) displayMetadata[field] = metadata[field];
  }

  return displayMetadata;
}

function mapMessageRow(m: any, defaultModelId: string): ConversationMessageDTO {
  const role = m.role || (m.sender === "user" ? "user" : "model");
  const sender = m.sender || (role === "user" ? "user" : "assistant");
  const ts = toTimestampMs(m.createdAt);
  const metadata = m.metadata && typeof m.metadata === "object" ? m.metadata : {};
  return {
    ...getDisplayMessageMetadata(metadata),
    id: m.id,
    role,
    sender,
    content: m.content || "",
    reasoning: m.reasoning || null,
    sources: Array.isArray(m.sources) ? m.sources : [],
    toolCalls: Array.isArray(m.toolCalls) ? m.toolCalls : [],
    attachments: Array.isArray(m.attachments)
      ? m.attachments
      : Array.isArray(metadata.attachments)
      ? metadata.attachments
      : [],
    agentSteps: Array.isArray(metadata.agentSteps) ? metadata.agentSteps : undefined,
    metadata,
    status: typeof metadata.status === "string" ? metadata.status : undefined,
    error: typeof metadata.error === "string" ? metadata.error : undefined,
    modelUsed: m.modelUsed || metadata.modelUsed || defaultModelId,
    timestamp: ts,
    createdAt: ts,
  };
}

export const ConversationRepository = {
  async listByUser(userId: string) {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.conversations)
        .where(and(eq(schema.conversations.userId, userId), eq(schema.conversations.isArchived, false)))
        .orderBy(desc(schema.conversations.updatedAt));

      if (!rows || rows.length === 0) return [];

      const results = await Promise.all(
        rows.map(async (c) => {
          const msgs = await database
            .select()
            .from(schema.messages)
            .where(eq(schema.messages.conversationId, c.id))
            .orderBy(schema.messages.createdAt);

          return {
            id: c.id,
            userId: c.userId,
            title: c.title,
            modelId: c.modelId,
            createdAt: toTimestampMs(c.createdAt),
            updatedAt: toTimestampMs(c.updatedAt),
            messages: (msgs || []).map((m) => mapMessageRow(m, c.modelId)),
          };
        })
      );
      return results;
    } catch (err) {
      console.error("[Turso ConversationRepository.listByUser] error:", err);
      return [];
    }
  },

  async listAllConversations() {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.isArchived, false))
        .orderBy(desc(schema.conversations.updatedAt));

      if (!rows || rows.length === 0) return [];

      const results = await Promise.all(
        rows.map(async (c) => {
          const msgs = await database
            .select()
            .from(schema.messages)
            .where(eq(schema.messages.conversationId, c.id))
            .orderBy(schema.messages.createdAt);

          return {
            id: c.id,
            userId: c.userId,
            title: c.title,
            modelId: c.modelId,
            createdAt: toTimestampMs(c.createdAt),
            updatedAt: toTimestampMs(c.updatedAt),
            messages: (msgs || []).map((m) => mapMessageRow(m, c.modelId)),
          };
        })
      );
      return results;
    } catch (err) {
      console.error("[Turso ConversationRepository.listAllConversations] error:", err);
      return [];
    }
  },

  async saveConversation(
    userId: string,
    conv: {
      id: string;
      title: string;
      modelId?: string;
      createdAt?: number;
      updatedAt?: number;
      messages?: any[];
    },
    options: { allowOwnershipTransfer?: boolean } = {}
  ) {
    const now = new Date(conv.updatedAt || Date.now());
    const createdDate = new Date(conv.createdAt || Date.now());

    try {
      await executeWithRetry(async (database) => {
        await UserRepository.upsertUser({
          id: userId,
          email: `${userId}@souftools.app`,
          displayName: userId,
        });

        await database.transaction(async (tx) => {
          const existing = await tx
            .select()
            .from(schema.conversations)
            .where(eq(schema.conversations.id, conv.id))
            .limit(1);

          if (existing.length > 0) {
            if (existing[0].userId !== userId) {
              if (!options.allowOwnershipTransfer) {
                throw new Error("Forbidden: conversation ownership mismatch");
              }
              await tx
                .update(schema.conversations)
                .set({ userId })
                .where(eq(schema.conversations.id, conv.id));
            }
            await tx
              .update(schema.conversations)
              .set({
                title: conv.title,
                modelId: conv.modelId || "soufai-spark",
                version: (existing[0].version || 1) + 1,
                updatedAt: now,
              })
              .where(eq(schema.conversations.id, conv.id));
          } else {
            await tx.insert(schema.conversations).values({
              id: conv.id,
              userId,
              title: conv.title,
              modelId: conv.modelId || "soufai-spark",
              createdAt: createdDate,
              updatedAt: now,
            });
          }

          if (conv.messages && Array.isArray(conv.messages)) {
            await tx.delete(schema.messages).where(eq(schema.messages.conversationId, conv.id));
            if (conv.messages.length > 0) {
              const uniqueMap = new Map<string, typeof schema.messages.$inferInsert>();
              conv.messages.forEach((m: any, idx: number) => {
                const role = m.role || (m.sender === "user" ? "user" : "model");
                const sender = m.sender || (role === "user" ? "user" : "assistant");
                const ts = new Date(m.timestamp || m.createdAt || Date.now());
                const metadata = {
                  ...collectMessageMetadata(m),
                  ...(Array.isArray(m.attachments) && m.attachments.length > 0 ? { attachments: m.attachments } : {}),
                  ...(Array.isArray(m.agentSteps) && m.agentSteps.length > 0 ? { agentSteps: m.agentSteps } : {}),
                  ...(m.modelUsed ? { modelUsed: m.modelUsed } : {}),
                  ...(m.status ? { status: m.status } : {}),
                  ...(m.error ? { error: m.error } : {}),
                };
                const msgId = m.id || `${conv.id}_msg_${idx}_${Date.now()}`;
                uniqueMap.set(msgId, {
                  id: msgId,
                  conversationId: conv.id,
                  sender,
                  content: m.content || "",
                  reasoning: m.reasoning || null,
                  sources: Array.isArray(m.sources) ? m.sources : [],
                  toolCalls: Array.isArray(m.toolCalls) ? m.toolCalls : [],
                  metadata,
                  createdAt: ts,
                  updatedAt: ts,
                });
              });

              const msgRows = Array.from(uniqueMap.values());
              for (const batch of chunkArray(msgRows, 50)) {
                await tx
                  .insert(schema.messages)
                  .values(batch)
                  .onConflictDoUpdate({
                    target: schema.messages.id,
                    set: {
                      content: sql`excluded.content`,
                      reasoning: sql`excluded.reasoning`,
                      sources: sql`excluded.sources`,
                      toolCalls: sql`excluded.tool_calls`,
                      metadata: sql`excluded.metadata`,
                      updatedAt: sql`excluded.updated_at`,
                    },
                  });
              }
            }
          }
        });
      });
    } catch (err) {
      console.error("[Turso ConversationRepository.saveConversation] error:", err);
      throw err;
    }
  },

  async deleteConversation(userId: string, conversationId: string) {
    const database = await getReadyDb();
    try {
      await database
        .delete(schema.conversations)
        .where(and(eq(schema.conversations.id, conversationId), eq(schema.conversations.userId, userId)));
    } catch (err) {
      console.error("[Turso ConversationRepository.deleteConversation] error:", err);
    }
  },

  async delete(conversationId: string) {
    const database = await getReadyDb();
    try {
      await database.delete(schema.conversations).where(eq(schema.conversations.id, conversationId));
    } catch (err) {
      console.error("[Turso ConversationRepository.delete] error:", err);
    }
  },

  async getConversationById(conversationId: string, userId?: string) {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.conversations)
        .where(eq(schema.conversations.id, conversationId))
        .limit(1);

      if (!rows || rows.length === 0) return null;
      const c = rows[0];

      if (userId && c.userId !== userId && userId !== "super_admin" && !userId.includes("admin")) {
        return null;
      }

      const msgs = await database
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, c.id))
        .orderBy(schema.messages.createdAt);

      return {
        id: c.id,
        userId: c.userId,
        title: c.title,
        modelId: c.modelId,
        createdAt: toTimestampMs(c.createdAt),
        updatedAt: toTimestampMs(c.updatedAt),
        messages: (msgs || []).map((m) => mapMessageRow(m, c.modelId)),
      };
    } catch (err) {
      console.error("[Turso ConversationRepository.getConversationById] error:", err);
      return null;
    }
  },
};

// ==========================================
// 3. Long-term Memory Repository (Turso)
// ==========================================

export const MemoryRepository = {
  async listByUser(
    userId: string,
    filter?: {
      type?: string;
      status?: string;
      projectId?: string;
      query?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const database = await getReadyDb();
    try {
      const conditions: any[] = [eq(schema.memories.userId, userId)];
      if (filter?.type && filter.type !== "all") {
        conditions.push(eq(schema.memories.type, filter.type));
      }
      if (filter?.status) {
        conditions.push(eq(schema.memories.status, filter.status));
      } else {
        conditions.push(eq(schema.memories.status, "active"));
      }
      if (filter?.projectId) {
        conditions.push(eq(schema.memories.projectId, filter.projectId));
      }

      let queryBuilder = database
        .select()
        .from(schema.memories)
        .where(and(...conditions))
        .orderBy(desc(schema.memories.updatedAt));

      if (filter?.limit) {
        queryBuilder = queryBuilder.limit(filter.limit) as any;
      }
      if (filter?.offset) {
        queryBuilder = queryBuilder.offset(filter.offset) as any;
      }

      const rows = await queryBuilder;
      let results = (rows || []).map((r: any) => ({
        id: r.id,
        userId: r.userId,
        type: r.type,
        content: r.content,
        importance: r.importance,
        confidence: r.confidence,
        source: r.source as any,
        status: (r.status || "active") as any,
        projectId: r.projectId || undefined,
        projectName: r.projectName || undefined,
        userName: r.userName || undefined,
        category: r.category || undefined,
        tags: (Array.isArray(r.tags) ? r.tags : []) as string[],
        enabled: Boolean(r.enabled),
        version: r.version || 1,
        metadata: r.metadata || {},
        lastUsedAt: r.lastUsedAt ? toTimestampMs(r.lastUsedAt) : undefined,
        expiresAt: r.expiresAt ? toTimestampMs(r.expiresAt) : undefined,
        createdAt: r.createdAt ? toTimestampMs(r.createdAt) : Date.now(),
        updatedAt: r.updatedAt ? toTimestampMs(r.updatedAt) : Date.now(),
      }));

      if (filter?.query && filter.query.trim()) {
        const q = filter.query.trim().toLowerCase();
        results = results.filter(
          (m: any) =>
            m.content.toLowerCase().includes(q) ||
            (m.projectName && m.projectName.toLowerCase().includes(q)) ||
            (m.userName && m.userName.toLowerCase().includes(q)) ||
            (Array.isArray(m.tags) && m.tags.some((t: string) => t.toLowerCase().includes(q)))
        );
      }

      return results;
    } catch (err) {
      console.error("[Turso MemoryRepository.listByUser] error:", err);
      return [];
    }
  },

  async getById(userId: string, memoryId: string) {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.memories)
        .where(and(eq(schema.memories.id, memoryId), eq(schema.memories.userId, userId)))
        .limit(1);

      if (!rows || rows.length === 0) return null;
      const r = rows[0];
      return {
        id: r.id,
        userId: r.userId,
        type: r.type,
        content: r.content,
        importance: r.importance,
        confidence: r.confidence,
        source: r.source as any,
        status: (r.status || "active") as any,
        projectId: r.projectId || undefined,
        projectName: r.projectName || undefined,
        userName: r.userName || undefined,
        category: r.category || undefined,
        tags: (Array.isArray(r.tags) ? r.tags : []) as string[],
        enabled: Boolean(r.enabled),
        version: r.version || 1,
        metadata: r.metadata || {},
        lastUsedAt: r.lastUsedAt ? toTimestampMs(r.lastUsedAt) : undefined,
        expiresAt: r.expiresAt ? toTimestampMs(r.expiresAt) : undefined,
        createdAt: r.createdAt ? toTimestampMs(r.createdAt) : Date.now(),
        updatedAt: r.updatedAt ? toTimestampMs(r.updatedAt) : Date.now(),
      };
    } catch (err) {
      console.error("[Turso MemoryRepository.getById] error:", err);
      return null;
    }
  },

  async saveMemory(userId: string, item: any) {
    const id = item.id || `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const expiresAt = item.expiresAt ? new Date(item.expiresAt) : null;
    const lastUsedAt = item.lastUsedAt ? new Date(item.lastUsedAt) : now;
    const database = await getReadyDb();

    try {
      await UserRepository.upsertUser({ id: userId, email: `${userId}@souftools.app` });

      const existing = await database
        .select()
        .from(schema.memories)
        .where(and(eq(schema.memories.id, id), eq(schema.memories.userId, userId)))
        .limit(1);

      if (existing.length > 0) {
        const currentVer = existing[0].version || 1;
        await database
          .update(schema.memories)
          .set({
            type: item.type || existing[0].type,
            content: item.content !== undefined ? item.content : existing[0].content,
            importance: item.importance ?? existing[0].importance,
            confidence: item.confidence ?? existing[0].confidence,
            source: item.source || existing[0].source,
            status: item.status || existing[0].status || "active",
            projectId: item.projectId !== undefined ? item.projectId : existing[0].projectId,
            projectName: item.projectName !== undefined ? item.projectName : existing[0].projectName,
            userName: item.userName !== undefined ? item.userName : existing[0].userName,
            category: item.category !== undefined ? item.category : existing[0].category,
            tags: Array.isArray(item.tags) ? item.tags : existing[0].tags,
            enabled: item.enabled ?? existing[0].enabled,
            version: currentVer + 1,
            metadata: item.metadata || existing[0].metadata || {},
            lastUsedAt,
            expiresAt,
            updatedAt: now,
          })
          .where(and(eq(schema.memories.id, id), eq(schema.memories.userId, userId)));
      } else {
        await database.insert(schema.memories).values({
          id,
          userId,
          type: item.type || "USER_FACT",
          content: item.content,
          importance: item.importance ?? 0.8,
          confidence: item.confidence ?? 1.0,
          source: item.source || "auto",
          status: item.status || "active",
          projectId: item.projectId || null,
          projectName: item.projectName || null,
          userName: item.userName || null,
          category: item.category || null,
          tags: Array.isArray(item.tags) ? item.tags : [],
          enabled: item.enabled ?? true,
          version: item.version || 1,
          metadata: item.metadata || {},
          lastUsedAt,
          expiresAt,
          createdAt: item.createdAt ? new Date(item.createdAt) : now,
          updatedAt: now,
        });
      }

      return {
        ...item,
        id,
        userId,
        type: item.type || "USER_FACT",
        importance: item.importance ?? 0.8,
        confidence: item.confidence ?? 1.0,
        source: item.source || "auto",
        status: item.status || "active",
        tags: Array.isArray(item.tags) ? item.tags : [],
        enabled: item.enabled ?? true,
        createdAt: item.createdAt || now.getTime(),
        updatedAt: now.getTime(),
      };
    } catch (err) {
      console.error("[Turso MemoryRepository.saveMemory] error:", err);
      return { id, userId, ...item };
    }
  },

  async updateMemory(userId: string, memoryId: string, updates: any) {
    return this.saveMemory(userId, { id: memoryId, ...updates });
  },

  async deleteMemory(userId: string, memoryId: string, softDelete: boolean = false) {
    const database = await getReadyDb();
    try {
      if (softDelete) {
        await database
          .update(schema.memories)
          .set({ status: "deleted", enabled: false, updatedAt: new Date() })
          .where(and(eq(schema.memories.id, memoryId), eq(schema.memories.userId, userId)));
      } else {
        await database
          .delete(schema.memories)
          .where(and(eq(schema.memories.id, memoryId), eq(schema.memories.userId, userId)));
      }
    } catch (err) {
      console.error("[Turso MemoryRepository.deleteMemory] error:", err);
    }
  },

  async clearAll(userId: string) {
    const database = await getReadyDb();
    try {
      await database.delete(schema.memories).where(eq(schema.memories.userId, userId));
    } catch (err) {
      console.error("[Turso MemoryRepository.clearAll] error:", err);
    }
  },

  async touchMemoriesUsed(userId: string, memoryIds: string[]) {
    if (!memoryIds || memoryIds.length === 0) return;
    const now = new Date();
    const database = await getReadyDb();
    try {
      for (const batch of chunkArray(memoryIds, 400)) {
        await database
          .update(schema.memories)
          .set({ lastUsedAt: now, updatedAt: now })
          .where(and(eq(schema.memories.userId, userId), inArray(schema.memories.id, batch)));
      }
    } catch (err) {
      console.error("[Turso MemoryRepository.touchMemoriesUsed] error:", err);
    }
  },

  async getStats(userId: string) {
    const list = await this.listByUser(userId, { status: "active" });
    const byType: Record<string, number> = {};
    let lastAddedAt = 0;
    let lastUsedAt = 0;

    for (const m of list) {
      byType[m.type] = (byType[m.type] || 0) + 1;
      if (m.createdAt > lastAddedAt) lastAddedAt = m.createdAt;
      if (m.lastUsedAt && m.lastUsedAt > lastUsedAt) lastUsedAt = m.lastUsedAt;
    }

    return {
      totalMemories: list.length,
      activeMemories: list.filter((m: any) => m.enabled).length,
      byType,
      lastAddedAt: lastAddedAt || undefined,
      lastUsedAt: lastUsedAt || undefined,
      deduplicationCount: 0,
    };
  },

  async getSettings(userId: string) {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.memorySettings)
        .where(eq(schema.memorySettings.userId, userId))
        .limit(1);

      if (rows && rows[0]) {
        return {
          memoryEnabled: Boolean(rows[0].memoryEnabled),
          autoSuggest: Boolean(rows[0].autoSuggest),
          autoExtract: Boolean(rows[0].autoExtract),
          maxContextItems: rows[0].maxContextItems,
          retentionDays: rows[0].retentionDays,
        };
      }
    } catch (err) {
      console.error("[Turso MemoryRepository.getSettings] error:", err);
    }

    return {
      memoryEnabled: true,
      autoSuggest: true,
      autoExtract: true,
      maxContextItems: 8,
      retentionDays: 365,
    };
  },

  async saveSettings(userId: string, settings: any) {
    const id = `mset_${userId}`;
    const now = new Date();
    const database = await getReadyDb();

    try {
      await UserRepository.upsertUser({ id: userId, email: `${userId}@souftools.app` });

      await database
        .insert(schema.memorySettings)
        .values({
          id,
          userId,
          memoryEnabled: settings.memoryEnabled ?? true,
          autoSuggest: settings.autoSuggest ?? true,
          autoExtract: settings.autoExtract ?? true,
          maxContextItems: settings.maxContextItems ?? 8,
          retentionDays: settings.retentionDays ?? 365,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.memorySettings.userId,
          set: {
            memoryEnabled: settings.memoryEnabled ?? true,
            autoSuggest: settings.autoSuggest ?? true,
            autoExtract: settings.autoExtract ?? true,
            maxContextItems: settings.maxContextItems ?? 8,
            retentionDays: settings.retentionDays ?? 365,
            updatedAt: now,
          },
        });
    } catch (err) {
      console.error("[Turso MemoryRepository.saveSettings] error:", err);
    }
  },

  async logAccess(
    userId: string,
    log: {
      action: string;
      memoryId?: string;
      promptSnippet?: string;
      relevanceScore?: number;
      metadata?: any;
    }
  ) {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const database = await getReadyDb();
    try {
      await UserRepository.upsertUser({ id: userId, email: `${userId}@souftools.app` });
      await database.insert(schema.memoryAccessLogs).values({
        id,
        userId,
        memoryId: log.memoryId || null,
        action: log.action,
        promptSnippet: log.promptSnippet || null,
        relevanceScore: log.relevanceScore || null,
        metadata: log.metadata || {},
      });
    } catch (err) {
      console.error("[Turso MemoryRepository.logAccess] error:", err);
    }
  },
};

// ==========================================
// 4. Behavior Profile Repository (Turso)
// ==========================================

export const BehaviorRepository = {
  async getProfile(userId: string) {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.behaviorProfiles)
        .where(eq(schema.behaviorProfiles.userId, userId))
        .limit(1);
      if (rows && rows[0]) {
        return {
          preferences: rows[0].preferences,
          patterns: rows[0].patterns,
          stats: rows[0].stats,
        };
      }
    } catch (err) {
      console.error("[Turso BehaviorRepository.getProfile] error:", err);
    }
    return null;
  },

  async saveProfile(userId: string, profile: any) {
    const now = new Date();
    const database = await getReadyDb();
    try {
      await UserRepository.upsertUser({ id: userId, email: `${userId}@souftools.app` });

      await database
        .insert(schema.behaviorProfiles)
        .values({
          id: `beh_${userId}`,
          userId,
          preferences: profile.preferences || {},
          patterns: profile.patterns || {},
          stats: profile.stats || {},
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.behaviorProfiles.userId,
          set: {
            preferences: profile.preferences || {},
            patterns: profile.patterns || {},
            stats: profile.stats || {},
            updatedAt: now,
          },
        });
    } catch (err) {
      console.error("[Turso BehaviorRepository.saveProfile] error:", err);
    }
  },
};

// ==========================================
// 5. Storage Metadata Repository (Turso)
// ==========================================

export const StorageRepository = {
  async createObject(data: {
    id: string;
    userId: string;
    conversationId?: string;
    projectId?: string;
    objectKey: string;
    filename: string;
    mimeType: string;
    category: string;
    sizeBytes: number;
    checksum?: string;
    metadata?: Record<string, any>;
  }) {
    const database = await getReadyDb();
    const now = new Date();
    try {
      await UserRepository.upsertUser({ id: data.userId, email: `${data.userId}@souftools.app` });

      await database.transaction(async (tx) => {
        await tx.insert(schema.storageObjects).values({
          id: data.id,
          userId: data.userId,
          conversationId: data.conversationId || null,
          projectId: data.projectId || null,
          objectKey: data.objectKey,
          filename: data.filename,
          mimeType: data.mimeType,
          category: data.category,
          sizeBytes: data.sizeBytes,
          checksum: data.checksum || null,
          storageProvider: "local_private",
          metadata: data.metadata || {},
          createdAt: now,
          updatedAt: now,
        });

        await tx
          .update(schema.users)
          .set({
            storageUsedBytes: sql`MAX(0, ${schema.users.storageUsedBytes} + ${data.sizeBytes})`,
            updatedAt: now,
          })
          .where(eq(schema.users.id, data.userId));
      });
    } catch (err) {
      console.error("[Turso StorageRepository.createObject] error:", err);
    }
  },

  async getObjectById(id: string, userId?: string) {
    const database = await getReadyDb();
    try {
      let condition: any = eq(schema.storageObjects.id, id);
      if (userId) {
        condition = and(condition, eq(schema.storageObjects.userId, userId));
      }
      const rows = await database.select().from(schema.storageObjects).where(condition).limit(1);
      return rows[0] || null;
    } catch (err) {
      console.error("[Turso StorageRepository.getObjectById] error:", err);
      return null;
    }
  },

  async listByUser(userId: string) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.storageObjects)
        .where(eq(schema.storageObjects.userId, userId))
        .orderBy(desc(schema.storageObjects.createdAt));
    } catch (err) {
      console.error("[Turso StorageRepository.listByUser] error:", err);
      return [];
    }
  },

  async deleteObject(id: string, userId: string) {
    const existing = await this.getObjectById(id, userId);
    if (!existing) return null;

    const database = await getReadyDb();
    try {
      await database.transaction(async (tx) => {
        await tx
          .delete(schema.storageObjects)
          .where(and(eq(schema.storageObjects.id, id), eq(schema.storageObjects.userId, userId)));
        await tx
          .update(schema.users)
          .set({
            storageUsedBytes: sql`MAX(0, ${schema.users.storageUsedBytes} - ${existing.sizeBytes})`,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userId));
      });
      return existing;
    } catch (err) {
      console.error("[Turso StorageRepository.deleteObject] error:", err);
      return null;
    }
  },

  async getAdminStorageStats() {
    let totalBytes = 0;
    let imagesCount = 0;
    let videosCount = 0;
    let docsCount = 0;
    let totalFiles = 0;

    const database = await getReadyDb();
    try {
      const rows = await database.select().from(schema.storageObjects);
      (rows || []).forEach((r: any) => {
        totalFiles++;
        totalBytes += Number(r.sizeBytes) || 0;
        if (r.category === "image") imagesCount++;
        else if (r.category === "video") videosCount++;
        else docsCount++;
      });
    } catch (err) {
      console.error("[Turso StorageRepository.getAdminStorageStats] error:", err);
    }

    return { totalBytes, totalFiles, imagesCount, videosCount, docsCount };
  },

  async listAllFiles() {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.storageObjects)
        .orderBy(desc(schema.storageObjects.createdAt));
    } catch (err) {
      console.error("[Turso StorageRepository.listAllFiles] error:", err);
      return [];
    }
  },
};

// ==========================================
// 6. Projects & Project Files Repository (Turso)
// ==========================================

export const ProjectRepository = {
  async upsertProject(data: {
    id: string;
    userId: string;
    name: string;
    description?: string;
    framework?: string;
    version?: number;
    metadata?: Record<string, any>;
  }) {
    const database = await getReadyDb();
    const now = new Date();
    try {
      await UserRepository.upsertUser({ id: data.userId, email: `${data.userId}@souftools.app` });
      const existing = await database
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, data.id))
        .limit(1);

      if (existing.length > 0) {
        if (existing[0].userId !== data.userId) {
          return null;
        }
        await database
          .update(schema.projects)
          .set({
            name: data.name,
            description: data.description !== undefined ? data.description : existing[0].description,
            framework: data.framework || existing[0].framework,
            version: (existing[0].version || 1) + 1,
            metadata: { ...(existing[0].metadata || {}), ...(data.metadata || {}) },
            updatedAt: now,
          })
          .where(and(eq(schema.projects.id, data.id), eq(schema.projects.userId, data.userId)));
        return { ...existing[0], ...data, updatedAt: now };
      } else {
        await database.insert(schema.projects).values({
          id: data.id,
          userId: data.userId,
          name: data.name,
          description: data.description || null,
          framework: data.framework || "react_nextjs",
          version: data.version || 1,
          metadata: data.metadata || {},
          createdAt: now,
          updatedAt: now,
        });
        return { ...data, createdAt: now, updatedAt: now };
      }
    } catch (err) {
      console.error("[Turso ProjectRepository.upsertProject] error:", err);
      return null;
    }
  },

  async saveProjectFiles(
    projectId: string,
    files: Record<string, { content: string; language?: string } | string>
  ) {
    const database = await getReadyDb();
    const now = new Date();
    try {
      await database.transaction(async (tx) => {
        for (const [filePath, fileData] of Object.entries(files)) {
          const content = typeof fileData === "string" ? fileData : fileData.content || "";
          const fileId = `${projectId}_${Buffer.from(filePath).toString("base64url")}`;
          const sizeBytes = Buffer.byteLength(content, "utf8");

          const existing = await tx
            .select()
            .from(schema.projectFiles)
            .where(and(eq(schema.projectFiles.projectId, projectId), eq(schema.projectFiles.path, filePath)))
            .limit(1);

          if (existing.length > 0) {
            await tx
              .update(schema.projectFiles)
              .set({
                content,
                sizeBytes,
                version: (existing[0].version || 1) + 1,
                updatedAt: now,
              })
              .where(eq(schema.projectFiles.id, existing[0].id));
          } else {
            await tx.insert(schema.projectFiles).values({
              id: fileId,
              projectId,
              path: filePath,
              content,
              sizeBytes,
              version: 1,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      });
    } catch (err) {
      console.error("[Turso ProjectRepository.saveProjectFiles] error:", err);
    }
  },

  async getProject(projectId: string, userId?: string) {
    const database = await getReadyDb();
    try {
      let cond: any = eq(schema.projects.id, projectId);
      if (userId) {
        cond = and(cond, eq(schema.projects.userId, userId));
      }
      const rows = await database.select().from(schema.projects).where(cond).limit(1);
      if (!rows || rows.length === 0) return null;

      const project = rows[0];
      const files = await database
        .select()
        .from(schema.projectFiles)
        .where(eq(schema.projectFiles.projectId, projectId));

      return {
        ...project,
        files: files.reduce((acc: any, f: any) => {
          acc[f.path] = {
            path: f.path,
            content: f.content,
            sizeBytes: f.sizeBytes,
            version: f.version,
            updatedAt: f.updatedAt ? toTimestampMs(f.updatedAt) : Date.now(),
          };
          return acc;
        }, {}),
      };
    } catch (err) {
      console.error("[Turso ProjectRepository.getProject] error:", err);
      return null;
    }
  },

  async listByUser(userId: string) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.userId, userId))
        .orderBy(desc(schema.projects.updatedAt));
    } catch (err) {
      console.error("[Turso ProjectRepository.listByUser] error:", err);
      return [];
    }
  },

  async deleteProject(projectId: string, userId: string) {
    const database = await getReadyDb();
    try {
      const existing = await database
        .select({ id: schema.projects.id })
        .from(schema.projects)
        .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)))
        .limit(1);
      if (existing.length === 0) return false;

      await database.transaction(async (tx) => {
        await tx.delete(schema.projectFiles).where(eq(schema.projectFiles.projectId, projectId));
        await tx
          .delete(schema.projects)
          .where(and(eq(schema.projects.id, projectId), eq(schema.projects.userId, userId)));
      });
      return true;
    } catch (err) {
      console.error("[Turso ProjectRepository.deleteProject] error:", err);
      return false;
    }
  },
};

// ==========================================
// 7. Settings & Admin Repository (Turso)
// ==========================================

export const SettingsRepository = {
  async getSetting<T = any>(key: string): Promise<T | null> {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, key))
        .limit(1);
      return rows[0] ? (rows[0].value as T) : null;
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      if (!msg.includes("no such table")) {
        console.error("[Turso SettingsRepository.getSetting] error:", msg);
      }
      return null;
    }
  },

  async listKeys(): Promise<string[]> {
    const database = await getReadyDb();
    try {
      const rows = await database.select({ key: schema.settings.key }).from(schema.settings);
      return rows.map((row) => row.key).filter(Boolean);
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      if (!msg.includes("no such table")) {
        console.error("[Turso SettingsRepository.listKeys] error:", msg);
      }
      return [];
    }
  },

  async setSetting(key: string, value: any, isEncrypted = false): Promise<void> {
    const database = await getReadyDb();
    const now = new Date();
    try {
      await database
        .insert(schema.settings)
        .values({
          id: `set_${key}`,
          key,
          value,
          isEncrypted,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value, isEncrypted, updatedAt: now },
        });
    } catch (err) {
      console.error("[Turso SettingsRepository.setSetting] error:", err);
    }
  },
};

// ==========================================
// 8. Audit & Telemetry Repository (Turso)
// ==========================================

export const AuditRepository = {
  async logAction(data: {
    adminUserId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
  }) {
    const database = await getReadyDb();
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    try {
      await database.insert(schema.adminLogs).values({
        id,
        adminUserId: data.adminUserId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId || null,
        details: data.details || {},
        ipAddress: data.ipAddress || null,
        createdAt: now,
      });
    } catch (err) {
      console.error("[Turso AuditRepository.logAction] error:", err);
    }
  },

  async getRecentLogs(limitCount = 50) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.adminLogs)
        .orderBy(desc(schema.adminLogs.createdAt))
        .limit(limitCount);
    } catch (err) {
      console.error("[Turso AuditRepository.getRecentLogs] error:", err);
      return [];
    }
  },

  async listRecentLogs(limitCount = 50) {
    return this.getRecentLogs(limitCount);
  },
};

// ==========================================
// 9. SoufAI Autonomous Agent Engine & Checkpoints (Turso)
// ==========================================

export interface AgentTaskLease {
  workerId: string;
  token: string;
  generation: number;
}

export const AgentRepository = {
  async createTask(taskData: {
    id: string;
    userId: string;
    projectId?: string;
    goal: string;
    category?: string;
    status?: string;
    budgetTier?: string;
    maxSteps?: number;
    plan?: string[];
    activeAgents?: string[];
    metadata?: Record<string, any>;
  }) {
    const database = await getReadyDb();
    const now = new Date();
    const payload = {
      id: taskData.id,
      userId: taskData.userId,
      projectId: taskData.projectId || null,
      goal: taskData.goal,
      category: taskData.category || "general",
      status: taskData.status || "pending",
      budgetTier: taskData.budgetTier || "auto",
      maxSteps: taskData.maxSteps || 7,
      currentStep: 0,
      plan: taskData.plan || [],
      activeAgents: taskData.activeAgents || [],
      filesChanged: [] as string[],
      summary: null as string | null,
      finalResponse: null as string | null,
      qualityScore: null as number | null,
      metadata: taskData.metadata || {},
      leaseOwner: null as string | null,
      leaseToken: null as string | null,
      leaseGeneration: 0,
      leaseExpiresAt: null as Date | null,
      retryCount: 0,
      checkpointStep: 0,
      checkpointData: {},
      startedAt: now,
      completedAt: null as Date | null,
      updatedAt: now,
    };

    await executeWithRetry(() => database.insert(schema.agentTasks).values(payload));
    return payload;
  },

  async updateTask(
    taskId: string,
    updates: Partial<{
      status: string;
      currentStep: number;
      plan: string[];
      activeAgents: string[];
      filesChanged: string[];
      summary: string;
      finalResponse: string;
      qualityScore: number;
      metadata: Record<string, any>;
      leaseOwner: string | null;
      leaseToken: string | null;
      leaseExpiresAt: Date | null;
      retryCount: number;
      checkpointStep: number;
      checkpointData: Record<string, any>;
      completedAt: Date | null;
    }>
  ) {
    const database = await getReadyDb();
    const now = new Date();
    const updated = await executeWithRetry(() =>
      database
        .update(schema.agentTasks)
        .set({ ...updates, updatedAt: now })
        .where(
          and(
            eq(schema.agentTasks.id, taskId),
            or(
              isNull(schema.agentTasks.leaseOwner),
              lte(schema.agentTasks.leaseExpiresAt, now)
            )
          )
        )
        .returning({ id: schema.agentTasks.id })
    );
    if (!updated[0]) {
      throw new Error(
        `Agent task '${taskId}' does not exist or is owned by an active lease; update was not persisted.`
      );
    }
  },

  async updateTaskOwned(
    taskId: string,
    lease: AgentTaskLease,
    expectedStatuses: string[],
    updates: Partial<{
      status: string;
      currentStep: number;
      plan: string[];
      activeAgents: string[];
      filesChanged: string[];
      summary: string;
      finalResponse: string;
      qualityScore: number;
      metadata: Record<string, any>;
      leaseOwner: string | null;
      leaseToken: string | null;
      leaseExpiresAt: Date | null;
      retryCount: number;
      checkpointStep: number;
      checkpointData: Record<string, any>;
      completedAt: Date | null;
    }>
  ): Promise<boolean> {
    if (expectedStatuses.length === 0) {
      throw new Error("AgentRepository.updateTaskOwned requires at least one expected status.");
    }
    const database = await getReadyDb();
    const now = new Date();
    const updated = await executeWithRetry(() =>
      database
        .update(schema.agentTasks)
        .set({ ...updates, updatedAt: now })
        .where(
          and(
            eq(schema.agentTasks.id, taskId),
            eq(schema.agentTasks.leaseOwner, lease.workerId),
            eq(schema.agentTasks.leaseToken, lease.token),
            eq(schema.agentTasks.leaseGeneration, lease.generation),
            gt(schema.agentTasks.leaseExpiresAt, now),
            inArray(schema.agentTasks.status, expectedStatuses)
          )
        )
        .returning({ id: schema.agentTasks.id })
    );
    return Boolean(updated[0]);
  },

  async cancelTask(taskId: string, userId?: string): Promise<boolean> {
    const database = await getReadyDb();
    const now = new Date();
    const activeStatuses = [
      "pending",
      "queued",
      "paused",
      "running",
      "planning",
      "executing",
      "waiting_for_dependencies",
      "retrying",
      "evaluating",
      "verifying",
      "suspended",
      "recovery_required",
    ];
    const conditions = [
      eq(schema.agentTasks.id, taskId),
      inArray(schema.agentTasks.status, activeStatuses),
    ];
    if (userId) conditions.push(eq(schema.agentTasks.userId, userId));

    const updated = await executeWithRetry(() =>
      database
        .update(schema.agentTasks)
        .set({
          status: "cancelled",
          summary: "Task cancelled by user.",
          leaseOwner: null,
          leaseToken: null,
          leaseGeneration: sql<number>`${schema.agentTasks.leaseGeneration} + 1`,
          leaseExpiresAt: null,
          completedAt: now,
          updatedAt: now,
        })
        .where(and(...conditions))
        .returning({ id: schema.agentTasks.id })
    );
    return Boolean(updated[0]);
  },

  async getTask(taskId: string, userId?: string) {
    const database = await getReadyDb();
    let cond: any = eq(schema.agentTasks.id, taskId);
    if (userId) {
      cond = and(cond, eq(schema.agentTasks.userId, userId));
    }
    const rows = await database
      .select()
      .from(schema.agentTasks)
      .where(cond)
      .limit(1);
    return rows[0] || null;
  },

  async listUserTasks(userId: string, limitCount = 30) {
    const database = await getReadyDb();
    return database
      .select()
      .from(schema.agentTasks)
      .where(eq(schema.agentTasks.userId, userId))
      .orderBy(desc(schema.agentTasks.startedAt))
      .limit(limitCount);
  },

  async claimTask(taskId: string, workerId: string, leaseToken: string, leaseDurationMs = 120_000) {
    if (!workerId.trim() || !leaseToken.trim() || !Number.isFinite(leaseDurationMs) || leaseDurationMs <= 0) {
      throw new Error("AgentRepository.claimTask requires a worker, lease token, and positive lease duration.");
    }
    return executeWithRetry(async (database) => {
      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
      const updated = await database
        .update(schema.agentTasks)
        .set({
          status: "running",
          leaseOwner: workerId,
          leaseToken,
          leaseGeneration: sql<number>`${schema.agentTasks.leaseGeneration} + 1`,
          leaseExpiresAt,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.agentTasks.id, taskId),
            inArray(schema.agentTasks.status, [
              "pending",
              "queued",
              "paused",
              "suspended",
              "recovery_required",
              "running",
              "executing",
              "planning",
              "verifying",
              "waiting_for_dependencies",
              "retrying",
            ]),
            or(
              isNull(schema.agentTasks.leaseOwner),
              isNull(schema.agentTasks.leaseExpiresAt),
              lte(schema.agentTasks.leaseExpiresAt, now)
            )
          )
        )
        .returning();
      return updated[0] || null;
    });
  },

  async claimNextTask(workerId: string, leaseDurationMs = 120_000) {
    if (!workerId.trim() || !Number.isFinite(leaseDurationMs) || leaseDurationMs <= 0) {
      throw new Error("AgentRepository.claimNextTask requires a worker and positive lease duration.");
    }
    return executeWithRetry(async (database) => {
      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
      const leaseToken = `lease_${randomUUID()}`;

      return database.transaction(async (tx) => {
        const candidates = await tx
          .select({ id: schema.agentTasks.id })
          .from(schema.agentTasks)
          .where(
            and(
              inArray(schema.agentTasks.status, [
                "pending",
                "queued",
                "paused",
                "suspended",
                "recovery_required",
                "running",
                "executing",
                "planning",
                "verifying",
                "waiting_for_dependencies",
                "retrying",
              ]),
              or(
                isNull(schema.agentTasks.leaseOwner),
                isNull(schema.agentTasks.leaseExpiresAt),
                lte(schema.agentTasks.leaseExpiresAt, now)
              )
            )
          )
          .orderBy(schema.agentTasks.startedAt)
          .limit(1);

        if (!candidates[0]) return null;

        const claimed = await tx
          .update(schema.agentTasks)
          .set({
            status: "running",
            leaseOwner: workerId,
            leaseToken,
            leaseGeneration: sql<number>`${schema.agentTasks.leaseGeneration} + 1`,
            leaseExpiresAt,
            updatedAt: now,
          })
          .where(
            and(
              eq(schema.agentTasks.id, candidates[0].id),
              inArray(schema.agentTasks.status, [
                "pending",
                "queued",
                "paused",
                "suspended",
                "recovery_required",
                "running",
                "executing",
                "planning",
                "verifying",
                "waiting_for_dependencies",
                "retrying",
              ]),
              or(
                isNull(schema.agentTasks.leaseOwner),
                isNull(schema.agentTasks.leaseExpiresAt),
                lte(schema.agentTasks.leaseExpiresAt, now)
              )
            )
          )
          .returning();

        return claimed[0] || null;
      });
    });
  },

  async renewTaskLease(lease: AgentTaskLease, taskId: string, leaseDurationMs = 120_000) {
    if (!Number.isFinite(leaseDurationMs) || leaseDurationMs <= 0) {
      throw new Error("AgentRepository.renewTaskLease requires a positive lease duration.");
    }
    const database = await getReadyDb();
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
    const updated = await database
      .update(schema.agentTasks)
      .set({ leaseExpiresAt, updatedAt: now })
      .where(
        and(
          eq(schema.agentTasks.id, taskId),
          eq(schema.agentTasks.leaseOwner, lease.workerId),
          eq(schema.agentTasks.leaseToken, lease.token),
          eq(schema.agentTasks.leaseGeneration, lease.generation),
          gt(schema.agentTasks.leaseExpiresAt, now),
          inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"])
        )
      )
      .returning();
    return Boolean(updated[0]);
  },

  async releaseTaskLease(taskId: string, lease: AgentTaskLease, status?: string): Promise<boolean> {
    const database = await getReadyDb();
    const now = new Date();
    const patch: {
      leaseOwner: null;
      leaseToken: null;
      leaseExpiresAt: null;
      updatedAt: Date;
      status?: string;
    } = {
      leaseOwner: null,
      leaseToken: null,
      leaseExpiresAt: null,
      updatedAt: now,
    };
    if (status) patch.status = status;
    const updated = await database
      .update(schema.agentTasks)
      .set(patch)
      .where(
        and(
          eq(schema.agentTasks.id, taskId),
          eq(schema.agentTasks.leaseOwner, lease.workerId),
          eq(schema.agentTasks.leaseToken, lease.token),
          eq(schema.agentTasks.leaseGeneration, lease.generation),
          gt(schema.agentTasks.leaseExpiresAt, now)
        )
      )
      .returning({ id: schema.agentTasks.id });
    return Boolean(updated[0]);
  },

  async ownsTaskLease(taskId: string, lease: AgentTaskLease): Promise<boolean> {
    const database = await getReadyDb();
    const now = new Date();
    const rows = await database
      .select({ id: schema.agentTasks.id })
      .from(schema.agentTasks)
      .where(
        and(
          eq(schema.agentTasks.id, taskId),
          eq(schema.agentTasks.leaseOwner, lease.workerId),
          eq(schema.agentTasks.leaseToken, lease.token),
          eq(schema.agentTasks.leaseGeneration, lease.generation),
          gt(schema.agentTasks.leaseExpiresAt, now),
          inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"])
        )
      )
      .limit(1);
    return Boolean(rows[0]);
  },

  async saveCheckpoint(
    taskId: string,
    stepNumber: number,
    stepName: string,
    state: Record<string, any>,
    lease?: AgentTaskLease
  ) {
    const database = await getReadyDb();
    const now = new Date();
    const id = `chk_${taskId}_${stepNumber}_${Date.now()}`;
    await database.transaction(async (tx) => {
      await tx.insert(schema.agentCheckpoints).values({
        id,
        taskId,
        stepNumber,
        stepName,
        state: state || {},
        createdAt: now,
      });
      const taskConditions = [eq(schema.agentTasks.id, taskId)];
      if (lease) {
        taskConditions.push(
          eq(schema.agentTasks.leaseOwner, lease.workerId),
          eq(schema.agentTasks.leaseToken, lease.token),
          eq(schema.agentTasks.leaseGeneration, lease.generation),
          gt(schema.agentTasks.leaseExpiresAt, now),
          inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"])
        );
      } else {
        taskConditions.push(
          sql<boolean>`(${schema.agentTasks.leaseOwner} IS NULL OR ${schema.agentTasks.leaseExpiresAt} <= ${now})`
        );
      }
      const updated = await tx
        .update(schema.agentTasks)
        .set({
          checkpointStep: stepNumber,
          checkpointData: state || {},
          currentStep: stepNumber,
          updatedAt: now,
        })
        .where(and(...taskConditions))
        .returning({ id: schema.agentTasks.id });
      if (!updated[0]) {
        throw new Error(
          lease
            ? `Worker '${lease.workerId}' no longer owns task '${taskId}'; checkpoint was not acknowledged.`
            : `Agent task '${taskId}' does not exist or is owned by an active lease; checkpoint was not acknowledged.`
        );
      }
    });
    return { id, taskId, stepNumber, stepName, state, createdAt: now };
  },

  async getLatestCheckpoint(taskId: string) {
    const database = await getReadyDb();
    const rows = await database
      .select()
      .from(schema.agentCheckpoints)
      .where(eq(schema.agentCheckpoints.taskId, taskId))
      .orderBy(desc(schema.agentCheckpoints.stepNumber), desc(schema.agentCheckpoints.createdAt))
      .limit(1);
    return rows[0] || null;
  },

  async listCheckpoints(taskId: string) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.agentCheckpoints)
        .where(eq(schema.agentCheckpoints.taskId, taskId))
        .orderBy(schema.agentCheckpoints.stepNumber, schema.agentCheckpoints.createdAt);
    } catch (err) {
      console.error("[Turso AgentRepository.listCheckpoints] error:", err);
      return [];
    }
  },

  async createSubtask(subtask: {
    id: string;
    taskId: string;
    title: string;
    agentWorker: string;
    status?: string;
    dependencies?: string[];
    parallelGroup?: number;
    inputArgs?: Record<string, any>;
  }, lease?: AgentTaskLease) {
    const payload = {
      id: subtask.id,
      taskId: subtask.taskId,
      title: subtask.title,
      agentWorker: subtask.agentWorker,
      status: subtask.status || "pending",
      dependencies: subtask.dependencies || [],
      parallelGroup: subtask.parallelGroup || 0,
      inputArgs: subtask.inputArgs || {},
      outputResult: {},
      error: null,
      durationMs: 0,
      startedAt: null,
      completedAt: null,
    };
    await executeWithRetry(async (database) => database.transaction(async (tx) => {
      const now = new Date();
      const taskFence = lease
        ? and(
            eq(schema.agentTasks.id, subtask.taskId),
            eq(schema.agentTasks.leaseOwner, lease.workerId),
            eq(schema.agentTasks.leaseToken, lease.token),
            eq(schema.agentTasks.leaseGeneration, lease.generation),
            gt(schema.agentTasks.leaseExpiresAt, now),
            inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"])
          )
        : and(
            eq(schema.agentTasks.id, subtask.taskId),
            or(
              isNull(schema.agentTasks.leaseOwner),
              lte(schema.agentTasks.leaseExpiresAt, now)
            )
          );
      const task = await tx
        .update(schema.agentTasks)
        .set({ updatedAt: now })
        .where(taskFence)
        .returning({ id: schema.agentTasks.id });
      if (!task[0]) {
        throw new Error(
          lease
            ? `Worker '${lease.workerId}' no longer owns task '${subtask.taskId}'; subtask was not created.`
            : `Agent task '${subtask.taskId}' is missing or has an active lease; subtask was not created.`
        );
      }
      await tx.insert(schema.agentSubtasks).values(payload);
    }));
    return payload;
  },

  async updateSubtask(
    subtaskId: string,
    updates: Partial<{
      status: string;
      outputResult: Record<string, any>;
      error: string | null;
      durationMs: number;
      startedAt: Date;
      completedAt: Date;
    }>
  ) {
    await executeWithRetry(async (database) => database.transaction(async (tx) => {
      const rows = await tx
        .select({ taskId: schema.agentSubtasks.taskId })
        .from(schema.agentSubtasks)
        .where(eq(schema.agentSubtasks.id, subtaskId))
        .limit(1);
      if (!rows[0]) {
        throw new Error(`Agent subtask '${subtaskId}' does not exist; update was not persisted.`);
      }
      const now = new Date();
      const task = await tx
        .update(schema.agentTasks)
        .set({ updatedAt: now })
        .where(
          and(
            eq(schema.agentTasks.id, rows[0].taskId),
            or(
              isNull(schema.agentTasks.leaseOwner),
              lte(schema.agentTasks.leaseExpiresAt, now)
            )
          )
        )
        .returning({ id: schema.agentTasks.id });
      if (!task[0]) {
        throw new Error(
          `Agent task '${rows[0].taskId}' has an active lease; subtask '${subtaskId}' update was not persisted.`
        );
      }
      const updated = await tx
        .update(schema.agentSubtasks)
        .set(updates)
        .where(and(eq(schema.agentSubtasks.id, subtaskId), eq(schema.agentSubtasks.taskId, rows[0].taskId)))
        .returning({ id: schema.agentSubtasks.id });
      if (!updated[0]) {
        throw new Error(`Agent subtask '${subtaskId}' disappeared during update.`);
      }
    }));
  },

  async updateSubtaskOwned(
    taskId: string,
    subtaskId: string,
    lease: AgentTaskLease,
    updates: Partial<{
      status: string;
      outputResult: Record<string, any>;
      error: string | null;
      durationMs: number;
      startedAt: Date;
      completedAt: Date;
    }>
  ): Promise<void> {
    const database = await getReadyDb();
    const now = new Date();
    const taskIds = database
      .select({ id: schema.agentTasks.id })
      .from(schema.agentTasks)
      .where(
        and(
          eq(schema.agentTasks.id, taskId),
          eq(schema.agentTasks.leaseOwner, lease.workerId),
          eq(schema.agentTasks.leaseToken, lease.token),
          eq(schema.agentTasks.leaseGeneration, lease.generation),
          gt(schema.agentTasks.leaseExpiresAt, now),
          inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"])
        )
      );
    const updated = await executeWithRetry(() =>
      database
        .update(schema.agentSubtasks)
        .set(updates)
        .where(
          and(
            eq(schema.agentSubtasks.id, subtaskId),
            eq(schema.agentSubtasks.taskId, taskId),
            inArray(schema.agentSubtasks.taskId, taskIds)
          )
        )
        .returning({ id: schema.agentSubtasks.id })
    );
    if (!updated[0]) {
      throw new Error(
        `Worker '${lease.workerId}' no longer owns task '${taskId}' or subtask '${subtaskId}' does not exist.`
      );
    }
  },

  async getSubtasksByTaskId(taskId: string) {
    const database = await getReadyDb();
    return database
      .select()
      .from(schema.agentSubtasks)
      .where(eq(schema.agentSubtasks.taskId, taskId));
  },

  async logEvent(event: {
    id?: string;
    taskId: string;
    subtaskId?: string;
    lease?: AgentTaskLease;
    eventType: string;
    agentWorker?: string;
    title: string;
    summary?: string;
    status?: string;
    payload?: Record<string, any>;
  }) {
    const database = await getReadyDb();
    const id = event.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const payload = {
      id,
      taskId: event.taskId,
      subtaskId: event.subtaskId || null,
      eventType: event.eventType,
      agentWorker: event.agentWorker || null,
      title: event.title,
      summary: event.summary || null,
      status: event.status || "running",
      payload: event.payload || {},
      timestamp: now,
    };
    if (event.lease) {
      await database.transaction(async (tx) => {
        const leaseConfirmed = await tx
          .update(schema.agentTasks)
          .set({ updatedAt: now })
          .where(
            and(
              eq(schema.agentTasks.id, event.taskId),
              eq(schema.agentTasks.leaseOwner, event.lease!.workerId),
              eq(schema.agentTasks.leaseToken, event.lease!.token),
              eq(schema.agentTasks.leaseGeneration, event.lease!.generation),
              gt(schema.agentTasks.leaseExpiresAt, now),
              inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"])
            )
          )
          .returning({ id: schema.agentTasks.id });
        if (!leaseConfirmed[0]) throw new Error("Task lease was lost before event persistence.");
        await tx.insert(schema.agentEvents).values(payload);
      });
    } else {
      await executeWithRetry(() => database.insert(schema.agentEvents).values(payload));
    }
    return payload;
  },

  async getEventsByTaskId(taskId: string, limitCount = 100) {
    const database = await getReadyDb();
    return database
      .select()
      .from(schema.agentEvents)
      .where(eq(schema.agentEvents.taskId, taskId))
      .orderBy(schema.agentEvents.timestamp)
      .limit(limitCount);
  },

  async logToolCall(toolCall: {
    id?: string;
    taskId: string;
    subtaskId?: string;
    lease?: AgentTaskLease;
    toolName: string;
    agentWorker: string;
    args?: Record<string, any>;
    result?: Record<string, any>;
    status?: string;
    errorMessage?: string;
    durationMs?: number;
  }) {
    const database = await getReadyDb();
    const id = toolCall.id || `tc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const payload = {
      id,
      taskId: toolCall.taskId,
      subtaskId: toolCall.subtaskId || null,
      toolName: toolCall.toolName,
      agentWorker: toolCall.agentWorker,
      args: toolCall.args || {},
      result: toolCall.result || {},
      status: toolCall.status || "success",
      errorMessage: toolCall.errorMessage || null,
      durationMs: toolCall.durationMs || 0,
      calledAt: now,
    };
    if (toolCall.lease) {
      await database.transaction(async (tx) => {
        const leaseConfirmed = await tx
          .update(schema.agentTasks)
          .set({ updatedAt: now })
          .where(
            and(
              eq(schema.agentTasks.id, toolCall.taskId),
              eq(schema.agentTasks.leaseOwner, toolCall.lease!.workerId),
              eq(schema.agentTasks.leaseToken, toolCall.lease!.token),
              eq(schema.agentTasks.leaseGeneration, toolCall.lease!.generation),
              gt(schema.agentTasks.leaseExpiresAt, now),
              inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"])
            )
          )
          .returning({ id: schema.agentTasks.id });
        if (!leaseConfirmed[0]) throw new Error("Task lease was lost before tool-call persistence.");
        await tx.insert(schema.agentToolCalls).values(payload);
      });
    } else {
      await executeWithRetry(() => database.insert(schema.agentToolCalls).values(payload));
    }
    return payload;
  },

  async logError(errData: {
    taskId: string;
    subtaskId?: string;
    agentWorker?: string;
    errorCode: string;
    errorMessage: string;
    stackTrace?: string;
    contextData?: Record<string, any>;
    isRecovered?: boolean;
    recoveryAction?: string;
  }) {
    const database = await getReadyDb();
    const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const payload = {
      id,
      taskId: errData.taskId,
      subtaskId: errData.subtaskId || null,
      agentWorker: errData.agentWorker || null,
      errorCode: errData.errorCode,
      errorMessage: errData.errorMessage,
      stackTrace: errData.stackTrace || null,
      contextData: errData.contextData || {},
      isRecovered: errData.isRecovered ?? false,
      recoveryAction: errData.recoveryAction || null,
      createdAt: now,
    };
    await executeWithRetry(() => database.insert(schema.agentErrors).values(payload));
    return payload;
  },

  async saveArtifact(artifact: {
    taskId: string;
    artifactType: string;
    title: string;
    path?: string;
    content?: string;
    metadata?: Record<string, any>;
  }) {
    const database = await getReadyDb();
    const id = `art_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const payload = {
      id,
      taskId: artifact.taskId,
      artifactType: artifact.artifactType,
      title: artifact.title,
      path: artifact.path || null,
      content: artifact.content || null,
      metadata: artifact.metadata || {},
      createdAt: now,
    };
    try {
      await database.insert(schema.agentArtifacts).values(payload);
    } catch (err) {
      console.error("[Turso AgentRepository.saveArtifact] error:", err);
    }
    return payload;
  },

  async recordRun(run: {
    taskId: string;
    userId: string;
    lease?: AgentTaskLease;
    modelUsed: string;
    totalDurationMs: number;
    totalTokensPrompt?: number;
    totalTokensCompletion?: number;
    toolCallsCount?: number;
    filesCreatedCount?: number;
    filesModifiedCount?: number;
    commandsRunCount?: number;
    retriesCount?: number;
    status?: string;
  }) {
    const database = await getReadyDb();
    const id = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const payload = {
      id,
      taskId: run.taskId,
      userId: run.userId,
      modelUsed: run.modelUsed,
      totalDurationMs: run.totalDurationMs,
      totalTokensPrompt: run.totalTokensPrompt || 0,
      totalTokensCompletion: run.totalTokensCompletion || 0,
      toolCallsCount: run.toolCallsCount || 0,
      filesCreatedCount: run.filesCreatedCount || 0,
      filesModifiedCount: run.filesModifiedCount || 0,
      commandsRunCount: run.commandsRunCount || 0,
      retriesCount: run.retriesCount || 0,
      status: run.status || "completed",
      createdAt: now,
    };
    if (run.lease) {
      await database.transaction(async (tx) => {
        const leaseConfirmed = await tx
          .update(schema.agentTasks)
          .set({ updatedAt: now })
          .where(
            and(
              eq(schema.agentTasks.id, run.taskId),
              eq(schema.agentTasks.leaseOwner, run.lease!.workerId),
              eq(schema.agentTasks.leaseToken, run.lease!.token),
              eq(schema.agentTasks.leaseGeneration, run.lease!.generation),
              gt(schema.agentTasks.leaseExpiresAt, now),
              inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"])
            )
          )
          .returning({ id: schema.agentTasks.id });
        if (!leaseConfirmed[0]) throw new Error("Task lease was lost before run persistence.");
        await tx.insert(schema.agentRuns).values(payload);
      });
    } else {
      await executeWithRetry(() => database.insert(schema.agentRuns).values(payload));
    }
    return payload;
  },
};

export const NexusRepository = {
  async recordDelegation(data: {
    id?: string;
    taskId: string;
    subtaskId?: string;
    lease?: AgentTaskLease;
    parentAgentId: string;
    targetAgentId: string;
    depth: number;
    reason: string;
    status: "pending" | "running" | "completed" | "failed" | "blocked";
    budgetAllocated?: Record<string, any>;
    inputSummary?: string;
    outputSummary?: string;
    blockedReason?: string;
    durationMs?: number;
    completedAt?: Date | null;
  }) {
    const database = await getReadyDb();
    const id = data.id || `del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const row = {
      id,
      taskId: data.taskId,
      subtaskId: data.subtaskId || null,
      parentAgentId: data.parentAgentId,
      targetAgentId: data.targetAgentId,
      depth: data.depth,
      reason: data.reason,
      status: data.status,
      budgetAllocated: data.budgetAllocated || {},
      inputSummary: data.inputSummary || null,
      outputSummary: data.outputSummary || null,
      blockedReason: data.blockedReason || null,
      durationMs: data.durationMs || 0,
      createdAt: now,
      completedAt: data.completedAt ?? null,
    };
    if (data.lease) {
      await database.transaction(async (tx) => {
        const leaseConfirmed = await tx
          .update(schema.agentTasks)
          .set({ updatedAt: now })
          .where(
            and(
              eq(schema.agentTasks.id, data.taskId),
              eq(schema.agentTasks.leaseOwner, data.lease!.workerId),
              eq(schema.agentTasks.leaseToken, data.lease!.token),
              eq(schema.agentTasks.leaseGeneration, data.lease!.generation),
              gt(schema.agentTasks.leaseExpiresAt, now),
              inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"])
            )
          )
          .returning({ id: schema.agentTasks.id });
        if (!leaseConfirmed[0]) throw new Error("Task lease was lost before delegation persistence.");
        await tx.insert(schema.nexusDelegations).values(row);
      });
    } else {
      await executeWithRetry(() => database.insert(schema.nexusDelegations).values(row));
    }
    return row;
  },

  async listDelegationsByTask(taskId: string) {
    const database = await getReadyDb();
    return database
      .select()
      .from(schema.nexusDelegations)
      .where(eq(schema.nexusDelegations.taskId, taskId))
      .orderBy(schema.nexusDelegations.createdAt);
  },

  async recordSkillActivations(
    activations: Array<{
      id?: string;
      taskId: string;
      subtaskId?: string;
      agentId: string;
      skillId: string;
      skillVersion: string;
      relevanceScore?: number;
      reason?: string;
      estimatedTokens?: number;
      status?: string;
    }>,
    lease?: AgentTaskLease
  ) {
    if (!activations || activations.length === 0) return [];
    const taskId = activations[0].taskId;
    if (activations.some((activation) => activation.taskId !== taskId)) {
      throw new Error("Skill activations from multiple tasks cannot share one persistence operation.");
    }
    const database = await getReadyDb();
    const now = new Date();
    const rows = activations.map((a) => ({
      id: a.id || `skact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      taskId: a.taskId,
      subtaskId: a.subtaskId || null,
      agentId: a.agentId,
      skillId: a.skillId,
      skillVersion: a.skillVersion,
      relevanceScore: a.relevanceScore ?? 0,
      reason: a.reason || null,
      estimatedTokens: a.estimatedTokens ?? 0,
      status: a.status || "active",
      activatedAt: now,
    }));
    await executeWithRetry(() =>
      database.transaction(async (tx) => {
        const leaseConditions = lease
          ? [
              eq(schema.agentTasks.leaseOwner, lease.workerId),
              eq(schema.agentTasks.leaseToken, lease.token),
              eq(schema.agentTasks.leaseGeneration, lease.generation),
              gt(schema.agentTasks.leaseExpiresAt, now),
              inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"]),
            ]
          : [
              or(
                isNull(schema.agentTasks.leaseOwner),
                lte(schema.agentTasks.leaseExpiresAt, now)
              ),
            ];
        const leaseConfirmed = await tx
          .update(schema.agentTasks)
          .set({ updatedAt: now })
          .where(and(eq(schema.agentTasks.id, taskId), ...leaseConditions))
          .returning({ id: schema.agentTasks.id });
        if (!leaseConfirmed[0]) {
          throw new Error(
            lease
              ? "Task lease was lost before skill-activation persistence."
              : "Task has an active lease; unfenced skill-activation persistence was rejected."
          );
        }
        await tx.insert(schema.nexusSkillActivations).values(rows);
      })
    );
    return rows;
  },

  async recordExecutionTrace(trace: {
    id?: string;
    taskId: string;
    lease?: AgentTaskLease;
    userId: string;
    engineMode: string;
    agentId: string;
    agentVersion?: string;
    modelUsed: string;
    providerUsed: string;
    routingReason?: string;
    skillsUsed?: string[];
    toolsInvoked?: Array<Record<string, any>>;
    delegationsCount?: number;
    checkpointId?: string;
    completedStepKeys?: string[];
    evidence?: Record<string, any>;
    costEstimateUsd?: number;
    latencyMs?: number;
    status: string;
    errorSummary?: string;
    configSnapshot?: Record<string, any>;
  }) {
    const database = await getReadyDb();
    const id = trace.id || `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date();
    const row = {
      id,
      taskId: trace.taskId,
      userId: trace.userId,
      engineMode: trace.engineMode,
      agentId: trace.agentId,
      agentVersion: trace.agentVersion || "1.0.0",
      modelUsed: trace.modelUsed,
      providerUsed: trace.providerUsed,
      routingReason: trace.routingReason || null,
      skillsUsed: trace.skillsUsed || [],
      toolsInvoked: trace.toolsInvoked || [],
      delegationsCount: trace.delegationsCount ?? 0,
      checkpointId: trace.checkpointId || null,
      completedStepKeys: trace.completedStepKeys || [],
      evidence: trace.evidence || {},
      costEstimateUsd: trace.costEstimateUsd ?? 0,
      latencyMs: trace.latencyMs ?? 0,
      status: trace.status,
      errorSummary: trace.errorSummary || null,
      configSnapshot: trace.configSnapshot || {},
      createdAt: now,
    };
    if (trace.lease) {
      await database.transaction(async (tx) => {
        const leaseConfirmed = await tx
          .update(schema.agentTasks)
          .set({ updatedAt: now })
          .where(
            and(
              eq(schema.agentTasks.id, trace.taskId),
              eq(schema.agentTasks.leaseOwner, trace.lease!.workerId),
              eq(schema.agentTasks.leaseToken, trace.lease!.token),
              eq(schema.agentTasks.leaseGeneration, trace.lease!.generation),
              gt(schema.agentTasks.leaseExpiresAt, now),
              inArray(schema.agentTasks.status, ["running", "planning", "executing", "verifying"])
            )
          )
          .returning({ id: schema.agentTasks.id });
        if (!leaseConfirmed[0]) throw new Error("Task lease was lost before execution-trace persistence.");
        await tx.insert(schema.nexusExecutionTraces).values(row);
      });
    } else {
      await executeWithRetry(() => database.insert(schema.nexusExecutionTraces).values(row));
    }
    return row;
  },

  async getTracesByTask(taskId: string) {
    const database = await getReadyDb();
    return database
      .select()
      .from(schema.nexusExecutionTraces)
      .where(eq(schema.nexusExecutionTraces.taskId, taskId))
      .orderBy(desc(schema.nexusExecutionTraces.createdAt));
  },
};

// ==========================================
// 10. Durable Worker Jobs Repository (Claim / Lease / Retry / Checkpoint)
// ==========================================

export type WorkerJobStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";

export const WorkerJobRepository = {
  async enqueue(data: {
    id?: string;
    type: string;
    payload?: Record<string, any>;
    maxAttempts?: number;
    userId?: string;
    projectId?: string;
    status?: WorkerJobStatus;
    nextRetryAt?: Date | null;
  }) {
    const database = await getReadyDb();
    const id = data.id || `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    const row = {
      id,
      type: data.type,
      payload: data.payload || {},
      status: data.status || "queued",
      attempts: 0,
      maxAttempts: data.maxAttempts ?? 3,
      nextRetryAt: data.nextRetryAt ?? null,
      leaseOwner: null as string | null,
      leaseExpiresAt: null as Date | null,
      checkpoint: {},
      result: {},
      error: null as string | null,
      userId: data.userId || null,
      projectId: data.projectId || null,
      createdAt: now,
      updatedAt: now,
      startedAt: null as Date | null,
      completedAt: null as Date | null,
    };

    await database
      .insert(schema.workerJobs)
      .values(row)
      .onConflictDoUpdate({
        target: schema.workerJobs.id,
        set: {
          type: row.type,
          payload: row.payload,
          status: row.status,
          updatedAt: now,
        },
      });
    return row;
  },

  async getById(jobId: string, userId?: string) {
    const database = await getReadyDb();
    let cond: any = eq(schema.workerJobs.id, jobId);
    if (userId) {
      cond = and(cond, eq(schema.workerJobs.userId, userId));
    }
    const rows = await database.select().from(schema.workerJobs).where(cond).limit(1);
    return rows[0] || null;
  },

  async listByUser(userId: string, limitCount = 50) {
    const database = await getReadyDb();
    return database
      .select()
      .from(schema.workerJobs)
      .where(eq(schema.workerJobs.userId, userId))
      .orderBy(desc(schema.workerJobs.createdAt))
      .limit(limitCount);
  },

  async listByStatus(status: WorkerJobStatus, limitCount = 50) {
    const database = await getReadyDb();
    return database
      .select()
      .from(schema.workerJobs)
      .where(eq(schema.workerJobs.status, status))
      .orderBy(schema.workerJobs.createdAt)
      .limit(limitCount);
  },

  async claimNextJob(workerId: string, leaseDurationMs = 90_000, allowedTypes?: string[]) {
    return executeWithRetry(async (database) => {
      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

      return database.transaction(async (tx) => {
        const readinessCondition = or(
          and(
            inArray(schema.workerJobs.status, ["pending", "queued"]),
            or(isNull(schema.workerJobs.nextRetryAt), lte(schema.workerJobs.nextRetryAt, now))
          ),
          and(
            eq(schema.workerJobs.status, "running"),
            or(isNull(schema.workerJobs.leaseExpiresAt), lte(schema.workerJobs.leaseExpiresAt, now))
          )
        );

        const whereClause =
          allowedTypes && allowedTypes.length > 0
            ? and(readinessCondition, inArray(schema.workerJobs.type, allowedTypes))
            : readinessCondition;

        const candidates = await tx
          .select({ id: schema.workerJobs.id })
          .from(schema.workerJobs)
          .where(whereClause)
          .orderBy(schema.workerJobs.createdAt)
          .limit(1);

        if (!candidates[0]) return null;

        const claimed = await tx
          .update(schema.workerJobs)
          .set({
            status: "running",
            leaseOwner: workerId,
            leaseExpiresAt,
            attempts: sql`${schema.workerJobs.attempts} + 1`,
            startedAt: now,
            updatedAt: now,
          })
          .where(and(eq(schema.workerJobs.id, candidates[0].id), readinessCondition))
          .returning();

        return claimed[0] || null;
      });
    });
  },

  async claimSpecificJob(jobId: string, workerId: string, leaseDurationMs = 90_000) {
    return executeWithRetry(async (database) => {
      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

      const readinessCondition = and(
        eq(schema.workerJobs.id, jobId),
        or(
          inArray(schema.workerJobs.status, ["pending", "queued"]),
          and(
            eq(schema.workerJobs.status, "running"),
            or(isNull(schema.workerJobs.leaseExpiresAt), lte(schema.workerJobs.leaseExpiresAt, now))
          )
        )
      );

      const claimed = await database
        .update(schema.workerJobs)
        .set({
          status: "running",
          leaseOwner: workerId,
          leaseExpiresAt,
          attempts: sql`${schema.workerJobs.attempts} + 1`,
          startedAt: now,
          updatedAt: now,
        })
        .where(readinessCondition)
        .returning();

      return claimed[0] || null;
    });
  },

  async renewLease(jobId: string, workerId: string, leaseDurationMs = 90_000) {
    const database = await getReadyDb();
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);
    const updated = await database
      .update(schema.workerJobs)
      .set({ leaseExpiresAt, updatedAt: now })
      .where(and(eq(schema.workerJobs.id, jobId), eq(schema.workerJobs.leaseOwner, workerId), eq(schema.workerJobs.status, "running")))
      .returning();
    return Boolean(updated[0]);
  },

  async updateCheckpoint(jobId: string, checkpoint: Record<string, any>) {
    const database = await getReadyDb();
    await database
      .update(schema.workerJobs)
      .set({ checkpoint: checkpoint || {}, updatedAt: new Date() })
      .where(eq(schema.workerJobs.id, jobId));
  },

  async completeJob(jobId: string, workerId: string, result: Record<string, any> = {}) {
    const database = await getReadyDb();
    const now = new Date();
    const updated = await database
      .update(schema.workerJobs)
      .set({
        status: "completed",
        result,
        error: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: now,
        updatedAt: now,
      })
      .where(and(eq(schema.workerJobs.id, jobId), or(eq(schema.workerJobs.leaseOwner, workerId), isNull(schema.workerJobs.leaseOwner))))
      .returning();
    return updated[0] || null;
  },

  async failJob(jobId: string, workerId: string, errorMessage: string, retryDelayMs?: number) {
    const database = await getReadyDb();
    const now = new Date();

    return database.transaction(async (tx) => {
      const rows = await tx.select().from(schema.workerJobs).where(eq(schema.workerJobs.id, jobId)).limit(1);
      const job = rows[0];
      if (!job) return null;

      const canRetry = job.attempts < job.maxAttempts;
      if (canRetry) {
        const backoffMs = retryDelayMs ?? Math.min(60_000, 1000 * Math.pow(2, Math.max(0, job.attempts)));
        const nextRetryAt = new Date(now.getTime() + backoffMs);
        const updated = await tx
          .update(schema.workerJobs)
          .set({
            status: "queued",
            error: errorMessage,
            nextRetryAt,
            leaseOwner: null,
            leaseExpiresAt: null,
            updatedAt: now,
          })
          .where(and(eq(schema.workerJobs.id, jobId), or(eq(schema.workerJobs.leaseOwner, workerId), isNull(schema.workerJobs.leaseOwner))))
          .returning();
        return updated[0] || null;
      }

      const updated = await tx
        .update(schema.workerJobs)
        .set({
          status: "failed",
          error: errorMessage,
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: now,
          updatedAt: now,
        })
        .where(and(eq(schema.workerJobs.id, jobId), or(eq(schema.workerJobs.leaseOwner, workerId), isNull(schema.workerJobs.leaseOwner))))
        .returning();
      return updated[0] || null;
    });
  },

  async cancelJob(jobId: string, userId?: string) {
    const database = await getReadyDb();
    const now = new Date();
    let cond: any = eq(schema.workerJobs.id, jobId);
    if (userId) {
      cond = and(cond, eq(schema.workerJobs.userId, userId));
    }
    const updated = await database
      .update(schema.workerJobs)
      .set({
        status: "cancelled",
        leaseOwner: null,
        leaseExpiresAt: null,
        completedAt: now,
        updatedAt: now,
      })
      .where(cond)
      .returning();
    return updated[0] || null;
  },

  async resumeJob(jobId: string, userId?: string) {
    const database = await getReadyDb();
    const now = new Date();
    let cond: any = and(eq(schema.workerJobs.id, jobId), inArray(schema.workerJobs.status, ["failed", "cancelled", "running", "pending"]));
    if (userId) {
      cond = and(cond, eq(schema.workerJobs.userId, userId));
    }
    const updated = await database
      .update(schema.workerJobs)
      .set({
        status: "queued",
        nextRetryAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
        updatedAt: now,
      })
      .where(cond)
      .returning();
    return updated[0] || null;
  },

  async recoverStaleLeases() {
    const database = await getReadyDb();
    const now = new Date();
    const recovered = await database
      .update(schema.workerJobs)
      .set({
        status: "queued",
        leaseOwner: null,
        leaseExpiresAt: null,
        nextRetryAt: now,
        updatedAt: now,
      })
      .where(and(eq(schema.workerJobs.status, "running"), lte(schema.workerJobs.leaseExpiresAt, now)))
      .returning();
    return recovered.length;
  },

  async getQueueStats() {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select({
          status: schema.workerJobs.status,
          count: sql<number>`count(*)`,
        })
        .from(schema.workerJobs)
        .groupBy(schema.workerJobs.status);

      const stats: Record<string, number> = {
        pending: 0,
        queued: 0,
        running: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      };
      for (const r of rows) {
        stats[r.status] = Number(r.count || 0);
      }
      return stats;
    } catch {
      return { pending: 0, queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
    }
  },
};

// ==========================================
// 11. Watch History & Media Repository (Turso)
// ==========================================

export const WatchHistoryRepository = {
  async saveProgress(
    userId: string,
    mediaId: string,
    positionSeconds: number,
    durationSeconds: number,
    completed: boolean = false,
    metadata: Record<string, any> = {}
  ) {
    const database = await getReadyDb();
    const id = `wh_${userId}_${mediaId}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const now = new Date();

    const payload = {
      id,
      userId,
      mediaId,
      positionSeconds: Math.floor(positionSeconds || 0),
      durationSeconds: Math.floor(durationSeconds || 0),
      completed: !!completed,
      lastWatchedAt: now,
      metadata: metadata || {},
      updatedAt: now,
    };

    try {
      await UserRepository.upsertUser({ id: userId, email: `${userId}@souftools.app` });
      await database
        .insert(schema.watchHistory)
        .values({
          ...payload,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: [schema.watchHistory.userId, schema.watchHistory.mediaId],
          set: {
            positionSeconds: payload.positionSeconds,
            durationSeconds: payload.durationSeconds,
            completed: payload.completed,
            lastWatchedAt: now,
            metadata: payload.metadata,
            updatedAt: now,
          },
        });
    } catch (err) {
      console.error("[Turso WatchHistoryRepository.saveProgress] error:", err);
    }

    return payload;
  },

  async getProgress(userId: string, mediaId: string) {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.watchHistory)
        .where(and(eq(schema.watchHistory.userId, userId), eq(schema.watchHistory.mediaId, mediaId)))
        .limit(1);
      return rows[0] || null;
    } catch (err) {
      console.error("[Turso WatchHistoryRepository.getProgress] error:", err);
      return null;
    }
  },

  async listUserHistory(userId: string, limitCount = 30) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.watchHistory)
        .where(eq(schema.watchHistory.userId, userId))
        .orderBy(desc(schema.watchHistory.lastWatchedAt))
        .limit(limitCount);
    } catch (err) {
      console.error("[Turso WatchHistoryRepository.listUserHistory] error:", err);
      return [];
    }
  },

  async deleteHistory(userId: string, mediaId: string) {
    const database = await getReadyDb();
    try {
      await database
        .delete(schema.watchHistory)
        .where(and(eq(schema.watchHistory.userId, userId), eq(schema.watchHistory.mediaId, mediaId)));
      return true;
    } catch (err) {
      console.error("[Turso WatchHistoryRepository.deleteHistory] error:", err);
      return false;
    }
  },
};

// ==========================================
// 12. Database-Backed Scheduled Tasks Repository (Turso)
// ==========================================

export const ScheduledTaskRepository = {
  async createTask(task: {
    id?: string;
    userId: string;
    chatId?: string;
    channel?: "telegram" | "web" | "email" | "whatsapp";
    title: string;
    type?: "reminder" | "email" | "research" | "code" | "general_task";
    prompt?: string;
    payload?: Record<string, any>;
    targetTimestamp: number;
    targetDateIso: string;
    recurrence?: "once" | "daily" | "weekly" | "monthly" | "workdays";
    autoExecute?: boolean;
  }) {
    const database = await getReadyDb();
    const taskId = task.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    const record = {
      id: taskId,
      userId: task.userId,
      chatId: task.chatId || null,
      channel: task.channel || "web",
      title: task.title,
      type: task.type || "reminder",
      prompt: task.prompt || task.title,
      payload: task.payload || {},
      status: "pending",
      targetTimestamp: task.targetTimestamp,
      targetDateIso: task.targetDateIso || new Date(task.targetTimestamp).toISOString(),
      recurrence: task.recurrence || "once",
      autoExecute: task.autoExecute !== false,
      executionResult: {},
      lastError: null as string | null,
      retryCount: 0,
      leaseOwner: null as string | null,
      leaseExpiresAt: null as Date | null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await database.insert(schema.scheduledTasks).values(record);
    } catch (err) {
      console.error("[Turso ScheduledTaskRepository.createTask] error:", err);
    }

    return record;
  },

  async getTaskById(id: string) {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.scheduledTasks)
        .where(eq(schema.scheduledTasks.id, id))
        .limit(1);
      return rows[0] || null;
    } catch (err) {
      console.error("[Turso ScheduledTaskRepository.getTaskById] error:", err);
      return null;
    }
  },

  async listTasksByUser(userId: string, status?: string, limitCount = 50) {
    const database = await getReadyDb();
    try {
      const conditions: any[] = [eq(schema.scheduledTasks.userId, userId)];
      if (status) {
        conditions.push(eq(schema.scheduledTasks.status, status));
      }
      return await database
        .select()
        .from(schema.scheduledTasks)
        .where(and(...conditions))
        .orderBy(desc(schema.scheduledTasks.targetTimestamp))
        .limit(limitCount);
    } catch (err) {
      console.error("[Turso ScheduledTaskRepository.listTasksByUser] error:", err);
      return [];
    }
  },

  async listPendingDueTasks(beforeTimestamp: number = Date.now(), limitCount = 50) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.scheduledTasks)
        .where(and(eq(schema.scheduledTasks.status, "pending"), lte(schema.scheduledTasks.targetTimestamp, beforeTimestamp)))
        .orderBy(schema.scheduledTasks.targetTimestamp)
        .limit(limitCount);
    } catch (err) {
      console.error("[Turso ScheduledTaskRepository.listPendingDueTasks] error:", err);
      return [];
    }
  },

  async claimDueTasks(
    workerId: string,
    leaseDurationMs = 90_000,
    beforeTimestamp: number = Date.now(),
    limitCount = 20
  ) {
    try {
      return await executeWithRetry(async (database) => {
        const now = new Date();
        const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

        return database.transaction(async (tx) => {
          const dueCandidates = await tx
            .select({ id: schema.scheduledTasks.id })
            .from(schema.scheduledTasks)
            .where(
              or(
                and(eq(schema.scheduledTasks.status, "pending"), lte(schema.scheduledTasks.targetTimestamp, beforeTimestamp)),
                and(
                  eq(schema.scheduledTasks.status, "executing"),
                  or(isNull(schema.scheduledTasks.leaseExpiresAt), lte(schema.scheduledTasks.leaseExpiresAt, now))
                )
              )
            )
            .orderBy(schema.scheduledTasks.targetTimestamp)
            .limit(limitCount);

          if (dueCandidates.length === 0) return [];
          const ids = dueCandidates.map((c) => c.id);

          return await tx
            .update(schema.scheduledTasks)
            .set({
              status: "executing",
              leaseOwner: workerId,
              leaseExpiresAt,
              updatedAt: now,
            })
            .where(
              and(
                inArray(schema.scheduledTasks.id, ids),
                or(
                  eq(schema.scheduledTasks.status, "pending"),
                  and(
                    eq(schema.scheduledTasks.status, "executing"),
                    or(isNull(schema.scheduledTasks.leaseExpiresAt), lte(schema.scheduledTasks.leaseExpiresAt, now))
                  )
                )
              )
            )
            .returning();
        });
      });
    } catch (err) {
      console.error("[Turso ScheduledTaskRepository.claimDueTasks] error:", err);
      return [];
    }
  },

  async updateTaskStatus(
    id: string,
    status: "pending" | "executing" | "completed" | "failed" | "cancelled",
    result?: Record<string, any>,
    lastError?: string
  ) {
    const database = await getReadyDb();
    const now = new Date();
    try {
      const updateData: any = {
        status,
        updatedAt: now,
      };
      if (status !== "executing") {
        updateData.leaseOwner = null;
        updateData.leaseExpiresAt = null;
      }
      if (result !== undefined) updateData.executionResult = result;
      if (lastError !== undefined) updateData.lastError = lastError;
      if (status === "completed" || status === "failed") {
        updateData.executedAt = now;
      }

      await database.update(schema.scheduledTasks).set(updateData).where(eq(schema.scheduledTasks.id, id));
      return true;
    } catch (err) {
      console.error("[Turso ScheduledTaskRepository.updateTaskStatus] error:", err);
      return false;
    }
  },

  async rescheduleRecurringTask(
    id: string,
    nextTimestamp: number,
    nextDateIso: string,
    lastResult?: Record<string, any>
  ) {
    const database = await getReadyDb();
    const now = new Date();
    try {
      await database
        .update(schema.scheduledTasks)
        .set({
          status: "pending",
          targetTimestamp: nextTimestamp,
          targetDateIso: nextDateIso,
          executionResult: lastResult || {},
          lastError: null,
          retryCount: 0,
          leaseOwner: null,
          leaseExpiresAt: null,
          executedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.scheduledTasks.id, id));
      return true;
    } catch (err) {
      console.error("[Turso ScheduledTaskRepository.rescheduleRecurringTask] error:", err);
      return false;
    }
  },

  async cancelTask(id: string, reason = "User requested cancellation") {
    return this.updateTaskStatus(id, "cancelled", { cancellationReason: reason });
  },

  async deleteTask(id: string) {
    const database = await getReadyDb();
    try {
      await database.delete(schema.scheduledTasks).where(eq(schema.scheduledTasks.id, id));
      return true;
    } catch (err) {
      console.error("[Turso ScheduledTaskRepository.deleteTask] error:", err);
      return false;
    }
  },
};

// ==========================================
// 13. Notification Repository (Turso)
// ==========================================

export const NotificationRepository = {
  async createNotification(notification: {
    id?: string;
    userId: string;
    title: string;
    message: string;
    type?: "info" | "success" | "warning" | "security" | "system";
    metadata?: Record<string, any>;
  }) {
    const database = await getReadyDb();
    const id = notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    try {
      await UserRepository.upsertUser({
        id: notification.userId,
        email: `${notification.userId}@souftools.app`,
      });
      const record = {
        id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type || "info",
        isRead: false,
        metadata: notification.metadata || {},
        version: 1,
        createdAt: now,
      };
      await database.insert(schema.notifications).values(record);
      return record;
    } catch (err) {
      console.error("[Turso NotificationRepository.createNotification] error:", err);
      return null;
    }
  },

  async listByUser(userId: string, limitCount = 30) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .orderBy(desc(schema.notifications.createdAt))
        .limit(limitCount);
    } catch (err) {
      console.error("[Turso NotificationRepository.listByUser] error:", err);
      return [];
    }
  },

  async markAsRead(id: string, userId: string) {
    const database = await getReadyDb();
    try {
      await database
        .update(schema.notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, userId)));
      return true;
    } catch (err) {
      console.error("[Turso NotificationRepository.markAsRead] error:", err);
      return false;
    }
  },

  async broadcastAdminAlert(alert: {
    title: string;
    message: string;
    type?: "security" | "system" | "warning";
    metadata?: Record<string, any>;
  }) {
    const database = await getReadyDb();
    try {
      const admins = await database
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.role, "super_admin"));

      const targetUserIds = new Set<string>(admins.map((a) => a.id));
      if (targetUserIds.size === 0) {
        targetUserIds.add("admin");
      }

      for (const uid of targetUserIds) {
        await this.createNotification({
          userId: uid,
          title: alert.title,
          message: alert.message,
          type: alert.type || "security",
          metadata: alert.metadata || {},
        });
      }
      return true;
    } catch (err) {
      console.error("[Turso NotificationRepository.broadcastAdminAlert] error:", err);
      return false;
    }
  },
};

// ==========================================
// 14. User Adaptive Learning & Habit Repository (Turso)
// ==========================================

export const UserLearningRepository = {
  async recordPattern(
    userId: string,
    pattern: {
      patternType: "time_habit" | "topic_interest" | "tool_affinity" | "communication_style" | "scheduled_routine";
      category: string;
      key: string;
      value: string;
      confidence?: number;
      insights?: Record<string, any>;
    }
  ) {
    const database = await getReadyDb();
    const now = new Date();
    const patternId = `learn_${userId.replace(/[^a-zA-Z0-9]/g, "_")}_${pattern.key.replace(/[^a-zA-Z0-9]/g, "_")}`;

    try {
      const existing = await database
        .select()
        .from(schema.userLearningPatterns)
        .where(and(eq(schema.userLearningPatterns.userId, userId), eq(schema.userLearningPatterns.key, pattern.key)))
        .limit(1);

      if (existing.length > 0) {
        const cur = existing[0];
        const newOccurrences = (cur.occurrences || 1) + 1;
        const newConfidence = Math.min(0.99, (cur.confidence || 0.5) + 0.08);
        const mergedInsights = { ...(cur.insights || {}), ...(pattern.insights || {}), lastSeen: now.toISOString() };

        await database
          .update(schema.userLearningPatterns)
          .set({
            value: pattern.value,
            confidence: newConfidence,
            occurrences: newOccurrences,
            insights: mergedInsights,
            lastObservedAt: now,
            updatedAt: now,
          })
          .where(eq(schema.userLearningPatterns.id, cur.id));
      } else {
        await database.insert(schema.userLearningPatterns).values({
          id: patternId,
          userId,
          patternType: pattern.patternType,
          category: pattern.category,
          key: pattern.key,
          value: pattern.value,
          confidence: pattern.confidence || 0.65,
          occurrences: 1,
          insights: pattern.insights || {},
          lastObservedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
      return true;
    } catch (err) {
      console.error("[Turso UserLearningRepository.recordPattern] error:", err);
      return false;
    }
  },

  async listPatternsByUser(userId: string, patternType?: string, limitCount = 50) {
    const database = await getReadyDb();
    try {
      const conditions: any[] = [eq(schema.userLearningPatterns.userId, userId)];
      if (patternType) {
        conditions.push(eq(schema.userLearningPatterns.patternType, patternType));
      }
      return await database
        .select()
        .from(schema.userLearningPatterns)
        .where(and(...conditions))
        .orderBy(desc(schema.userLearningPatterns.confidence))
        .limit(limitCount);
    } catch (err) {
      console.error("[Turso UserLearningRepository.listPatternsByUser] error:", err);
      return [];
    }
  },

  async getUserHabitSummary(userId: string): Promise<string> {
    const patterns = await this.listPatternsByUser(userId, undefined, 20);
    if (!patterns || patterns.length === 0) return "";

    const lines = patterns.map(
      (p: any) => `- [${p.category || p.patternType}]: ${p.value} (ثقة: ${Math.round((p.confidence || 0.5) * 100)}%)`
    );
    return `\n\n[خلاصة أنماط وعادات المستخدم المستنبطة بالذكاء الاصطناعي]:\n${lines.join("\n")}\nتفاعل مع المستخدم بناءً على هذه المعارف لتخصيص الرد والجدولة بدقة.`;
  },
};

// ==========================================
// 15. WhatsApp Auth State Repository (Turso)
// ==========================================

export const WhatsAppAuthRepository = {
  async get(sessionId: string, keyId: string): Promise<string | null> {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select({ data: schema.whatsappAuthSessions.data })
        .from(schema.whatsappAuthSessions)
        .where(and(eq(schema.whatsappAuthSessions.sessionId, sessionId), eq(schema.whatsappAuthSessions.keyId, keyId)))
        .limit(1);
      return rows[0]?.data || null;
    } catch (err) {
      console.error("[Turso WhatsAppAuthRepository.get] error:", err);
      return null;
    }
  },

  async getMany(sessionId: string, keyIds: string[]): Promise<Record<string, string>> {
    if (!keyIds || keyIds.length === 0) return {};
    const database = await getReadyDb();
    const result: Record<string, string> = {};
    try {
      for (const batch of chunkArray(keyIds, 400)) {
        const rows = await database
          .select({ keyId: schema.whatsappAuthSessions.keyId, data: schema.whatsappAuthSessions.data })
          .from(schema.whatsappAuthSessions)
          .where(and(eq(schema.whatsappAuthSessions.sessionId, sessionId), inArray(schema.whatsappAuthSessions.keyId, batch)));
        for (const row of rows) {
          result[row.keyId] = row.data;
        }
      }
      return result;
    } catch (err) {
      console.error("[Turso WhatsAppAuthRepository.getMany] error:", err);
      return result;
    }
  },

  async set(sessionId: string, keyId: string, data: string): Promise<boolean> {
    const database = await getReadyDb();
    const now = new Date();
    try {
      await database
        .insert(schema.whatsappAuthSessions)
        .values({
          sessionId,
          keyId,
          data,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [schema.whatsappAuthSessions.sessionId, schema.whatsappAuthSessions.keyId],
          set: {
            data,
            updatedAt: now,
          },
        });
      return true;
    } catch (err) {
      console.error("[Turso WhatsAppAuthRepository.set] error:", err);
      return false;
    }
  },

  async setMany(sessionId: string, items: Array<{ keyId: string; data: string }>): Promise<boolean> {
    if (!items || items.length === 0) return true;
    const database = await getReadyDb();
    const now = new Date();
    try {
      await database.transaction(async (tx) => {
        for (const item of items) {
          await tx
            .insert(schema.whatsappAuthSessions)
            .values({
              sessionId,
              keyId: item.keyId,
              data: item.data,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [schema.whatsappAuthSessions.sessionId, schema.whatsappAuthSessions.keyId],
              set: {
                data: item.data,
                updatedAt: now,
              },
            });
        }
      });
      return true;
    } catch (err) {
      console.error("[Turso WhatsAppAuthRepository.setMany] error:", err);
      return false;
    }
  },

  async remove(sessionId: string, keyId: string): Promise<boolean> {
    const database = await getReadyDb();
    try {
      await database
        .delete(schema.whatsappAuthSessions)
        .where(and(eq(schema.whatsappAuthSessions.sessionId, sessionId), eq(schema.whatsappAuthSessions.keyId, keyId)));
      return true;
    } catch (err) {
      console.error("[Turso WhatsAppAuthRepository.remove] error:", err);
      return false;
    }
  },

  async removeMany(sessionId: string, keyIds: string[]): Promise<boolean> {
    if (!keyIds || keyIds.length === 0) return true;
    const database = await getReadyDb();
    try {
      for (const batch of chunkArray(keyIds, 400)) {
        await database
          .delete(schema.whatsappAuthSessions)
          .where(and(eq(schema.whatsappAuthSessions.sessionId, sessionId), inArray(schema.whatsappAuthSessions.keyId, batch)));
      }
      return true;
    } catch (err) {
      console.error("[Turso WhatsAppAuthRepository.removeMany] error:", err);
      return false;
    }
  },

  async clearSession(sessionId: string): Promise<boolean> {
    const database = await getReadyDb();
    try {
      await database.delete(schema.whatsappAuthSessions).where(eq(schema.whatsappAuthSessions.sessionId, sessionId));
      return true;
    } catch (err) {
      console.error("[Turso WhatsAppAuthRepository.clearSession] error:", err);
      return false;
    }
  },

  async hasSession(sessionId: string = "default"): Promise<boolean> {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select({ keyId: schema.whatsappAuthSessions.keyId })
        .from(schema.whatsappAuthSessions)
        .where(and(eq(schema.whatsappAuthSessions.sessionId, sessionId), eq(schema.whatsappAuthSessions.keyId, "creds")))
        .limit(1);
      return rows.length > 0;
    } catch {
      return false;
    }
  },
};

// ==========================================
// 16. WhatsApp Paired Users Repository (Turso)
// ==========================================

export interface WhatsAppPairedUserData {
  phone: string;
  userId?: string | null;
  email?: string | null;
  firstName?: string | null;
  pairingCode?: string | null;
  linkedAt?: Date | null;
  updatedAt?: Date | null;
}

export const WhatsAppPairedUsersRepository = {
  async getByPhone(phone: string): Promise<WhatsAppPairedUserData | null> {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.whatsappPairedUsers)
        .where(eq(schema.whatsappPairedUsers.phone, phone))
        .limit(1);
      return rows[0] || null;
    } catch (err) {
      console.error("[Turso WhatsAppPairedUsersRepository.getByPhone] error:", err);
      return null;
    }
  },

  async getByUserId(userId: string): Promise<WhatsAppPairedUserData | null> {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.whatsappPairedUsers)
        .where(eq(schema.whatsappPairedUsers.userId, userId))
        .limit(1);
      return rows[0] || null;
    } catch (err) {
      console.error("[Turso WhatsAppPairedUsersRepository.getByUserId] error:", err);
      return null;
    }
  },

  async getByEmail(email: string): Promise<WhatsAppPairedUserData | null> {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.whatsappPairedUsers)
        .where(eq(schema.whatsappPairedUsers.email, email.toLowerCase().trim()))
        .limit(1);
      return rows[0] || null;
    } catch (err) {
      console.error("[Turso WhatsAppPairedUsersRepository.getByEmail] error:", err);
      return null;
    }
  },

  async link(
    phone: string,
    data: { userId?: string; email?: string; firstName?: string; pairingCode?: string }
  ): Promise<WhatsAppPairedUserData | null> {
    const database = await getReadyDb();
    const now = new Date();
    try {
      const cleanPhone = phone.trim();
      const cleanEmail = data.email ? data.email.toLowerCase().trim() : null;

      await database
        .insert(schema.whatsappPairedUsers)
        .values({
          phone: cleanPhone,
          userId: data.userId || null,
          email: cleanEmail,
          firstName: data.firstName || null,
          pairingCode: data.pairingCode || null,
          linkedAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.whatsappPairedUsers.phone,
          set: {
            userId: data.userId || null,
            email: cleanEmail,
            firstName: data.firstName || null,
            pairingCode: data.pairingCode || null,
            updatedAt: now,
          },
        });

      return {
        phone: cleanPhone,
        userId: data.userId || null,
        email: cleanEmail,
        firstName: data.firstName || null,
        pairingCode: data.pairingCode || null,
        linkedAt: now,
        updatedAt: now,
      };
    } catch (err) {
      console.error("[Turso WhatsAppPairedUsersRepository.link] error:", err);
      return null;
    }
  },

  async unlink(phone: string): Promise<boolean> {
    const database = await getReadyDb();
    try {
      await database.delete(schema.whatsappPairedUsers).where(eq(schema.whatsappPairedUsers.phone, phone.trim()));
      return true;
    } catch (err) {
      console.error("[Turso WhatsAppPairedUsersRepository.unlink] error:", err);
      return false;
    }
  },

  async unlinkByUserIdOrEmail(identifier: string): Promise<boolean> {
    const database = await getReadyDb();
    try {
      const clean = identifier.trim().toLowerCase();
      await database
        .delete(schema.whatsappPairedUsers)
        .where(
          or(
            eq(schema.whatsappPairedUsers.userId, identifier.trim()),
            eq(schema.whatsappPairedUsers.email, clean),
            eq(schema.whatsappPairedUsers.phone, identifier.trim())
          )
        );
      return true;
    } catch (err) {
      console.error("[Turso WhatsAppPairedUsersRepository.unlinkByUserIdOrEmail] error:", err);
      return false;
    }
  },

  async getAll(): Promise<WhatsAppPairedUserData[]> {
    const database = await getReadyDb();
    try {
      return await database.select().from(schema.whatsappPairedUsers);
    } catch (err) {
      console.error("[Turso WhatsAppPairedUsersRepository.getAll] error:", err);
      return [];
    }
  },
};

// ==========================================
// 17. Server Auth Sessions Repository (Turso)
// ==========================================

export const UserSessionRepository = {
  async createSession(data: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    const database = await getReadyDb();
    const now = new Date();
    await database
      .insert(schema.userSessions)
      .values({
        id: data.id,
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
        createdAt: now,
        updatedAt: now,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      })
      .onConflictDoUpdate({
        target: schema.userSessions.token,
        set: {
          userId: data.userId,
          expiresAt: data.expiresAt,
          updatedAt: now,
          ipAddress: data.ipAddress || null,
          userAgent: data.userAgent || null,
        },
      });
    return { ...data, createdAt: now, updatedAt: now };
  },

  async findValidSessionByToken(token: string) {
    if (!token) return null;
    const database = await getReadyDb();
    try {
      const now = new Date();
      const rows = await database
        .select()
        .from(schema.userSessions)
        .where(and(eq(schema.userSessions.token, token), gt(schema.userSessions.expiresAt, now)))
        .limit(1);
      return rows[0] || null;
    } catch (err) {
      console.error("[Turso UserSessionRepository.findValidSessionByToken] error:", err);
      return null;
    }
  },

  async revokeByToken(token: string) {
    if (!token) return false;
    const database = await getReadyDb();
    try {
      await database.delete(schema.userSessions).where(eq(schema.userSessions.token, token));
      return true;
    } catch (err) {
      console.error("[Turso UserSessionRepository.revokeByToken] error:", err);
      return false;
    }
  },

  async revokeAllForUser(userId: string) {
    if (!userId) return false;
    const database = await getReadyDb();
    try {
      await database.delete(schema.userSessions).where(eq(schema.userSessions.userId, userId));
      return true;
    } catch (err) {
      console.error("[Turso UserSessionRepository.revokeAllForUser] error:", err);
      return false;
    }
  },
};

// ==========================================
// 18. Runtime Sessions & Sandbox Logs Repository (Turso)
// ==========================================

export const RuntimeSessionRepository = {
  async ensureOwnerUser(userId: string) {
    const existing = await UserRepository.getById(userId);
    if (!existing) {
      await UserRepository.upsertUser({
        id: userId,
        email: `${userId}@souftools.internal`,
        displayName: userId === "system" ? "System Runtime" : "SoufTools User",
        role: "user",
      });
    }
  },

  async upsertSession(data: {
    id: string;
    userId: string;
    provider: string;
    sandboxId?: string | null;
    status?: string;
    memoryMb?: number;
    cpuCores?: number;
    startedAt?: Date;
    stoppedAt?: Date | null;
    expiresAt: Date;
  }) {
    const database = await getReadyDb();
    await this.ensureOwnerUser(data.userId);
    const now = new Date();

    await database
      .insert(schema.runtimeSessions)
      .values({
        id: data.id,
        userId: data.userId,
        provider: data.provider,
        sandboxId: data.sandboxId || null,
        status: data.status || "running",
        memoryMb: data.memoryMb ?? 512,
        cpuCores: data.cpuCores ?? 1,
        startedAt: data.startedAt || now,
        stoppedAt: data.stoppedAt || null,
        expiresAt: data.expiresAt,
      })
      .onConflictDoUpdate({
        target: schema.runtimeSessions.id,
        set: {
          provider: data.provider,
          sandboxId: data.sandboxId || null,
          status: data.status || "running",
          memoryMb: data.memoryMb ?? 512,
          cpuCores: data.cpuCores ?? 1,
          stoppedAt: data.stoppedAt || null,
          expiresAt: data.expiresAt,
        },
      });

    return this.getById(data.id);
  },

  async getById(sessionId: string) {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.runtimeSessions)
        .where(eq(schema.runtimeSessions.id, sessionId))
        .limit(1);
      return rows[0] || null;
    } catch (err) {
      console.error("[Turso RuntimeSessionRepository.getById] error:", err);
      return null;
    }
  },

  async listByUser(userId: string, limitCount = 50) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.runtimeSessions)
        .where(eq(schema.runtimeSessions.userId, userId))
        .orderBy(desc(schema.runtimeSessions.startedAt))
        .limit(limitCount);
    } catch (err) {
      console.error("[Turso RuntimeSessionRepository.listByUser] error:", err);
      return [];
    }
  },

  async listAll(limitCount = 100) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.runtimeSessions)
        .orderBy(desc(schema.runtimeSessions.startedAt))
        .limit(limitCount);
    } catch (err) {
      console.error("[Turso RuntimeSessionRepository.listAll] error:", err);
      return [];
    }
  },

  async updateStatus(sessionId: string, status: string, stoppedAt?: Date | null) {
    const database = await getReadyDb();
    try {
      const updated = await database
        .update(schema.runtimeSessions)
        .set({
          status,
          stoppedAt: stoppedAt ?? (status === "stopped" ? new Date() : null),
        })
        .where(eq(schema.runtimeSessions.id, sessionId))
        .returning();
      return updated[0] || null;
    } catch (err) {
      console.error("[Turso RuntimeSessionRepository.updateStatus] error:", err);
      return null;
    }
  },

  async deleteSession(sessionId: string, userId?: string) {
    const database = await getReadyDb();
    try {
      const cond = userId
        ? and(eq(schema.runtimeSessions.id, sessionId), eq(schema.runtimeSessions.userId, userId))
        : eq(schema.runtimeSessions.id, sessionId);
      const deleted = await database.delete(schema.runtimeSessions).where(cond).returning();
      return deleted.length > 0;
    } catch (err) {
      console.error("[Turso RuntimeSessionRepository.deleteSession] error:", err);
      return false;
    }
  },

  async addLog(sessionId: string, stream: "stdout" | "stderr" | "system", message: string) {
    const database = await getReadyDb();
    try {
      const id = `rlog_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const now = new Date();
      await database.insert(schema.runtimeLogs).values({
        id,
        sessionId,
        stream,
        message,
        timestamp: now,
      });
      return { id, sessionId, stream, message, timestamp: now };
    } catch (err) {
      console.error("[Turso RuntimeSessionRepository.addLog] error:", err);
      return null;
    }
  },

  async getLogs(sessionId: string, limitCount = 200) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.runtimeLogs)
        .where(eq(schema.runtimeLogs.sessionId, sessionId))
        .orderBy(schema.runtimeLogs.timestamp)
        .limit(limitCount);
    } catch (err) {
      console.error("[Turso RuntimeSessionRepository.getLogs] error:", err);
      return [];
    }
  },
};

// ==========================================
// 19. Runtime Errors Repository (Turso)
// ==========================================

export const RuntimeErrorRepository = {
  async listAll(limitCount = 250) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.runtimeErrors)
        .orderBy(desc(schema.runtimeErrors.lastOccurrence))
        .limit(limitCount);
    } catch (err) {
      console.error("[Turso RuntimeErrorRepository.listAll] error:", err);
      return [];
    }
  },

  async upsertError(record: {
    id: string;
    timestamp: Date;
    lastOccurrence: Date;
    occurrencesCount: number;
    severity: string;
    category: string;
    title: string;
    message: string;
    stackTrace?: string | null;
    endpoint?: string | null;
    providerId?: string | null;
    modelId?: string | null;
    statusCode?: number | null;
    diagnosis?: string | null;
    suggestedFix?: string | null;
    autoFixAction?: string | null;
    status: string;
    resolvedAt?: Date | null;
    resolvedBy?: string | null;
    resolutionNotes?: string | null;
    aiAnalysis?: any;
    metadata?: Record<string, any>;
  }) {
    const database = await getReadyDb();
    const now = new Date();
    try {
      await database
        .insert(schema.runtimeErrors)
        .values({
          id: record.id,
          timestamp: record.timestamp,
          lastOccurrence: record.lastOccurrence,
          occurrencesCount: record.occurrencesCount,
          severity: record.severity,
          category: record.category,
          title: record.title,
          message: record.message,
          stackTrace: record.stackTrace || null,
          endpoint: record.endpoint || null,
          providerId: record.providerId || null,
          modelId: record.modelId || null,
          statusCode: record.statusCode ?? null,
          diagnosis: record.diagnosis || null,
          suggestedFix: record.suggestedFix || null,
          autoFixAction: record.autoFixAction || null,
          status: record.status,
          resolvedAt: record.resolvedAt || null,
          resolvedBy: record.resolvedBy || null,
          resolutionNotes: record.resolutionNotes || null,
          aiAnalysis: record.aiAnalysis || null,
          metadata: record.metadata || {},
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.runtimeErrors.id,
          set: {
            lastOccurrence: record.lastOccurrence,
            occurrencesCount: record.occurrencesCount,
            severity: record.severity,
            category: record.category,
            title: record.title,
            message: record.message,
            stackTrace: record.stackTrace || null,
            endpoint: record.endpoint || null,
            providerId: record.providerId || null,
            modelId: record.modelId || null,
            statusCode: record.statusCode ?? null,
            diagnosis: record.diagnosis || null,
            suggestedFix: record.suggestedFix || null,
            autoFixAction: record.autoFixAction || null,
            status: record.status,
            resolvedAt: record.resolvedAt || null,
            resolvedBy: record.resolvedBy || null,
            resolutionNotes: record.resolutionNotes || null,
            aiAnalysis: record.aiAnalysis || null,
            metadata: record.metadata || {},
            updatedAt: now,
          },
        });
      return true;
    } catch (err) {
      console.error("[Turso RuntimeErrorRepository.upsertError] error:", err);
      return false;
    }
  },

  async bulkUpsert(records: any[]) {
    for (const r of records) {
      await this.upsertError({
        ...r,
        timestamp: new Date(r.timestamp || Date.now()),
        lastOccurrence: new Date(r.lastOccurrence || r.timestamp || Date.now()),
        resolvedAt: r.resolvedAt ? new Date(r.resolvedAt) : null,
      });
    }
  },

  async resolveAllOpen(resolvedBy: string) {
    const database = await getReadyDb();
    const now = new Date();
    try {
      const updated = await database
        .update(schema.runtimeErrors)
        .set({
          status: "resolved",
          resolvedAt: now,
          resolvedBy,
          updatedAt: now,
        })
        .where(inArray(schema.runtimeErrors.status, ["unresolved", "open", "investigating"]))
        .returning({ id: schema.runtimeErrors.id });
      return updated.length;
    } catch (err) {
      console.error("[Turso RuntimeErrorRepository.resolveAllOpen] error:", err);
      return 0;
    }
  },

  async deleteResolved() {
    const database = await getReadyDb();
    try {
      const deleted = await database
        .delete(schema.runtimeErrors)
        .where(inArray(schema.runtimeErrors.status, ["resolved", "auto_resolved"]))
        .returning({ id: schema.runtimeErrors.id });
      return deleted.length;
    } catch (err) {
      console.error("[Turso RuntimeErrorRepository.deleteResolved] error:", err);
      return 0;
    }
  },
};

// ==========================================
// 20. Web Push Subscriptions Repository (Turso)
// ==========================================

export const PushSubscriptionRepository = {
  async saveSubscription(data: {
    id?: string;
    userId: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    userAgent?: string | null;
  }) {
    const database = await getReadyDb();
    const now = new Date();
    const id = data.id || `push_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await database
      .insert(schema.pushSubscriptions)
      .values({
        id,
        userId: data.userId,
        endpoint: data.endpoint,
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        userAgent: data.userAgent || null,
        createdAt: now,
        lastUsedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.pushSubscriptions.endpoint,
        set: {
          userId: data.userId,
          p256dh: data.keys.p256dh,
          auth: data.keys.auth,
          userAgent: data.userAgent || null,
          lastUsedAt: now,
        },
      });

    return {
      id,
      userId: data.userId,
      endpoint: data.endpoint,
      keys: data.keys,
      userAgent: data.userAgent || undefined,
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
    };
  },

  async removeByEndpoint(endpoint: string, userId?: string) {
    const database = await getReadyDb();
    try {
      const cond = userId
        ? and(eq(schema.pushSubscriptions.endpoint, endpoint), eq(schema.pushSubscriptions.userId, userId))
        : eq(schema.pushSubscriptions.endpoint, endpoint);
      const deleted = await database.delete(schema.pushSubscriptions).where(cond).returning();
      return deleted.length > 0;
    } catch (err) {
      console.error("[Turso PushSubscriptionRepository.removeByEndpoint] error:", err);
      return false;
    }
  },

  async listByUser(userId: string) {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.pushSubscriptions)
        .where(eq(schema.pushSubscriptions.userId, userId))
        .orderBy(desc(schema.pushSubscriptions.createdAt));
    } catch (err) {
      console.error("[Turso PushSubscriptionRepository.listByUser] error:", err);
      return [];
    }
  },

  async getAll() {
    const database = await getReadyDb();
    try {
      return await database
        .select()
        .from(schema.pushSubscriptions)
        .orderBy(desc(schema.pushSubscriptions.createdAt));
    } catch (err) {
      console.error("[Turso PushSubscriptionRepository.getAll] error:", err);
      return [];
    }
  },

  async touchLastUsed(endpoints: string[]) {
    if (!endpoints.length) return;
    const database = await getReadyDb();
    const now = new Date();
    try {
      for (const batch of chunkArray(endpoints, 200)) {
        await database
          .update(schema.pushSubscriptions)
          .set({ lastUsedAt: now })
          .where(inArray(schema.pushSubscriptions.endpoint, batch));
      }
    } catch (error) {
      console.error("[Turso PushSubscriptionRepository.touchLastUsed] error:", error);
      throw error;
    }
  },
};

// ==========================================
// 21. Telegram Pairing & Encrypted OAuth Tokens Repository (Turso)
// ==========================================

export const TelegramRepository = {
  async linkUser(data: {
    chatId: string;
    userId: string;
    email?: string | null;
    username?: string | null;
    firstName?: string | null;
    pairingCode?: string | null;
  }) {
    const database = await getReadyDb();
    const now = new Date();
    const cleanChatId = String(data.chatId).trim();
    const cleanEmail = data.email ? data.email.toLowerCase().trim() : null;

    await database
      .insert(schema.telegramPairedUsers)
      .values({
        chatId: cleanChatId,
        userId: data.userId,
        email: cleanEmail,
        username: data.username || null,
        firstName: data.firstName || null,
        pairingCode: data.pairingCode || null,
        linkedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.telegramPairedUsers.chatId,
        set: {
          userId: data.userId,
          email: cleanEmail,
          username: data.username || null,
          firstName: data.firstName || null,
          pairingCode: data.pairingCode || null,
          updatedAt: now,
        },
      });

    return {
      chatId: cleanChatId,
      userId: data.userId,
      email: cleanEmail,
      username: data.username || null,
      firstName: data.firstName || null,
      pairingCode: data.pairingCode || null,
      linkedAt: now.toISOString(),
    };
  },

  async getPairedUser(chatId: string) {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.telegramPairedUsers)
        .where(eq(schema.telegramPairedUsers.chatId, String(chatId).trim()))
        .limit(1);
      return rows[0] || null;
    } catch {
      return null;
    }
  },

  async unlinkUser(chatId: string) {
    const database = await getReadyDb();
    try {
      await database
        .delete(schema.telegramPairedUsers)
        .where(eq(schema.telegramPairedUsers.chatId, String(chatId).trim()));
      return true;
    } catch {
      return false;
    }
  },

  async listPairedUsers() {
    const database = await getReadyDb();
    try {
      return await database.select().from(schema.telegramPairedUsers);
    } catch {
      return [];
    }
  },

  async setOAuthToken(params: {
    chatId: string;
    service: "gmail" | "drive";
    accessToken: string;
    email?: string | null;
  }) {
    const database = await getReadyDb();
    const now = new Date();
    const cleanChatId = String(params.chatId).trim();
    const encrypted = encryptKey(params.accessToken);
    const id = `tg_oauth_${params.service}_${cleanChatId}`;

    await database
      .insert(schema.telegramOauthTokens)
      .values({
        id,
        chatId: cleanChatId,
        service: params.service,
        encryptedAccessToken: encrypted,
        email: params.email || null,
        connectedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.telegramOauthTokens.chatId, schema.telegramOauthTokens.service],
        set: {
          encryptedAccessToken: encrypted,
          email: params.email || null,
          updatedAt: now,
        },
      });
  },

  async getOAuthToken(chatId: string, service: "gmail" | "drive") {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.telegramOauthTokens)
        .where(
          and(
            eq(schema.telegramOauthTokens.chatId, String(chatId).trim()),
            eq(schema.telegramOauthTokens.service, service)
          )
        )
        .limit(1);
      if (!rows[0]) return null;
      return {
        accessToken: decryptKey(rows[0].encryptedAccessToken),
        email: rows[0].email || undefined,
        connectedAt: rows[0].connectedAt.toISOString(),
      };
    } catch {
      return null;
    }
  },

  async listOAuthTokens(service: "gmail" | "drive") {
    const database = await getReadyDb();
    try {
      const rows = await database
        .select()
        .from(schema.telegramOauthTokens)
        .where(eq(schema.telegramOauthTokens.service, service));
      return rows.map((r) => ({
        chatId: r.chatId,
        service: r.service as "gmail" | "drive",
        accessToken: decryptKey(r.encryptedAccessToken),
        email: r.email || undefined,
        connectedAt: r.connectedAt.toISOString(),
      }));
    } catch {
      return [];
    }
  },

  async deleteOAuthToken(chatId: string, service: "gmail" | "drive") {
    const database = await getReadyDb();
    try {
      await database
        .delete(schema.telegramOauthTokens)
        .where(
          and(
            eq(schema.telegramOauthTokens.chatId, String(chatId).trim()),
            eq(schema.telegramOauthTokens.service, service)
          )
        );
      return true;
    } catch {
      return false;
    }
  },
};

export { DatabaseMaintenanceService } from "./maintenance";
