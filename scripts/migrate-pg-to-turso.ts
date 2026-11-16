/**
 * PostgreSQL JSON Export -> Turso (libSQL) Data Migration Tool
 *
 * Usage:
 *   npx tsx scripts/migrate-pg-to-turso.ts --source-json ./pg-export.json [--target-url libsql://...] [--auth-token ...] [--dry-run] [--backup-dir .turso_backups]
 *
 * Features:
 * - Zero dependency on `pg`: reads a structured JSON export containing PostgreSQL tables.
 * - Strict topological parent -> child ordering across all 50 application tables.
 * - Normalizes camelCase/snake_case keys, booleans, ISO timestamps, and JSON/JSONB values to SQLite/Turso types.
 * - Creates an automatic pre-migration snapshot when targeting a local `file:` libSQL database.
 * - Executes idempotent `INSERT OR IGNORE` batches inside per-table transactions.
 * - Verifies post-migration row counts for every table and reports discrepancies.
 */

import fs from "fs";
import path from "path";
import { createClient, type Client } from "@libsql/client";
import { runMigrations } from "../lib/db/migrate";

// Strict parent -> child topological order for all 50 schema tables
export const TOPOLOGICAL_TABLE_ORDER: string[] = [
  "user",
  "session",
  "account",
  "verification",
  "user_devices",
  "user_preferences",
  "notifications",
  "sync_events",
  "sync_cursors",
  "behavior_profiles",
  "memory_settings",
  "memories",
  "memory_access_logs",
  "ai_providers",
  "ai_models",
  "ai_keys",
  "ai_health",
  "ai_usage",
  "routing_logs",
  "conversations",
  "messages",
  "message_attachments",
  "projects",
  "project_files",
  "storage_objects",
  "runtime_sessions",
  "runtime_logs",
  "admin_logs",
  "settings",
  "encrypted_vault_keys",
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

interface CliArgs {
  sourceJson: string;
  targetUrl?: string;
  authToken?: string;
  dryRun: boolean;
  backupDir: string;
}

function parseCliArgs(argv: string[]): CliArgs {
  const parsed: Partial<CliArgs> = {
    dryRun: false,
    backupDir: ".turso_backups",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--source-json" && argv[i + 1]) {
      parsed.sourceJson = argv[++i];
    } else if (arg === "--target-url" && argv[i + 1]) {
      parsed.targetUrl = argv[++i];
    } else if (arg === "--auth-token" && argv[i + 1]) {
      parsed.authToken = argv[++i];
    } else if (arg === "--backup-dir" && argv[i + 1]) {
      parsed.backupDir = argv[++i];
    } else if (arg === "--dry-run") {
      parsed.dryRun = true;
    }
  }

  if (!parsed.sourceJson) {
    throw new Error(
      "Missing required argument: --source-json <path>. Example: npx tsx scripts/migrate-pg-to-turso.ts --source-json ./backup.json"
    );
  }

  return parsed as CliArgs;
}

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

const TIMESTAMP_COLUMNS = new Set([
  "expires_at",
  "access_token_expires_at",
  "refresh_token_expires_at",
  "created_at",
  "updated_at",
  "last_used_at",
  "last_tested_at",
  "checked_at",
  "deleted_at",
  "started_at",
  "stopped_at",
  "completed_at",
  "timestamp",
  "called_at",
  "next_retry_at",
  "lease_expires_at",
  "last_seen_at",
  "read_at",
  "last_sync_timestamp",
  "rotated_at",
  "last_watched_at",
  "executed_at",
  "last_observed_at",
  "linked_at",
  "last_occurrence",
  "resolved_at",
  "connected_at",
]);

const BOOLEAN_COLUMNS = new Set([
  "email_verified",
  "is_banned",
  "is_pinned",
  "is_archived",
  "enabled",
  "memory_enabled",
  "auto_suggest",
  "auto_extract",
  "fallback_occurred",
  "is_public",
  "is_encrypted",
  "is_recovered",
  "auto_execute",
  "sound_enabled",
  "auto_scroll",
  "web_search_enabled",
  "is_read",
  "completed",
]);

function normalizeValueForTurso(colName: string, raw: unknown): string | number | null {
  if (raw === undefined || raw === null) return null;

  if (BOOLEAN_COLUMNS.has(colName)) {
    if (typeof raw === "boolean") return raw ? 1 : 0;
    if (typeof raw === "number") return raw !== 0 ? 1 : 0;
    if (typeof raw === "string") return raw === "true" || raw === "1" ? 1 : 0;
    return 0;
  }

  if (TIMESTAMP_COLUMNS.has(colName)) {
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
    if (raw instanceof Date) return raw.getTime();
    if (typeof raw === "string") {
      if (/^\d+$/.test(raw.trim())) return Number(raw.trim());
      const ms = Date.parse(raw);
      return Number.isNaN(ms) ? Date.now() : ms;
    }
    return Date.now();
  }

  if (typeof raw === "boolean") {
    return raw ? 1 : 0;
  }

  if (raw instanceof Date) {
    return raw.getTime();
  }

  if (typeof raw === "object") {
    return JSON.stringify(raw);
  }

  if (typeof raw === "number" || typeof raw === "string") {
    return raw;
  }

  return String(raw);
}

function createLocalBackupIfApplicable(targetUrl: string, backupDir: string): string | null {
  if (!targetUrl.toLowerCase().startsWith("file:")) return null;
  const rawFile = targetUrl.slice(5).split("?")[0];
  if (!rawFile || rawFile === ":memory:") return null;
  const resolvedDb = path.isAbsolute(rawFile) ? rawFile : path.resolve(process.cwd(), rawFile);
  if (!fs.existsSync(resolvedDb)) return null;

  const resolvedBackupDir = path.isAbsolute(backupDir) ? backupDir : path.resolve(process.cwd(), backupDir);
  if (!fs.existsSync(resolvedBackupDir)) {
    fs.mkdirSync(resolvedBackupDir, { recursive: true });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(resolvedBackupDir, `${path.basename(resolvedDb)}.bak-${stamp}`);
  fs.copyFileSync(resolvedDb, backupFile);
  for (const suffix of ["-wal", "-shm"]) {
    if (fs.existsSync(resolvedDb + suffix)) {
      fs.copyFileSync(resolvedDb + suffix, backupFile + suffix);
    }
  }
  return backupFile;
}

async function getTableColumns(client: Client, tableName: string): Promise<string[]> {
  const res = await client.execute(`PRAGMA table_info("${tableName}");`);
  return (res.rows || []).map((r: any) => String(r.name));
}

async function getTableCount(client: Client, tableName: string): Promise<number> {
  const res = await client.execute(`SELECT COUNT(*) AS cnt FROM "${tableName}";`);
  const row = res.rows[0] as any;
  return Number(row?.cnt ?? Object.values(row || {})[0] ?? 0);
}

export async function runPgJsonToTursoMigration(args: CliArgs) {
  const sourcePath = path.isAbsolute(args.sourceJson)
    ? args.sourceJson
    : path.resolve(process.cwd(), args.sourceJson);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source JSON file not found: ${sourcePath}`);
  }

  const rawJson = JSON.parse(fs.readFileSync(sourcePath, "utf-8"));
  const tableDataMap: Record<string, any[]> =
    rawJson && typeof rawJson === "object" && rawJson.tables && typeof rawJson.tables === "object"
      ? rawJson.tables
      : rawJson;

  if (!tableDataMap || typeof tableDataMap !== "object") {
    throw new Error("Invalid source JSON format: expected an object mapping table names to row arrays.");
  }

  if (args.targetUrl) process.env.TURSO_DATABASE_URL = args.targetUrl;
  if (args.authToken) process.env.TURSO_AUTH_TOKEN = args.authToken;

  const targetUrl = (process.env.TURSO_DATABASE_URL || "").trim();
  const authToken = (process.env.TURSO_AUTH_TOKEN || "").trim() || undefined;
  if (!targetUrl) {
    throw new Error("TURSO_DATABASE_URL (or --target-url) is required.");
  }

  let backupPath: string | null = null;
  if (!args.dryRun) {
    backupPath = createLocalBackupIfApplicable(targetUrl, args.backupDir);
    if (backupPath) {
      console.log(`[Migrate] Pre-migration snapshot saved at: ${backupPath}`);
    }
  }

  const client = createClient({ url: targetUrl, authToken });
  try {
    const migRes = await runMigrations(client);
    if (!migRes.success) {
      throw new Error(`Failed to initialize Turso schema before data import: ${migRes.error}`);
    }

    await client.execute("PRAGMA foreign_keys = ON;");
    await client.execute("PRAGMA busy_timeout = 5000;");

    const report: Array<{
      table: string;
      sourceRows: number;
      insertedRows: number;
      targetTotalAfter: number;
    }> = [];

    for (const tableName of TOPOLOGICAL_TABLE_ORDER) {
      const rows = Array.isArray(tableDataMap[tableName]) ? tableDataMap[tableName] : [];
      if (rows.length === 0) {
        const afterCnt = await getTableCount(client, tableName);
        report.push({ table: tableName, sourceRows: 0, insertedRows: 0, targetTotalAfter: afterCnt });
        continue;
      }

      const validColumns = await getTableColumns(client, tableName);
      const validColSet = new Set(validColumns);
      const beforeCnt = await getTableCount(client, tableName);

      if (args.dryRun) {
        console.log(`[Dry-Run] ${tableName}: would import ${rows.length} row(s)`);
        report.push({ table: tableName, sourceRows: rows.length, insertedRows: 0, targetTotalAfter: beforeCnt });
        continue;
      }

      const tx = await client.transaction("write");
      try {
        for (const rawRow of rows) {
          if (!rawRow || typeof rawRow !== "object") continue;

          const cols: string[] = [];
          const vals: Array<string | number | null> = [];
          const seenCols = new Set<string>();

          for (const [k, v] of Object.entries(rawRow)) {
            const candidateCol = validColSet.has(k) ? k : camelToSnake(k);
            if (!validColSet.has(candidateCol) || seenCols.has(candidateCol)) continue;
            seenCols.add(candidateCol);
            cols.push(candidateCol);
            vals.push(normalizeValueForTurso(candidateCol, v));
          }

          if (cols.length === 0) continue;

          const colSql = cols.map((c) => `"${c}"`).join(", ");
          const placeholders = cols.map(() => "?").join(", ");
          await tx.execute({
            sql: `INSERT OR IGNORE INTO "${tableName}" (${colSql}) VALUES (${placeholders});`,
            args: vals,
          });
        }
        await tx.commit();
      } catch (err) {
        await tx.rollback().catch(() => {});
        throw new Error(`Failed migrating table "${tableName}": ${(err as any)?.message || err}`);
      }

      const afterCnt = await getTableCount(client, tableName);
      report.push({
        table: tableName,
        sourceRows: rows.length,
        insertedRows: Math.max(0, afterCnt - beforeCnt),
        targetTotalAfter: afterCnt,
      });
    }

    const nonEmptyReport = report.filter((r) => r.sourceRows > 0 || r.targetTotalAfter > 0);
    console.log("\n=== Turso Migration Verification Summary ===");
    for (const r of nonEmptyReport) {
      console.log(
        `- ${r.table}: source=${r.sourceRows}, newlyInserted=${r.insertedRows}, targetTotal=${r.targetTotalAfter}`
      );
    }

    return {
      success: true,
      dryRun: args.dryRun,
      backupPath,
      tablesProcessed: report.length,
      totalSourceRows: report.reduce((acc, r) => acc + r.sourceRows, 0),
      totalInsertedRows: report.reduce((acc, r) => acc + r.insertedRows, 0),
      report,
    };
  } finally {
    try {
      client.close();
    } catch {}
  }
}

if (typeof require !== "undefined" && require.main === module) {
  const args = parseCliArgs(process.argv.slice(2));
  runPgJsonToTursoMigration(args)
    .then((res) => {
      console.log(
        `\n[Migrate] Completed (${res.dryRun ? "DRY RUN" : "LIVE"}): sourceRows=${res.totalSourceRows}, newlyInserted=${res.totalInsertedRows}`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Migrate] Fatal error:", err?.message || err);
      process.exit(1);
    });
}
