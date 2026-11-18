/**
 * SoufTools Turso (libSQL) Schema Synchronization & Idempotent Migration Runner
 * Creates all tables, foreign keys, and performance indexes in Turso.
 * Enforces explicit Turso configuration with zero silent fallbacks.
 */

import { createClient, type Client } from "@libsql/client";

export interface TursoConnectionConfig {
  url: string;
  authToken?: string;
  isRemote: boolean;
  isLocalFile: boolean;
}

export function validateTursoEnv(): TursoConnectionConfig {
  const url = (process.env.TURSO_DATABASE_URL || "").trim();
  const authToken = (process.env.TURSO_AUTH_TOKEN || "").trim() || undefined;

  if (!url) {
    throw new Error(
      "[Turso] TURSO_DATABASE_URL is not configured. Set TURSO_DATABASE_URL (e.g. libsql://... or file:...) in your environment. Silent fallback to PostgreSQL/PGlite/memory is disabled."
    );
  }

  const lower = url.toLowerCase();
  if (lower.startsWith("postgres://") || lower.startsWith("postgresql://")) {
    throw new Error(
      "[Turso] Invalid TURSO_DATABASE_URL: PostgreSQL connection strings are unsupported. Provide a valid Turso libsql://, https://, or file: URL."
    );
  }

  const isLocalFile = lower.startsWith("file:");
  const isRemote =
    lower.startsWith("libsql://") ||
    lower.startsWith("https://") ||
    lower.startsWith("http://") ||
    lower.startsWith("wss://") ||
    lower.startsWith("ws://");

  if (!isLocalFile && !isRemote) {
    throw new Error(
      `[Turso] Unsupported TURSO_DATABASE_URL scheme (${url.split(":")[0]}). Expected libsql://, https://, or file:.`
    );
  }

  if ((lower.startsWith("libsql://") || lower.startsWith("https://") || lower.startsWith("wss://")) && !authToken) {
    throw new Error(
      "[Turso] TURSO_AUTH_TOKEN is required when connecting to a remote Turso Cloud endpoint (libsql:// or https://)."
    );
  }

  return {
    url,
    authToken,
    isRemote,
    isLocalFile,
  };
}

const NOW_MS_EXPR = "(strftime('%s', 'now') * 1000)";

export async function ensureAgentTaskLeaseColumns(client: Client): Promise<void> {
  const columnsToAdd = [
    { name: "lease_token", statement: `ALTER TABLE "agent_tasks" ADD COLUMN "lease_token" TEXT` },
    {
      name: "lease_generation",
      statement: `ALTER TABLE "agent_tasks" ADD COLUMN "lease_generation" INTEGER NOT NULL DEFAULT 0`,
    },
  ];

  for (const column of columnsToAdd) {
    const tableInfo = await client.execute("PRAGMA table_info('agent_tasks')");
    if (tableInfo.rows.some((row) => String(row.name) === column.name)) continue;

    try {
      await client.execute(column.statement);
    } catch (error) {
      const refreshedInfo = await client.execute("PRAGMA table_info('agent_tasks')");
      if (!refreshedInfo.rows.some((row) => String(row.name) === column.name)) throw error;
    }
  }
}

export const MIGRATION_STATEMENTS: string[] = [
  // Migration ledger table
  `CREATE TABLE IF NOT EXISTS "_schema_migrations" (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    applied_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,

  // 1. Better Auth & Core Users
  `CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    storage_used_bytes INTEGER NOT NULL DEFAULT 0,
    storage_limit_bytes INTEGER NOT NULL DEFAULT 157286400,
    is_banned INTEGER NOT NULL DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "user" ("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_normalized_idx"
    ON "user" (lower(trim("email")))
    WHERE "email" = lower(trim("email"))`,
  `CREATE INDEX IF NOT EXISTS "users_role_idx" ON "user" ("role")`,

  `CREATE TABLE IF NOT EXISTS "session" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "session" ("user_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_idx" ON "session" ("token")`,
  `CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "session" ("expires_at")`,

  `CREATE TABLE IF NOT EXISTS "account" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    access_token_expires_at INTEGER,
    refresh_token_expires_at INTEGER,
    scope TEXT,
    id_token TEXT,
    password TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON "account" ("user_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_account_idx" ON "account" ("provider_id", "account_id")`,

  `CREATE TABLE IF NOT EXISTS "verification" (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "verifications_identifier_idx" ON "verification" ("identifier")`,

  // 2. Conversations & Messages
  `CREATE TABLE IF NOT EXISTS "conversations" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    title TEXT NOT NULL,
    model_id TEXT NOT NULL DEFAULT 'soufai-spark',
    system_prompt TEXT,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "conversations_user_id_idx" ON "conversations" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "conversations_user_updated_idx" ON "conversations" ("user_id", "updated_at")`,

  `CREATE TABLE IF NOT EXISTS "messages" (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    reasoning TEXT,
    sources TEXT DEFAULT '[]',
    tool_calls TEXT DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" ("conversation_id", "created_at")`,

  `CREATE TABLE IF NOT EXISTS "message_attachments" (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
    file_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    url TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "message_attachments_message_id_idx" ON "message_attachments" ("message_id")`,

  // 3. Long-term Memory & Behavior
  `CREATE TABLE IF NOT EXISTS "memories" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    importance REAL NOT NULL DEFAULT 0.8,
    confidence REAL NOT NULL DEFAULT 1.0,
    source TEXT NOT NULL DEFAULT 'auto',
    status TEXT NOT NULL DEFAULT 'active',
    project_id TEXT,
    project_name TEXT,
    user_name TEXT,
    category TEXT,
    tags TEXT DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    metadata TEXT DEFAULT '{}',
    last_used_at INTEGER,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "memories_user_id_idx" ON "memories" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "memories_user_type_idx" ON "memories" ("user_id", "type")`,
  `CREATE INDEX IF NOT EXISTS "memories_user_status_idx" ON "memories" ("user_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "memories_user_updated_idx" ON "memories" ("user_id", "updated_at")`,
  `CREATE INDEX IF NOT EXISTS "memories_project_id_idx" ON "memories" ("project_id")`,

  `CREATE TABLE IF NOT EXISTS "memory_access_logs" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    memory_id TEXT,
    action TEXT NOT NULL,
    prompt_snippet TEXT,
    relevance_score REAL,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "memory_access_logs_user_id_idx" ON "memory_access_logs" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "memory_access_logs_created_at_idx" ON "memory_access_logs" ("created_at")`,

  `CREATE TABLE IF NOT EXISTS "memory_settings" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
    memory_enabled INTEGER NOT NULL DEFAULT 1,
    auto_suggest INTEGER NOT NULL DEFAULT 1,
    auto_extract INTEGER NOT NULL DEFAULT 1,
    max_context_items INTEGER NOT NULL DEFAULT 8,
    retention_days INTEGER NOT NULL DEFAULT 365,
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "memory_settings_user_id_idx" ON "memory_settings" ("user_id")`,

  `CREATE TABLE IF NOT EXISTS "behavior_profiles" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    preferences TEXT DEFAULT '{}',
    patterns TEXT DEFAULT '{}',
    stats TEXT DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "behavior_profiles_user_id_idx" ON "behavior_profiles" ("user_id")`,

  // 4. AI Providers, Models, Keys & Health
  `CREATE TABLE IF NOT EXISTS "ai_providers" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 1,
    rotation_mode TEXT NOT NULL DEFAULT 'priority',
    config TEXT DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,

  `CREATE TABLE IF NOT EXISTS "ai_models" (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES "ai_providers"("id") ON DELETE CASCADE,
    name TEXT NOT NULL,
    model_code TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    context_window INTEGER NOT NULL DEFAULT 128000,
    cost_per_token REAL NOT NULL DEFAULT 0.0,
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "ai_models_provider_id_idx" ON "ai_models" ("provider_id")`,

  `CREATE TABLE IF NOT EXISTS "ai_keys" (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES "ai_providers"("id") ON DELETE CASCADE,
    encrypted_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_tested_at INTEGER,
    last_used_at INTEGER,
    failure_reason TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "ai_keys_provider_status_idx" ON "ai_keys" ("provider_id", "status")`,

  `CREATE TABLE IF NOT EXISTS "ai_health" (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    model_id TEXT,
    status TEXT NOT NULL DEFAULT 'healthy',
    latency_ms INTEGER NOT NULL DEFAULT 0,
    error_rate REAL NOT NULL DEFAULT 0.0,
    checked_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "ai_health_provider_idx" ON "ai_health" ("provider_id")`,

  `CREATE TABLE IF NOT EXISTS "ai_usage" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost REAL NOT NULL DEFAULT 0.0,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "ai_usage_user_created_idx" ON "ai_usage" ("user_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "ai_usage_provider_created_idx" ON "ai_usage" ("provider_id", "created_at")`,

  `CREATE TABLE IF NOT EXISTS "routing_logs" (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    user_id TEXT,
    prompt_length INTEGER NOT NULL DEFAULT 0,
    chosen_provider TEXT NOT NULL,
    chosen_model TEXT NOT NULL,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    fallback_occurred INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "routing_logs_request_id_idx" ON "routing_logs" ("request_id")`,
  `CREATE INDEX IF NOT EXISTS "routing_logs_created_idx" ON "routing_logs" ("created_at")`,

  // 5. Private Object Storage
  `CREATE TABLE IF NOT EXISTS "storage_objects" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    conversation_id TEXT,
    project_id TEXT,
    object_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    category TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    checksum TEXT,
    storage_provider TEXT NOT NULL DEFAULT 'local_private',
    is_public INTEGER NOT NULL DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    deleted_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS "storage_objects_user_id_idx" ON "storage_objects" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "storage_objects_category_idx" ON "storage_objects" ("category")`,
  `CREATE INDEX IF NOT EXISTS "storage_objects_conversation_idx" ON "storage_objects" ("conversation_id")`,
  `CREATE INDEX IF NOT EXISTS "storage_objects_project_idx" ON "storage_objects" ("project_id")`,

  // 6. Projects & Sandbox Runtime
  `CREATE TABLE IF NOT EXISTS "projects" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    framework TEXT NOT NULL DEFAULT 'react_nextjs',
    version INTEGER NOT NULL DEFAULT 1,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "projects_user_id_idx" ON "projects" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "projects_user_updated_idx" ON "projects" ("user_id", "updated_at")`,

  `CREATE TABLE IF NOT EXISTS "project_files" (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    path TEXT NOT NULL,
    content TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "project_files_project_id_idx" ON "project_files" ("project_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "project_files_path_idx" ON "project_files" ("project_id", "path")`,

  `CREATE TABLE IF NOT EXISTS "runtime_sessions" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    provider TEXT NOT NULL,
    sandbox_id TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    memory_mb INTEGER NOT NULL DEFAULT 512,
    cpu_cores INTEGER NOT NULL DEFAULT 1,
    started_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    stopped_at INTEGER,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "runtime_sessions_user_status_idx" ON "runtime_sessions" ("user_id", "status")`,

  `CREATE TABLE IF NOT EXISTS "runtime_logs" (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES "runtime_sessions"("id") ON DELETE CASCADE,
    stream TEXT NOT NULL DEFAULT 'stdout',
    message TEXT NOT NULL,
    timestamp INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "runtime_logs_session_id_idx" ON "runtime_logs" ("session_id")`,

  // 7. Admin Logs & Settings
  `CREATE TABLE IF NOT EXISTS "admin_logs" (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT DEFAULT '{}',
    ip_address TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "admin_logs_created_idx" ON "admin_logs" ("created_at")`,
  `CREATE INDEX IF NOT EXISTS "admin_logs_admin_id_idx" ON "admin_logs" ("admin_user_id")`,

  `CREATE TABLE IF NOT EXISTS "settings" (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    is_encrypted INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "settings_key_idx" ON "settings" ("key")`,

  // 8. Platform Analytics & Telemetry Engine
  `CREATE TABLE IF NOT EXISTS "analytics_events" (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    category TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    resource_id TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    tokens_prompt INTEGER NOT NULL DEFAULT 0,
    tokens_completion INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    metadata TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    country TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "analytics_events_type_idx" ON "analytics_events" ("event_type")`,
  `CREATE INDEX IF NOT EXISTS "analytics_events_category_idx" ON "analytics_events" ("category")`,
  `CREATE INDEX IF NOT EXISTS "analytics_events_user_id_idx" ON "analytics_events" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "analytics_events_status_idx" ON "analytics_events" ("status")`,
  `CREATE INDEX IF NOT EXISTS "analytics_events_created_idx" ON "analytics_events" ("created_at")`,

  `CREATE TABLE IF NOT EXISTS "analytics_daily_aggregates" (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    metric_category TEXT NOT NULL,
    dimension_key TEXT NOT NULL,
    count_value INTEGER NOT NULL DEFAULT 0,
    sum_duration_ms INTEGER NOT NULL DEFAULT 0,
    sum_tokens INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    unique_users_count INTEGER NOT NULL DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "analytics_daily_date_dim_idx" ON "analytics_daily_aggregates" ("date", "metric_category", "dimension_key")`,
  `CREATE INDEX IF NOT EXISTS "analytics_daily_date_idx" ON "analytics_daily_aggregates" ("date")`,
  `CREATE INDEX IF NOT EXISTS "analytics_daily_category_idx" ON "analytics_daily_aggregates" ("metric_category")`,

  `CREATE TABLE IF NOT EXISTS "analytics_tool_metrics" (
    id TEXT PRIMARY KEY,
    tool_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
    date TEXT NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    successful_requests INTEGER NOT NULL DEFAULT 0,
    failed_requests INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms REAL NOT NULL DEFAULT 0.0,
    p95_latency_ms REAL NOT NULL DEFAULT 0.0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "analytics_tool_date_idx" ON "analytics_tool_metrics" ("tool_id", "date")`,
  `CREATE INDEX IF NOT EXISTS "analytics_tool_id_idx" ON "analytics_tool_metrics" ("tool_id")`,

  `CREATE TABLE IF NOT EXISTS "analytics_model_metrics" (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    date TEXT NOT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_cost_estimate REAL NOT NULL DEFAULT 0.0,
    avg_latency_ms REAL NOT NULL DEFAULT 0.0,
    p95_latency_ms REAL NOT NULL DEFAULT 0.0,
    error_count INTEGER NOT NULL DEFAULT 0,
    rate_limit_count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "analytics_model_date_idx" ON "analytics_model_metrics" ("provider_id", "model_id", "date")`,
  `CREATE INDEX IF NOT EXISTS "analytics_model_provider_idx" ON "analytics_model_metrics" ("provider_id")`,

  `CREATE TABLE IF NOT EXISTS "analytics_security_events" (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    ip_address TEXT,
    user_id TEXT,
    action TEXT NOT NULL,
    reason TEXT,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "analytics_security_type_idx" ON "analytics_security_events" ("event_type")`,
  `CREATE INDEX IF NOT EXISTS "analytics_security_severity_idx" ON "analytics_security_events" ("severity")`,
  `CREATE INDEX IF NOT EXISTS "analytics_security_created_idx" ON "analytics_security_events" ("created_at")`,

  `CREATE TABLE IF NOT EXISTS "analytics_system_snapshots" (
    id TEXT PRIMARY KEY,
    cpu_percent REAL NOT NULL DEFAULT 0.0,
    memory_used_mb INTEGER NOT NULL DEFAULT 0,
    memory_total_mb INTEGER NOT NULL DEFAULT 0,
    disk_used_mb INTEGER NOT NULL DEFAULT 0,
    disk_total_mb INTEGER NOT NULL DEFAULT 0,
    active_sandboxes INTEGER NOT NULL DEFAULT 0,
    active_workers INTEGER NOT NULL DEFAULT 0,
    queue_length INTEGER NOT NULL DEFAULT 0,
    db_connections INTEGER NOT NULL DEFAULT 0,
    db_latency_ms INTEGER NOT NULL DEFAULT 0,
    requests_per_sec REAL NOT NULL DEFAULT 0.0,
    uptime_seconds INTEGER NOT NULL DEFAULT 0,
    timestamp INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "analytics_snapshots_timestamp_idx" ON "analytics_system_snapshots" ("timestamp")`,

  // 9. Autonomous Agent Engine & Durable Worker Queue
  `CREATE TABLE IF NOT EXISTS "agent_tasks" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT,
    goal TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'pending',
    budget_tier TEXT NOT NULL DEFAULT 'auto',
    max_steps INTEGER NOT NULL DEFAULT 7,
    current_step INTEGER NOT NULL DEFAULT 0,
    plan TEXT DEFAULT '[]',
    active_agents TEXT DEFAULT '[]',
    files_changed TEXT DEFAULT '[]',
    summary TEXT,
    final_response TEXT,
    quality_score INTEGER,
    metadata TEXT DEFAULT '{}',
    lease_owner TEXT,
    lease_token TEXT,
    lease_generation INTEGER NOT NULL DEFAULT 0,
    lease_expires_at INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    checkpoint_step INTEGER NOT NULL DEFAULT 0,
    checkpoint_data TEXT DEFAULT '{}',
    started_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    completed_at INTEGER,
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "agent_tasks_user_id_idx" ON "agent_tasks" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "agent_tasks_project_id_idx" ON "agent_tasks" ("project_id")`,
  `CREATE INDEX IF NOT EXISTS "agent_tasks_status_idx" ON "agent_tasks" ("status")`,
  `CREATE INDEX IF NOT EXISTS "agent_tasks_started_at_idx" ON "agent_tasks" ("started_at")`,
  `CREATE INDEX IF NOT EXISTS "agent_tasks_lease_idx" ON "agent_tasks" ("status", "lease_expires_at")`,

  `CREATE TABLE IF NOT EXISTS "agent_checkpoints" (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES "agent_tasks"("id") ON DELETE CASCADE,
    step_number INTEGER NOT NULL DEFAULT 0,
    step_name TEXT NOT NULL,
    state TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "agent_checkpoints_task_id_idx" ON "agent_checkpoints" ("task_id")`,
  `CREATE INDEX IF NOT EXISTS "agent_checkpoints_task_step_idx" ON "agent_checkpoints" ("task_id", "step_number")`,

  `CREATE TABLE IF NOT EXISTS "agent_subtasks" (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES "agent_tasks"("id") ON DELETE CASCADE,
    title TEXT NOT NULL,
    agent_worker TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    dependencies TEXT DEFAULT '[]',
    parallel_group INTEGER NOT NULL DEFAULT 0,
    input_args TEXT DEFAULT '{}',
    output_result TEXT DEFAULT '{}',
    error TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER,
    completed_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS "agent_subtasks_task_id_idx" ON "agent_subtasks" ("task_id")`,
  `CREATE INDEX IF NOT EXISTS "agent_subtasks_status_idx" ON "agent_subtasks" ("status")`,

  `CREATE TABLE IF NOT EXISTS "agent_events" (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES "agent_tasks"("id") ON DELETE CASCADE,
    subtask_id TEXT,
    event_type TEXT NOT NULL,
    agent_worker TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    payload TEXT DEFAULT '{}',
    timestamp INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "agent_events_task_id_idx" ON "agent_events" ("task_id")`,
  `CREATE INDEX IF NOT EXISTS "agent_events_type_idx" ON "agent_events" ("event_type")`,
  `CREATE INDEX IF NOT EXISTS "agent_events_timestamp_idx" ON "agent_events" ("timestamp")`,

  `CREATE TABLE IF NOT EXISTS "agent_tool_calls" (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES "agent_tasks"("id") ON DELETE CASCADE,
    subtask_id TEXT,
    tool_name TEXT NOT NULL,
    agent_worker TEXT NOT NULL,
    args TEXT DEFAULT '{}',
    result TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    called_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "agent_tool_calls_task_id_idx" ON "agent_tool_calls" ("task_id")`,
  `CREATE INDEX IF NOT EXISTS "agent_tool_calls_tool_idx" ON "agent_tool_calls" ("tool_name")`,

  `CREATE TABLE IF NOT EXISTS "agent_artifacts" (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES "agent_tasks"("id") ON DELETE CASCADE,
    artifact_type TEXT NOT NULL,
    title TEXT NOT NULL,
    path TEXT,
    content TEXT,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "agent_artifacts_task_id_idx" ON "agent_artifacts" ("task_id")`,
  `CREATE INDEX IF NOT EXISTS "agent_artifacts_type_idx" ON "agent_artifacts" ("artifact_type")`,

  `CREATE TABLE IF NOT EXISTS "agent_errors" (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES "agent_tasks"("id") ON DELETE CASCADE,
    subtask_id TEXT,
    agent_worker TEXT,
    error_code TEXT NOT NULL,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    context_data TEXT DEFAULT '{}',
    is_recovered INTEGER NOT NULL DEFAULT 0,
    recovery_action TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "agent_errors_task_id_idx" ON "agent_errors" ("task_id")`,
  `CREATE INDEX IF NOT EXISTS "agent_errors_code_idx" ON "agent_errors" ("error_code")`,

  `CREATE TABLE IF NOT EXISTS "agent_runs" (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES "agent_tasks"("id") ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    model_used TEXT NOT NULL,
    total_duration_ms INTEGER NOT NULL DEFAULT 0,
    total_tokens_prompt INTEGER NOT NULL DEFAULT 0,
    total_tokens_completion INTEGER NOT NULL DEFAULT 0,
    tool_calls_count INTEGER NOT NULL DEFAULT 0,
    files_created_count INTEGER NOT NULL DEFAULT 0,
    files_modified_count INTEGER NOT NULL DEFAULT 0,
    commands_run_count INTEGER NOT NULL DEFAULT 0,
    retries_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "agent_runs_task_id_idx" ON "agent_runs" ("task_id")`,
  `CREATE INDEX IF NOT EXISTS "agent_runs_user_id_idx" ON "agent_runs" ("user_id")`,

  `CREATE TABLE IF NOT EXISTS "worker_jobs" (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    payload TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'queued',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at INTEGER,
    lease_owner TEXT,
    lease_expires_at INTEGER,
    checkpoint TEXT DEFAULT '{}',
    result TEXT DEFAULT '{}',
    error TEXT,
    user_id TEXT,
    project_id TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    started_at INTEGER,
    completed_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS "worker_jobs_status_retry_idx" ON "worker_jobs" ("status", "next_retry_at")`,
  `CREATE INDEX IF NOT EXISTS "worker_jobs_lease_idx" ON "worker_jobs" ("status", "lease_expires_at")`,
  `CREATE INDEX IF NOT EXISTS "worker_jobs_user_id_idx" ON "worker_jobs" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "worker_jobs_project_id_idx" ON "worker_jobs" ("project_id")`,

  `CREATE TABLE IF NOT EXISTS "nexus_delegations" (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES "agent_tasks"("id") ON DELETE CASCADE,
    subtask_id TEXT,
    parent_agent_id TEXT NOT NULL,
    target_agent_id TEXT NOT NULL,
    depth INTEGER NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    budget_allocated TEXT DEFAULT '{}',
    input_summary TEXT,
    output_summary TEXT,
    blocked_reason TEXT,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    completed_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS "nexus_delegations_task_id_idx" ON "nexus_delegations" ("task_id")`,
  `CREATE INDEX IF NOT EXISTS "nexus_delegations_agents_idx" ON "nexus_delegations" ("parent_agent_id", "target_agent_id")`,
  `CREATE INDEX IF NOT EXISTS "nexus_delegations_status_idx" ON "nexus_delegations" ("status")`,

  `CREATE TABLE IF NOT EXISTS "nexus_skill_activations" (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES "agent_tasks"("id") ON DELETE CASCADE,
    subtask_id TEXT,
    agent_id TEXT NOT NULL,
    skill_id TEXT NOT NULL,
    skill_version TEXT NOT NULL,
    relevance_score REAL NOT NULL DEFAULT 0.0,
    reason TEXT,
    estimated_tokens INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    activated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "nexus_skill_activations_task_idx" ON "nexus_skill_activations" ("task_id")`,
  `CREATE INDEX IF NOT EXISTS "nexus_skill_activations_skill_idx" ON "nexus_skill_activations" ("skill_id", "agent_id")`,

  `CREATE TABLE IF NOT EXISTS "nexus_execution_traces" (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES "agent_tasks"("id") ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    engine_mode TEXT NOT NULL DEFAULT 'nexus_orchestrator',
    agent_id TEXT NOT NULL,
    agent_version TEXT NOT NULL DEFAULT '1.0.0',
    model_used TEXT NOT NULL,
    provider_used TEXT NOT NULL,
    routing_reason TEXT,
    skills_used TEXT DEFAULT '[]',
    tools_invoked TEXT DEFAULT '[]',
    delegations_count INTEGER NOT NULL DEFAULT 0,
    checkpoint_id TEXT,
    completed_step_keys TEXT DEFAULT '[]',
    evidence TEXT DEFAULT '{}',
    cost_estimate_usd REAL NOT NULL DEFAULT 0.0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    error_summary TEXT,
    config_snapshot TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "nexus_traces_task_id_idx" ON "nexus_execution_traces" ("task_id")`,
  `CREATE INDEX IF NOT EXISTS "nexus_traces_user_id_idx" ON "nexus_execution_traces" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "nexus_traces_status_idx" ON "nexus_execution_traces" ("status")`,
  `CREATE INDEX IF NOT EXISTS "nexus_traces_created_idx" ON "nexus_execution_traces" ("created_at")`,

  // 10. User Devices, Preferences, Notifications & Cloud Sync
  `CREATE TABLE IF NOT EXISTS "user_devices" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    session_id TEXT,
    device_type TEXT NOT NULL DEFAULT 'desktop',
    browser TEXT NOT NULL DEFAULT 'Unknown Browser',
    os TEXT NOT NULL DEFAULT 'Unknown OS',
    name TEXT NOT NULL DEFAULT 'My Device',
    ip_address TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_seen_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "user_devices_user_id_idx" ON "user_devices" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "user_devices_user_status_idx" ON "user_devices" ("user_id", "status")`,
  `CREATE INDEX IF NOT EXISTS "user_devices_last_seen_idx" ON "user_devices" ("last_seen_at")`,

  `CREATE TABLE IF NOT EXISTS "user_preferences" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'dark',
    locale TEXT NOT NULL DEFAULT 'ar',
    default_model_id TEXT NOT NULL DEFAULT 'spark',
    sound_enabled INTEGER NOT NULL DEFAULT 1,
    auto_scroll INTEGER NOT NULL DEFAULT 1,
    web_search_enabled INTEGER NOT NULL DEFAULT 0,
    custom_settings TEXT DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_id_idx" ON "user_preferences" ("user_id")`,

  `CREATE TABLE IF NOT EXISTS "notifications" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read INTEGER NOT NULL DEFAULT 0,
    metadata TEXT DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    read_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "notifications_user_unread_idx" ON "notifications" ("user_id", "is_read")`,
  `CREATE INDEX IF NOT EXISTS "notifications_created_idx" ON "notifications" ("created_at")`,

  `CREATE TABLE IF NOT EXISTS "sync_events" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    device_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    payload TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "sync_events_user_created_idx" ON "sync_events" ("user_id", "created_at")`,
  `CREATE INDEX IF NOT EXISTS "sync_events_user_entity_idx" ON "sync_events" ("user_id", "entity_type", "entity_id")`,

  `CREATE TABLE IF NOT EXISTS "sync_cursors" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    last_sync_timestamp INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    last_event_id TEXT,
    server_revision INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "sync_cursors_user_device_idx" ON "sync_cursors" ("user_id", "device_id")`,

  `CREATE TABLE IF NOT EXISTS "encrypted_vault_keys" (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    provider_id TEXT NOT NULL,
    key_label TEXT,
    key_version INTEGER NOT NULL DEFAULT 1,
    encryption_version TEXT NOT NULL DEFAULT 'v1_aes256gcm',
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    ciphertext TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_used_at INTEGER,
    rotated_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "vault_keys_user_provider_idx" ON "encrypted_vault_keys" ("user_id", "provider_id")`,
  `CREATE INDEX IF NOT EXISTS "vault_keys_provider_status_idx" ON "encrypted_vault_keys" ("provider_id", "status")`,

  // 11. Watch History
  `CREATE TABLE IF NOT EXISTS "watch_history" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    media_id TEXT NOT NULL,
    position_seconds INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    completed INTEGER NOT NULL DEFAULT 0,
    last_watched_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "watch_history_user_idx" ON "watch_history" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "watch_history_media_idx" ON "watch_history" ("media_id")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "watch_history_user_media_idx" ON "watch_history" ("user_id", "media_id")`,

  // 12. Scheduled Tasks
  `CREATE TABLE IF NOT EXISTS "scheduled_tasks" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    chat_id TEXT,
    channel TEXT NOT NULL DEFAULT 'web',
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'reminder',
    prompt TEXT,
    payload TEXT DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    target_timestamp INTEGER NOT NULL,
    target_date_iso TEXT NOT NULL,
    recurrence TEXT NOT NULL DEFAULT 'once',
    auto_execute INTEGER NOT NULL DEFAULT 1,
    execution_result TEXT DEFAULT '{}',
    last_error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    lease_owner TEXT,
    lease_expires_at INTEGER,
    executed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "scheduled_tasks_user_id_idx" ON "scheduled_tasks" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "scheduled_tasks_status_idx" ON "scheduled_tasks" ("status")`,
  `CREATE INDEX IF NOT EXISTS "scheduled_tasks_target_time_idx" ON "scheduled_tasks" ("target_timestamp")`,
  `CREATE INDEX IF NOT EXISTS "scheduled_tasks_channel_idx" ON "scheduled_tasks" ("channel")`,
  `CREATE INDEX IF NOT EXISTS "scheduled_tasks_lease_idx" ON "scheduled_tasks" ("status", "lease_expires_at")`,

  // 13. User Adaptive Learning
  `CREATE TABLE IF NOT EXISTS "user_learning_patterns" (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    pattern_type TEXT NOT NULL,
    category TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.5,
    occurrences INTEGER NOT NULL DEFAULT 1,
    insights TEXT DEFAULT '{}',
    last_observed_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "user_learning_patterns_user_idx" ON "user_learning_patterns" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "user_learning_patterns_type_idx" ON "user_learning_patterns" ("pattern_type")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_learning_user_key_idx" ON "user_learning_patterns" ("user_id", "key")`,

  // 14. WhatsApp Persistent Auth & Pairing
  `CREATE TABLE IF NOT EXISTS "whatsapp_auth_sessions" (
    session_id TEXT NOT NULL,
    key_id TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_auth_session_key_idx" ON "whatsapp_auth_sessions" ("session_id", "key_id")`,
  `CREATE INDEX IF NOT EXISTS "whatsapp_auth_session_id_idx" ON "whatsapp_auth_sessions" ("session_id")`,

  `CREATE TABLE IF NOT EXISTS "whatsapp_paired_users" (
    phone TEXT PRIMARY KEY NOT NULL,
    user_id TEXT,
    email TEXT,
    first_name TEXT,
    pairing_code TEXT,
    linked_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "whatsapp_paired_users_user_id_idx" ON "whatsapp_paired_users" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "whatsapp_paired_users_email_idx" ON "whatsapp_paired_users" ("email")`,

  // 15. Server Runtime Errors
  `CREATE TABLE IF NOT EXISTS "runtime_errors" (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    last_occurrence INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    occurrences_count INTEGER NOT NULL DEFAULT 1,
    severity TEXT NOT NULL DEFAULT 'error',
    category TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    endpoint TEXT,
    provider_id TEXT,
    model_id TEXT,
    status_code INTEGER,
    diagnosis TEXT,
    suggested_fix TEXT,
    auto_fix_action TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    resolved_at INTEGER,
    resolved_by TEXT,
    resolution_notes TEXT,
    ai_analysis TEXT,
    metadata TEXT DEFAULT '{}',
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "runtime_errors_status_idx" ON "runtime_errors" ("status")`,
  `CREATE INDEX IF NOT EXISTS "runtime_errors_category_idx" ON "runtime_errors" ("category")`,
  `CREATE INDEX IF NOT EXISTS "runtime_errors_severity_idx" ON "runtime_errors" ("severity")`,
  `CREATE INDEX IF NOT EXISTS "runtime_errors_last_occ_idx" ON "runtime_errors" ("last_occurrence")`,

  // 16. Web Push Subscriptions
  `CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    last_used_at INTEGER
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_idx" ON "push_subscriptions" ("endpoint")`,
  `CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_idx" ON "push_subscriptions" ("user_id")`,

  // 17. Telegram Paired Users & Encrypted OAuth Tokens
  `CREATE TABLE IF NOT EXISTS "telegram_paired_users" (
    chat_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    email TEXT,
    username TEXT,
    first_name TEXT,
    pairing_code TEXT,
    linked_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE INDEX IF NOT EXISTS "telegram_paired_users_user_id_idx" ON "telegram_paired_users" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "telegram_paired_users_email_idx" ON "telegram_paired_users" ("email")`,

  `CREATE TABLE IF NOT EXISTS "telegram_oauth_tokens" (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    service TEXT NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    email TEXT,
    connected_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR},
    updated_at INTEGER NOT NULL DEFAULT ${NOW_MS_EXPR}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "telegram_oauth_chat_service_idx" ON "telegram_oauth_tokens" ("chat_id", "service")`,
  `CREATE INDEX IF NOT EXISTS "telegram_oauth_chat_idx" ON "telegram_oauth_tokens" ("chat_id")`,
];

export async function runMigrations(externalClient?: Client): Promise<{
  success: boolean;
  error?: string;
  appliedCount?: number;
}> {
  let client = externalClient;
  let shouldClose = false;

  try {
    const cfg = validateTursoEnv();
    if (!client) {
      client = createClient({
        url: cfg.url,
        authToken: cfg.authToken,
      });
      shouldClose = true;
    }

    // Configure SQLite pragmas cleanly (Turso Cloud disallows busy_timeout/WAL pragmas over Hrana)
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

    return {
      success: true,
      appliedCount: MIGRATION_STATEMENTS.length,
    };
  } catch (err: any) {
    console.error("[Turso Migrate] Error:", err?.message || err);
    return {
      success: false,
      error: err?.message || String(err),
    };
  } finally {
    if (shouldClose && client) {
      try {
        client.close();
      } catch (closeError) {
        console.error("[Turso Migrate] Failed to close the client cleanly:", closeError);
      }
    }
  }
}

// Execute directly when invoked from CLI (`npx tsx lib/db/migrate.ts`)
if (typeof require !== "undefined" && require.main === module) {
  runMigrations()
    .then((res) => {
      if (!res.success) {
        console.error("Turso migration failed:", res.error);
        process.exit(1);
      }
      console.log(`[Turso Migrate] Applied ${res.appliedCount} idempotent statements successfully.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Turso migration fatal error:", err);
      process.exit(1);
    });
}
