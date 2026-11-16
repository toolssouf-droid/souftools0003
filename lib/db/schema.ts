/**
 * SoufTools Database Schema Definition (Turso / libSQL + Drizzle ORM SQLite Core)
 * Comprehensive schema for users, sessions, chats, memories, behavior,
 * AI providers, storage objects, projects, durable agent checkpoints,
 * Claim/Lease worker jobs, runtime sessions, and audit telemetry.
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ==========================================
// 1. Better Auth & Core Users
// ==========================================

export const users = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
    image: text("image"),
    role: text("role").default("user").notNull(),
    storageUsedBytes: integer("storage_used_bytes", { mode: "number" }).default(0).notNull(),
    storageLimitBytes: integer("storage_limit_bytes", { mode: "number" }).default(157286400).notNull(),
    isBanned: integer("is_banned", { mode: "boolean" }).default(false).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_role_idx").on(table.role),
  ]
);

export const userSessions = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    uniqueIndex("sessions_token_idx").on(table.token),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ]
);

export const accounts = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_idx").on(table.providerId, table.accountId),
  ]
);

export const verifications = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("verifications_identifier_idx").on(table.identifier),
  ]
);

// ==========================================
// 2. Chat Conversations & Messages
// ==========================================

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    modelId: text("model_id").notNull().default("soufai-spark"),
    systemPrompt: text("system_prompt"),
    isPinned: integer("is_pinned", { mode: "boolean" }).default(false).notNull(),
    isArchived: integer("is_archived", { mode: "boolean" }).default(false).notNull(),
    version: integer("version").default(1).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("conversations_user_id_idx").on(table.userId),
    index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    sender: text("sender").notNull(),
    content: text("content").notNull(),
    reasoning: text("reasoning"),
    sources: text("sources", { mode: "json" }).$type<any[]>().default([]),
    toolCalls: text("tool_calls", { mode: "json" }).$type<any[]>().default([]),
    version: integer("version").default(1).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  ]
);

export const messageAttachments = sqliteTable(
  "message_attachments",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    fileId: text("file_id").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes", { mode: "number" }).notNull(),
    url: text("url"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("message_attachments_message_id_idx").on(table.messageId),
  ]
);

// ==========================================
// 3. SoufAI Long-term Memory & Behavior
// ==========================================

export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    content: text("content").notNull(),
    importance: real("importance").default(0.8).notNull(),
    confidence: real("confidence").default(1.0).notNull(),
    source: text("source").default("auto").notNull(),
    status: text("status").default("active").notNull(),
    projectId: text("project_id"),
    projectName: text("project_name"),
    userName: text("user_name"),
    category: text("category"),
    tags: text("tags", { mode: "json" }).$type<string[]>().default([]),
    enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
    version: integer("version").default(1).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("memories_user_id_idx").on(table.userId),
    index("memories_user_type_idx").on(table.userId, table.type),
    index("memories_user_status_idx").on(table.userId, table.status),
    index("memories_user_updated_idx").on(table.userId, table.updatedAt),
    index("memories_project_id_idx").on(table.projectId),
  ]
);

export const memoryAccessLogs = sqliteTable(
  "memory_access_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    memoryId: text("memory_id"),
    action: text("action").notNull(),
    promptSnippet: text("prompt_snippet"),
    relevanceScore: real("relevance_score"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("memory_access_logs_user_id_idx").on(table.userId),
    index("memory_access_logs_created_at_idx").on(table.createdAt),
  ]
);

export const memorySettings = sqliteTable(
  "memory_settings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    memoryEnabled: integer("memory_enabled", { mode: "boolean" }).default(true).notNull(),
    autoSuggest: integer("auto_suggest", { mode: "boolean" }).default(true).notNull(),
    autoExtract: integer("auto_extract", { mode: "boolean" }).default(true).notNull(),
    maxContextItems: integer("max_context_items").default(8).notNull(),
    retentionDays: integer("retention_days").default(365).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("memory_settings_user_id_idx").on(table.userId),
  ]
);

export const behaviorProfiles = sqliteTable(
  "behavior_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    preferences: text("preferences", { mode: "json" }).$type<Record<string, any>>().default({}),
    patterns: text("patterns", { mode: "json" }).$type<Record<string, any>>().default({}),
    stats: text("stats", { mode: "json" }).$type<Record<string, any>>().default({}),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("behavior_profiles_user_id_idx").on(table.userId),
  ]
);

// ==========================================
// 4. AI Providers, Models, Keys & Health
// ==========================================

export const aiProviders = sqliteTable(
  "ai_providers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
    priority: integer("priority").default(1).notNull(),
    rotationMode: text("rotation_mode").default("priority").notNull(),
    config: text("config", { mode: "json" }).$type<Record<string, any>>().default({}),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  }
);

export const aiModels = sqliteTable(
  "ai_models",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull().references(() => aiProviders.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    modelCode: text("model_code").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).default(true).notNull(),
    contextWindow: integer("context_window").default(128000).notNull(),
    costPerToken: real("cost_per_token").default(0.0).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("ai_models_provider_id_idx").on(table.providerId),
  ]
);

export const aiKeys = sqliteTable(
  "ai_keys",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull().references(() => aiProviders.id, { onDelete: "cascade" }),
    encryptedKey: text("encrypted_key").notNull(),
    status: text("status").default("active").notNull(),
    failureCount: integer("failure_count").default(0).notNull(),
    lastTestedAt: integer("last_tested_at", { mode: "timestamp_ms" }),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    failureReason: text("failure_reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("ai_keys_provider_status_idx").on(table.providerId, table.status),
  ]
);

export const aiHealth = sqliteTable(
  "ai_health",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id"),
    status: text("status").default("healthy").notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    errorRate: real("error_rate").default(0.0).notNull(),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("ai_health_provider_idx").on(table.providerId),
  ]
);

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    promptTokens: integer("prompt_tokens").default(0).notNull(),
    completionTokens: integer("completion_tokens").default(0).notNull(),
    totalCost: real("total_cost").default(0.0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("ai_usage_user_created_idx").on(table.userId, table.createdAt),
    index("ai_usage_provider_created_idx").on(table.providerId, table.createdAt),
  ]
);

export const routingLogs = sqliteTable(
  "routing_logs",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    userId: text("user_id"),
    promptLength: integer("prompt_length").default(0).notNull(),
    chosenProvider: text("chosen_provider").notNull(),
    chosenModel: text("chosen_model").notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    fallbackOccurred: integer("fallback_occurred", { mode: "boolean" }).default(false).notNull(),
    status: text("status").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("routing_logs_request_id_idx").on(table.requestId),
    index("routing_logs_created_idx").on(table.createdAt),
  ]
);

// ==========================================
// 5. Private Object Storage & Files
// ==========================================

export const storageObjects = sqliteTable(
  "storage_objects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id"),
    projectId: text("project_id"),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    category: text("category").notNull(),
    sizeBytes: integer("size_bytes", { mode: "number" }).notNull(),
    checksum: text("checksum"),
    storageProvider: text("storage_provider").default("local_private").notNull(),
    isPublic: integer("is_public", { mode: "boolean" }).default(false).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("storage_objects_user_id_idx").on(table.userId),
    index("storage_objects_category_idx").on(table.category),
    index("storage_objects_conversation_idx").on(table.conversationId),
    index("storage_objects_project_idx").on(table.projectId),
  ]
);

// ==========================================
// 6. Projects & Sandbox Runtime
// ==========================================

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    framework: text("framework").default("react_nextjs").notNull(),
    version: integer("version").default(1).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("projects_user_id_idx").on(table.userId),
    index("projects_user_updated_idx").on(table.userId, table.updatedAt),
  ]
);

export const projectFiles = sqliteTable(
  "project_files",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    sizeBytes: integer("size_bytes").default(0).notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("project_files_project_id_idx").on(table.projectId),
    uniqueIndex("project_files_path_idx").on(table.projectId, table.path),
  ]
);

export const runtimeSessions = sqliteTable(
  "runtime_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    sandboxId: text("sandbox_id"),
    status: text("status").default("running").notNull(),
    memoryMb: integer("memory_mb").default(512).notNull(),
    cpuCores: integer("cpu_cores").default(1).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    stoppedAt: integer("stopped_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("runtime_sessions_user_status_idx").on(table.userId, table.status),
  ]
);

export const runtimeLogs = sqliteTable(
  "runtime_logs",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull().references(() => runtimeSessions.id, { onDelete: "cascade" }),
    stream: text("stream").default("stdout").notNull(),
    message: text("message").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("runtime_logs_session_id_idx").on(table.sessionId),
  ]
);

// ==========================================
// 7. Security & Admin Logs & Settings
// ==========================================

export const adminLogs = sqliteTable(
  "admin_logs",
  {
    id: text("id").primaryKey(),
    adminUserId: text("admin_user_id").notNull(),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    details: text("details", { mode: "json" }).$type<Record<string, any>>().default({}),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("admin_logs_created_idx").on(table.createdAt),
    index("admin_logs_admin_id_idx").on(table.adminUserId),
  ]
);

export const settings = sqliteTable(
  "settings",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    value: text("value", { mode: "json" }).$type<any>().notNull(),
    isEncrypted: integer("is_encrypted", { mode: "boolean" }).default(false).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("settings_key_idx").on(table.key),
  ]
);

// ==========================================
// 8. Platform Analytics & Telemetry Engine
// ==========================================

export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    category: text("category").notNull(),
    userId: text("user_id"),
    sessionId: text("session_id"),
    resourceId: text("resource_id"),
    durationMs: integer("duration_ms").default(0).notNull(),
    tokensPrompt: integer("tokens_prompt").default(0).notNull(),
    tokensCompletion: integer("tokens_completion").default(0).notNull(),
    status: text("status").default("success").notNull(),
    errorMessage: text("error_message"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    country: text("country"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("analytics_events_type_idx").on(table.eventType),
    index("analytics_events_category_idx").on(table.category),
    index("analytics_events_user_id_idx").on(table.userId),
    index("analytics_events_status_idx").on(table.status),
    index("analytics_events_created_idx").on(table.createdAt),
  ]
);

export const analyticsDailyAggregates = sqliteTable(
  "analytics_daily_aggregates",
  {
    id: text("id").primaryKey(),
    date: text("date").notNull(),
    metricCategory: text("metric_category").notNull(),
    dimensionKey: text("dimension_key").notNull(),
    countValue: integer("count_value").default(0).notNull(),
    sumDurationMs: integer("sum_duration_ms", { mode: "number" }).default(0).notNull(),
    sumTokens: integer("sum_tokens", { mode: "number" }).default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    uniqueUsersCount: integer("unique_users_count").default(0).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("analytics_daily_date_dim_idx").on(table.date, table.metricCategory, table.dimensionKey),
    index("analytics_daily_date_idx").on(table.date),
    index("analytics_daily_category_idx").on(table.metricCategory),
  ]
);

export const analyticsToolMetrics = sqliteTable(
  "analytics_tool_metrics",
  {
    id: text("id").primaryKey(),
    toolId: text("tool_id").notNull(),
    toolName: text("tool_name").notNull(),
    date: text("date").notNull(),
    totalRequests: integer("total_requests").default(0).notNull(),
    successfulRequests: integer("successful_requests").default(0).notNull(),
    failedRequests: integer("failed_requests").default(0).notNull(),
    avgLatencyMs: real("avg_latency_ms").default(0.0).notNull(),
    p95LatencyMs: real("p95_latency_ms").default(0.0).notNull(),
    uniqueUsers: integer("unique_users").default(0).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("analytics_tool_date_idx").on(table.toolId, table.date),
    index("analytics_tool_id_idx").on(table.toolId),
  ]
);

export const analyticsModelMetrics = sqliteTable(
  "analytics_model_metrics",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    modelId: text("model_id").notNull(),
    date: text("date").notNull(),
    totalRequests: integer("total_requests").default(0).notNull(),
    promptTokens: integer("prompt_tokens", { mode: "number" }).default(0).notNull(),
    completionTokens: integer("completion_tokens", { mode: "number" }).default(0).notNull(),
    totalCostEstimate: real("total_cost_estimate").default(0.0).notNull(),
    avgLatencyMs: real("avg_latency_ms").default(0.0).notNull(),
    p95LatencyMs: real("p95_latency_ms").default(0.0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    rateLimitCount: integer("rate_limit_count").default(0).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("analytics_model_date_idx").on(table.providerId, table.modelId, table.date),
    index("analytics_model_provider_idx").on(table.providerId),
  ]
);

export const analyticsSecurityEvents = sqliteTable(
  "analytics_security_events",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    severity: text("severity").default("medium").notNull(),
    ipAddress: text("ip_address"),
    userId: text("user_id"),
    action: text("action").notNull(),
    reason: text("reason"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("analytics_security_type_idx").on(table.eventType),
    index("analytics_security_severity_idx").on(table.severity),
    index("analytics_security_created_idx").on(table.createdAt),
  ]
);

export const analyticsSystemSnapshots = sqliteTable(
  "analytics_system_snapshots",
  {
    id: text("id").primaryKey(),
    cpuPercent: real("cpu_percent").default(0.0).notNull(),
    memoryUsedMb: integer("memory_used_mb").default(0).notNull(),
    memoryTotalMb: integer("memory_total_mb").default(0).notNull(),
    diskUsedMb: integer("disk_used_mb").default(0).notNull(),
    diskTotalMb: integer("disk_total_mb").default(0).notNull(),
    activeSandboxes: integer("active_sandboxes").default(0).notNull(),
    activeWorkers: integer("active_workers").default(0).notNull(),
    queueLength: integer("queue_length").default(0).notNull(),
    dbConnections: integer("db_connections").default(0).notNull(),
    dbLatencyMs: integer("db_latency_ms").default(0).notNull(),
    requestsPerSec: real("requests_per_sec").default(0.0).notNull(),
    uptimeSeconds: integer("uptime_seconds", { mode: "number" }).default(0).notNull(),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("analytics_snapshots_timestamp_idx").on(table.timestamp),
  ]
);

// ==========================================
// 9. SoufAI Autonomous Agent Engine & Durable Worker Queue
// ==========================================

export const agentTasks = sqliteTable(
  "agent_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    projectId: text("project_id"),
    goal: text("goal").notNull(),
    category: text("category").default("general").notNull(),
    status: text("status").default("pending").notNull(),
    budgetTier: text("budget_tier").default("auto").notNull(),
    maxSteps: integer("max_steps").default(7).notNull(),
    currentStep: integer("current_step").default(0).notNull(),
    plan: text("plan", { mode: "json" }).$type<string[]>().default([]),
    activeAgents: text("active_agents", { mode: "json" }).$type<string[]>().default([]),
    filesChanged: text("files_changed", { mode: "json" }).$type<string[]>().default([]),
    summary: text("summary"),
    finalResponse: text("final_response"),
    qualityScore: integer("quality_score"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    leaseOwner: text("lease_owner"),
    leaseToken: text("lease_token"),
    leaseGeneration: integer("lease_generation").default(0).notNull(),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    retryCount: integer("retry_count").default(0).notNull(),
    checkpointStep: integer("checkpoint_step").default(0).notNull(),
    checkpointData: text("checkpoint_data", { mode: "json" }).$type<Record<string, any>>().default({}),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("agent_tasks_user_id_idx").on(table.userId),
    index("agent_tasks_project_id_idx").on(table.projectId),
    index("agent_tasks_status_idx").on(table.status),
    index("agent_tasks_started_at_idx").on(table.startedAt),
    index("agent_tasks_lease_idx").on(table.status, table.leaseExpiresAt),
  ]
);

export const agentCheckpoints = sqliteTable(
  "agent_checkpoints",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").default(0).notNull(),
    stepName: text("step_name").notNull(),
    state: text("state", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("agent_checkpoints_task_id_idx").on(table.taskId),
    index("agent_checkpoints_task_step_idx").on(table.taskId, table.stepNumber),
  ]
);

export const agentSubtasks = sqliteTable(
  "agent_subtasks",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    agentWorker: text("agent_worker").notNull(),
    status: text("status").default("pending").notNull(),
    dependencies: text("dependencies", { mode: "json" }).$type<string[]>().default([]),
    parallelGroup: integer("parallel_group").default(0).notNull(),
    inputArgs: text("input_args", { mode: "json" }).$type<Record<string, any>>().default({}),
    outputResult: text("output_result", { mode: "json" }).$type<Record<string, any>>().default({}),
    error: text("error"),
    durationMs: integer("duration_ms").default(0).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("agent_subtasks_task_id_idx").on(table.taskId),
    index("agent_subtasks_status_idx").on(table.status),
  ]
);

export const agentEvents = sqliteTable(
  "agent_events",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    subtaskId: text("subtask_id"),
    eventType: text("event_type").notNull(),
    agentWorker: text("agent_worker"),
    title: text("title").notNull(),
    summary: text("summary"),
    status: text("status").default("running").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, any>>().default({}),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("agent_events_task_id_idx").on(table.taskId),
    index("agent_events_type_idx").on(table.eventType),
    index("agent_events_timestamp_idx").on(table.timestamp),
  ]
);

export const agentToolCalls = sqliteTable(
  "agent_tool_calls",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    subtaskId: text("subtask_id"),
    toolName: text("tool_name").notNull(),
    agentWorker: text("agent_worker").notNull(),
    args: text("args", { mode: "json" }).$type<Record<string, any>>().default({}),
    result: text("result", { mode: "json" }).$type<Record<string, any>>().default({}),
    status: text("status").default("success").notNull(),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms").default(0).notNull(),
    calledAt: integer("called_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("agent_tool_calls_task_id_idx").on(table.taskId),
    index("agent_tool_calls_tool_idx").on(table.toolName),
  ]
);

export const agentArtifacts = sqliteTable(
  "agent_artifacts",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    artifactType: text("artifact_type").notNull(),
    title: text("title").notNull(),
    path: text("path"),
    content: text("content"),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("agent_artifacts_task_id_idx").on(table.taskId),
    index("agent_artifacts_type_idx").on(table.artifactType),
  ]
);

export const agentErrors = sqliteTable(
  "agent_errors",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    subtaskId: text("subtask_id"),
    agentWorker: text("agent_worker"),
    errorCode: text("error_code").notNull(),
    errorMessage: text("error_message").notNull(),
    stackTrace: text("stack_trace"),
    contextData: text("context_data", { mode: "json" }).$type<Record<string, any>>().default({}),
    isRecovered: integer("is_recovered", { mode: "boolean" }).default(false).notNull(),
    recoveryAction: text("recovery_action"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("agent_errors_task_id_idx").on(table.taskId),
    index("agent_errors_code_idx").on(table.errorCode),
  ]
);

export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    modelUsed: text("model_used").notNull(),
    totalDurationMs: integer("total_duration_ms").default(0).notNull(),
    totalTokensPrompt: integer("total_tokens_prompt").default(0).notNull(),
    totalTokensCompletion: integer("total_tokens_completion").default(0).notNull(),
    toolCallsCount: integer("tool_calls_count").default(0).notNull(),
    filesCreatedCount: integer("files_created_count").default(0).notNull(),
    filesModifiedCount: integer("files_modified_count").default(0).notNull(),
    commandsRunCount: integer("commands_run_count").default(0).notNull(),
    retriesCount: integer("retries_count").default(0).notNull(),
    status: text("status").default("completed").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("agent_runs_task_id_idx").on(table.taskId),
    index("agent_runs_user_id_idx").on(table.userId),
  ]
);

export const workerJobs = sqliteTable(
  "worker_jobs",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, any>>().default({}),
    status: text("status").default("queued").notNull(), // 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    nextRetryAt: integer("next_retry_at", { mode: "timestamp_ms" }),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    checkpoint: text("checkpoint", { mode: "json" }).$type<Record<string, any>>().default({}),
    result: text("result", { mode: "json" }).$type<Record<string, any>>().default({}),
    error: text("error"),
    userId: text("user_id"),
    projectId: text("project_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    startedAt: integer("started_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("worker_jobs_status_retry_idx").on(table.status, table.nextRetryAt),
    index("worker_jobs_lease_idx").on(table.status, table.leaseExpiresAt),
    index("worker_jobs_user_id_idx").on(table.userId),
    index("worker_jobs_project_id_idx").on(table.projectId),
  ]
);

export const nexusDelegations = sqliteTable(
  "nexus_delegations",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    subtaskId: text("subtask_id"),
    parentAgentId: text("parent_agent_id").notNull(),
    targetAgentId: text("target_agent_id").notNull(),
    depth: integer("depth").default(1).notNull(),
    reason: text("reason").notNull(),
    status: text("status").default("completed").notNull(), // 'pending' | 'running' | 'completed' | 'failed' | 'blocked'
    budgetAllocated: text("budget_allocated", { mode: "json" }).$type<Record<string, any>>().default({}),
    inputSummary: text("input_summary"),
    outputSummary: text("output_summary"),
    blockedReason: text("blocked_reason"),
    durationMs: integer("duration_ms").default(0).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("nexus_delegations_task_id_idx").on(table.taskId),
    index("nexus_delegations_agents_idx").on(table.parentAgentId, table.targetAgentId),
    index("nexus_delegations_status_idx").on(table.status),
  ]
);

export const nexusSkillActivations = sqliteTable(
  "nexus_skill_activations",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    subtaskId: text("subtask_id"),
    agentId: text("agent_id").notNull(),
    skillId: text("skill_id").notNull(),
    skillVersion: text("skill_version").notNull(),
    relevanceScore: real("relevance_score").default(0.0).notNull(),
    reason: text("reason"),
    estimatedTokens: integer("estimated_tokens").default(0).notNull(),
    status: text("status").default("active").notNull(),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("nexus_skill_activations_task_idx").on(table.taskId),
    index("nexus_skill_activations_skill_idx").on(table.skillId, table.agentId),
  ]
);

export const nexusExecutionTraces = sqliteTable(
  "nexus_execution_traces",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => agentTasks.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    engineMode: text("engine_mode").default("nexus_orchestrator").notNull(),
    agentId: text("agent_id").notNull(),
    agentVersion: text("agent_version").default("1.0.0").notNull(),
    modelUsed: text("model_used").notNull(),
    providerUsed: text("provider_used").notNull(),
    routingReason: text("routing_reason"),
    skillsUsed: text("skills_used", { mode: "json" }).$type<string[]>().default([]),
    toolsInvoked: text("tools_invoked", { mode: "json" }).$type<Array<Record<string, any>>>().default([]),
    delegationsCount: integer("delegations_count").default(0).notNull(),
    checkpointId: text("checkpoint_id"),
    completedStepKeys: text("completed_step_keys", { mode: "json" }).$type<string[]>().default([]),
    evidence: text("evidence", { mode: "json" }).$type<Record<string, any>>().default({}),
    costEstimateUsd: real("cost_estimate_usd").default(0.0).notNull(),
    latencyMs: integer("latency_ms").default(0).notNull(),
    status: text("status").default("completed").notNull(),
    errorSummary: text("error_summary"),
    configSnapshot: text("config_snapshot", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("nexus_traces_task_id_idx").on(table.taskId),
    index("nexus_traces_user_id_idx").on(table.userId),
    index("nexus_traces_status_idx").on(table.status),
    index("nexus_traces_created_idx").on(table.createdAt),
  ]
);

// ==========================================
// 10. User Devices, Preferences, Notifications & Cloud Sync
// ==========================================

export const userDevices = sqliteTable(
  "user_devices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id"),
    deviceType: text("device_type").default("desktop").notNull(),
    browser: text("browser").default("Unknown Browser").notNull(),
    os: text("os").default("Unknown OS").notNull(),
    name: text("name").default("My Device").notNull(),
    ipAddress: text("ip_address"),
    status: text("status").default("active").notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("user_devices_user_id_idx").on(table.userId),
    index("user_devices_user_status_idx").on(table.userId, table.status),
    index("user_devices_last_seen_idx").on(table.lastSeenAt),
  ]
);

export const userPreferences = sqliteTable(
  "user_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    theme: text("theme").default("dark").notNull(),
    locale: text("locale").default("ar").notNull(),
    defaultModelId: text("default_model_id").default("spark").notNull(),
    soundEnabled: integer("sound_enabled", { mode: "boolean" }).default(true).notNull(),
    autoScroll: integer("auto_scroll", { mode: "boolean" }).default(true).notNull(),
    webSearchEnabled: integer("web_search_enabled", { mode: "boolean" }).default(false).notNull(),
    customSettings: text("custom_settings", { mode: "json" }).$type<Record<string, any>>().default({}),
    version: integer("version").default(1).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("user_preferences_user_id_idx").on(table.userId),
  ]
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").default("info").notNull(),
    isRead: integer("is_read", { mode: "boolean" }).default(false).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    version: integer("version").default(1).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_user_unread_idx").on(table.userId, table.isRead),
    index("notifications_created_idx").on(table.createdAt),
  ]
);

export const syncEvents = sqliteTable(
  "sync_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    operation: text("operation").notNull(),
    version: integer("version").default(1).notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("sync_events_user_created_idx").on(table.userId, table.createdAt),
    index("sync_events_user_entity_idx").on(table.userId, table.entityType, table.entityId),
  ]
);

export const syncCursors = sqliteTable(
  "sync_cursors",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    lastSyncTimestamp: integer("last_sync_timestamp", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    lastEventId: text("last_event_id"),
    serverRevision: integer("server_revision", { mode: "number" }).default(1).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("sync_cursors_user_device_idx").on(table.userId, table.deviceId),
  ]
);

export const encryptedVaultKeys = sqliteTable(
  "encrypted_vault_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    providerId: text("provider_id").notNull(),
    keyLabel: text("key_label"),
    keyVersion: integer("key_version").default(1).notNull(),
    encryptionVersion: text("encryption_version").default("v1_aes256gcm").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    ciphertext: text("ciphertext").notNull(),
    status: text("status").default("active").notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    rotatedAt: integer("rotated_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("vault_keys_user_provider_idx").on(table.userId, table.providerId),
    index("vault_keys_provider_status_idx").on(table.providerId, table.status),
  ]
);

// ==========================================
// 11. Watch History & Media Progress
// ==========================================

export const watchHistory = sqliteTable(
  "watch_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    mediaId: text("media_id").notNull(),
    positionSeconds: integer("position_seconds").default(0).notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    completed: integer("completed", { mode: "boolean" }).default(false).notNull(),
    lastWatchedAt: integer("last_watched_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("watch_history_user_idx").on(table.userId),
    index("watch_history_media_idx").on(table.mediaId),
    uniqueIndex("watch_history_user_media_idx").on(table.userId, table.mediaId),
  ]
);

// ==========================================
// 12. Advanced Database-Backed Scheduled Tasks
// ==========================================

export const scheduledTasks = sqliteTable(
  "scheduled_tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    chatId: text("chat_id"),
    channel: text("channel").default("web").notNull(),
    title: text("title").notNull(),
    type: text("type").default("reminder").notNull(),
    prompt: text("prompt"),
    payload: text("payload", { mode: "json" }).$type<Record<string, any>>().default({}),
    status: text("status").default("pending").notNull(),
    targetTimestamp: integer("target_timestamp", { mode: "number" }).notNull(),
    targetDateIso: text("target_date_iso").notNull(),
    recurrence: text("recurrence").default("once").notNull(),
    autoExecute: integer("auto_execute", { mode: "boolean" }).default(true).notNull(),
    executionResult: text("execution_result", { mode: "json" }).$type<Record<string, any>>().default({}),
    lastError: text("last_error"),
    retryCount: integer("retry_count").default(0).notNull(),
    leaseOwner: text("lease_owner"),
    leaseExpiresAt: integer("lease_expires_at", { mode: "timestamp_ms" }),
    executedAt: integer("executed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("scheduled_tasks_user_id_idx").on(table.userId),
    index("scheduled_tasks_status_idx").on(table.status),
    index("scheduled_tasks_target_time_idx").on(table.targetTimestamp),
    index("scheduled_tasks_channel_idx").on(table.channel),
    index("scheduled_tasks_lease_idx").on(table.status, table.leaseExpiresAt),
  ]
);

// ==========================================
// 13. User Adaptive Learning & Habit Intelligence
// ==========================================

export const userLearningPatterns = sqliteTable(
  "user_learning_patterns",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    patternType: text("pattern_type").notNull(),
    category: text("category").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    confidence: real("confidence").default(0.5).notNull(),
    occurrences: integer("occurrences").default(1).notNull(),
    insights: text("insights", { mode: "json" }).$type<Record<string, any>>().default({}),
    lastObservedAt: integer("last_observed_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("user_learning_patterns_user_idx").on(table.userId),
    index("user_learning_patterns_type_idx").on(table.patternType),
    uniqueIndex("user_learning_user_key_idx").on(table.userId, table.key),
  ]
);

// ==========================================
// 14. WhatsApp Auth Sessions & Paired Users
// ==========================================

export const whatsappAuthSessions = sqliteTable(
  "whatsapp_auth_sessions",
  {
    sessionId: text("session_id").notNull(),
    keyId: text("key_id").notNull(),
    data: text("data").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("whatsapp_auth_session_key_idx").on(table.sessionId, table.keyId),
    index("whatsapp_auth_session_id_idx").on(table.sessionId),
  ]
);

export const whatsappPairedUsers = sqliteTable(
  "whatsapp_paired_users",
  {
    phone: text("phone").primaryKey().notNull(),
    userId: text("user_id"),
    email: text("email"),
    firstName: text("first_name"),
    pairingCode: text("pairing_code"),
    linkedAt: integer("linked_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("whatsapp_paired_users_user_id_idx").on(table.userId),
    index("whatsapp_paired_users_email_idx").on(table.email),
  ]
);

// ==========================================
// 15. Server Runtime Error Diagnostics (Turso)
// ==========================================

export const runtimeErrors = sqliteTable(
  "runtime_errors",
  {
    id: text("id").primaryKey(),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    lastOccurrence: integer("last_occurrence", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    occurrencesCount: integer("occurrences_count").default(1).notNull(),
    severity: text("severity").default("error").notNull(), // 'critical' | 'error' | 'warning'
    category: text("category").default("system").notNull(), // 'ai_model' | 'api_key' | 'database' | 'network' | 'telegram' | 'auth' | 'system' | 'sandbox'
    title: text("title").notNull(),
    message: text("message").notNull(),
    stackTrace: text("stack_trace"),
    endpoint: text("endpoint"),
    providerId: text("provider_id"),
    modelId: text("model_id"),
    statusCode: integer("status_code"),
    diagnosis: text("diagnosis"),
    suggestedFix: text("suggested_fix"),
    autoFixAction: text("auto_fix_action"),
    status: text("status").default("open").notNull(), // 'open' | 'investigating' | 'resolved'
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    resolvedBy: text("resolved_by"),
    resolutionNotes: text("resolution_notes"),
    aiAnalysis: text("ai_analysis", { mode: "json" }).$type<{
      rootCause: string;
      impact: string;
      steps: string[];
      suggestedAction?: string;
      analyzedAt: string;
    }>(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>().default({}),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("runtime_errors_status_idx").on(table.status),
    index("runtime_errors_category_idx").on(table.category),
    index("runtime_errors_severity_idx").on(table.severity),
    index("runtime_errors_last_occ_idx").on(table.lastOccurrence),
  ]
);

// ==========================================
// 16. Web Push Subscriptions (Turso)
// ==========================================

export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_idx").on(table.endpoint),
    index("push_subscriptions_user_id_idx").on(table.userId),
  ]
);

// ==========================================
// 17. Telegram Gateway Pairing & Encrypted OAuth Tokens (Turso)
// ==========================================

export const telegramPairedUsers = sqliteTable(
  "telegram_paired_users",
  {
    chatId: text("chat_id").primaryKey().notNull(),
    userId: text("user_id").notNull(),
    email: text("email"),
    username: text("username"),
    firstName: text("first_name"),
    pairingCode: text("pairing_code"),
    linkedAt: integer("linked_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    index("telegram_paired_users_user_id_idx").on(table.userId),
    index("telegram_paired_users_email_idx").on(table.email),
  ]
);

export const telegramOauthTokens = sqliteTable(
  "telegram_oauth_tokens",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id").notNull(),
    service: text("service").notNull(), // 'gmail' | 'drive'
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    email: text("email"),
    connectedAt: integer("connected_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).$defaultFn(() => new Date()).notNull(),
  },
  (table) => [
    uniqueIndex("telegram_oauth_chat_service_idx").on(table.chatId, table.service),
    index("telegram_oauth_chat_idx").on(table.chatId),
  ]
);

// Backward Compatibility Aliases
export const objectStorage = storageObjects;
export const runtimeSandboxes = runtimeSessions;
export const auditLogs = adminLogs;
export const wafBlockedRequests = analyticsSecurityEvents;
