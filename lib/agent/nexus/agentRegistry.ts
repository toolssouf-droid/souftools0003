/**
 * SoufAI Nexus Engine — Centralized Agent Registry
 *
 * Registers, versions, discovers, matches, enables/disables, and validates dependencies
 * for all core, existing worker (11 workers), and specialized gap-filling agents.
 */

import { nexusSkillRegistry } from "./skillsRegistry";
import type {
  NexusAgentDefinition,
  NexusPermission,
} from "./types";

const BASE_EXECUTION_LIMITS = {
  maxIterations: 6,
  maxToolCalls: 25,
  maxTokensBudget: 64000,
  timeoutMs: 120000,
  maxDelegationDepth: 2,
  maxConcurrentSubtasks: 3,
  leaseDurationMs: 180000,
  leaseHeartbeatIntervalMs: 60000,
};

export const BUILTIN_NEXUS_AGENTS: NexusAgentDefinition[] = [
  // ====================================================
  // 1. META / CORE RUNTIME AGENTS
  // ====================================================
  {
    id: "orchestrator",
    workerType: "orchestrator",
    version: "2.0.0",
    name: "SoufAI Nexus Master Orchestrator",
    specialization: "Multi-Agent DAG Planning & Controlled Delegation",
    description:
      "Central planner and coordinator that decomposes goals into capability-matched DAGs, enforces budgets, checkpoints state, and supervises specialized workers.",
    supportedTaskTypes: ["full_engineering", "architecture_review", "workflow_automation", "general"],
    systemInstructions:
      "Coordinate specialized agents via capability matching and dependency waves. Respect budgets, delegation limits, fail-loud checkpointing, and verify evidence before finalizing.",
    requiredSkills: ["goal-decomposition", "idempotent-checkpoint-recovery", "model-armor-ipi-defense"],
    optionalSkills: ["structured-verification", "least-privilege-tool-audit", "multilingual-arabic-precision"],
    allowedTools: [
      "create_sandbox",
      "stop_preview",
      "get_status",
      "cleanup_sandbox",
      "create_checkpoint",
      "restore_checkpoint",
    ],
    preferredModels: ["core", "pro"],
    fallbackModels: ["spark", "ultra"],
    contextRequirements: {
      requiresSandbox: false,
      requiresProjectMemory: true,
      requiresWorkspaceFiles: true,
      minContextTokens: 32000,
    },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 10, maxToolCalls: 50, maxDelegationDepth: 3, maxConcurrentSubtasks: 4 },
    permissionBoundaries: [
      "read:workspace",
      "write:workspace",
      "sandbox:create",
      "sandbox:read",
      "sandbox:exec",
      "sandbox:delete",
      "db:read",
      "memory:read",
      "memory:write",
      "agent:delegate",
      "security:audit",
    ],
    inputSchema: {
      userPrompt: { type: "string", required: true, description: "Primary objective" },
      taskType: { type: "string", required: false },
      budgetTier: { type: "string", required: false },
    },
    outputSchema: {
      status: { type: "string", required: true },
      summary: { type: "string", required: true },
      finalResponse: { type: "string", required: true },
    },
    errorPolicy: {
      maxRetries: 2,
      backoffMs: 500,
      retryableErrorCodes: ["TRANSIENT_PROVIDER_ERROR", "SQLITE_BUSY"],
    },
    enabled: true,
    tags: ["meta", "planner", "dag", "delegation"],
  },
  {
    id: "conversational_runtime",
    workerType: "conversational",
    version: "2.0.0",
    name: "SoufAI Conversational & Omnichannel Agent",
    specialization: "Interactive Chat, ToT/Reflexion & Real Tool Execution",
    description:
      "Handles interactive web, Telegram, WhatsApp, and API conversations with classifier triage, ToT/Reflexion reasoning, memory, and real-time tools.",
    supportedTaskTypes: ["conversational", "tools", "complex", "scheduling", "research"],
    systemInstructions:
      "Operate with real tool grounding, <untrusted_tool_data> boundary isolation, strict channel permission checks, and clear bilingual/Arabic precision.",
    requiredSkills: ["evidence-based-reporting", "model-armor-ipi-defense", "multilingual-arabic-precision"],
    optionalSkills: ["ssrf-safe-web-research", "workflow-job-scheduling", "goal-decomposition"],
    allowedTools: [
      "web_search",
      "open_page",
      "coding",
      "calculator",
      "generate_image",
      "analyze_image",
      "retrieve_memory",
      "save_user_memory",
      "update_user_memory",
      "delete_user_memory",
      "get_user_profile",
      "get_current_time",
      "convert_time",
      "task_create",
      "task_list",
      "schedule_email",
      "schedule_cancel",
      "souf_file",
      "whatsapp_send",
      "whatsapp_template",
      "gmail_search",
      "gmail_read",
      "gmail_draft",
      "gmail_summarize",
      "media_player",
    ],
    preferredModels: ["core", "spark", "pro"],
    fallbackModels: ["spark", "core"],
    contextRequirements: {
      requiresSandbox: false,
      requiresProjectMemory: true,
      requiresWorkspaceFiles: false,
      minContextTokens: 16000,
    },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 10, maxToolCalls: 25 },
    permissionBoundaries: [
      "web:search",
      "web:fetch",
      "memory:read",
      "memory:write",
      "schedule:read",
      "schedule:write",
      "comms:gmail_read",
      "comms:gmail_write",
      "comms:whatsapp_send",
      "media:generate",
      "media:analyze",
      "media:control",
      "write:workspace",
      "agent:delegate",
    ],
    inputSchema: {
      prompt: { type: "string", required: true },
      channel: { type: "string", enum: ["web", "telegram", "whatsapp", "api"] },
    },
    outputSchema: {
      text: { type: "string", required: true },
      status: { type: "string", required: true },
    },
    errorPolicy: {
      maxRetries: 2,
      backoffMs: 300,
      retryableErrorCodes: ["EXEC_ERROR", "TIMEOUT", "NETWORK_ERROR"],
    },
    enabled: true,
    tags: ["chat", "omnichannel", "tools"],
  },
  {
    id: "coding_workspace",
    workerType: "coding",
    version: "2.0.0",
    name: "SoufAI In-Memory Workspace Coding Agent",
    specialization: "Interactive Workspace Project Generation & Live Preview Sync",
    description:
      "Operates directly on serialized ProjectWorkspace snapshots for /api/agent/coding and chat coding tool calls with project DB persistence.",
    supportedTaskTypes: ["coding_workspace", "coding", "ui_build"],
    systemInstructions:
      "Generate complete, non-stubbed files tailored to the workspace framework and persist safely to ProjectRepository.",
    requiredSkills: ["clean-nextjs-typescript", "evidence-based-reporting", "model-armor-ipi-defense"],
    optionalSkills: ["frontend-anti-ai-slop", "surgical-debugging"],
    allowedTools: ["coding"],
    preferredModels: ["coder", "pro"],
    fallbackModels: ["core", "spark"],
    contextRequirements: {
      requiresSandbox: false,
      requiresProjectMemory: false,
      requiresWorkspaceFiles: true,
      minContextTokens: 32000,
    },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 4, maxToolCalls: 20 },
    permissionBoundaries: ["read:workspace", "write:workspace", "db:read", "db:mutate"],
    inputSchema: {
      userPrompt: { type: "string", required: true },
      workspace: { type: "object", required: true },
    },
    outputSchema: {
      updatedWorkspace: { type: "object", required: true },
      agentResponse: { type: "string", required: true },
    },
    errorPolicy: {
      maxRetries: 1,
      backoffMs: 500,
      retryableErrorCodes: ["PROVIDER_TRANSIENT"],
    },
    enabled: true,
    tags: ["coding", "workspace"],
  },

  // ====================================================
  // 2. PRESERVED & UPGRADED 11 ENGINE WORKERS
  // ====================================================
  {
    id: "sandbox",
    workerType: "sandbox",
    version: "1.2.0",
    name: "Sandbox & Runtime Environment Worker",
    specialization: "Isolated Sandbox Lifecycle, Commands & Preview Control",
    description: "Creates, monitors, executes sanitized commands inside, and cleans up isolated project sandboxes.",
    supportedTaskTypes: ["sandbox_ops", "full_engineering"],
    systemInstructions: "Manage sandbox isolation boundaries cleanly without leaking host secrets.",
    requiredSkills: ["least-privilege-tool-audit"],
    optionalSkills: [],
    allowedTools: ["create_sandbox", "run_command", "start_preview", "stop_preview", "inspect_preview", "get_logs", "get_status", "cleanup_sandbox"],
    preferredModels: ["spark", "core"],
    fallbackModels: ["core"],
    contextRequirements: { requiresSandbox: false, requiresProjectMemory: false, requiresWorkspaceFiles: false, minContextTokens: 8192 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 3, maxToolCalls: 15 },
    permissionBoundaries: ["sandbox:create", "sandbox:read", "sandbox:exec", "sandbox:delete"],
    inputSchema: { action: { type: "string", required: true, enum: ["create", "run_command", "start_preview", "capture_screenshot", "get_status", "stop"] } },
    outputSchema: { success: { type: "boolean", required: true }, data: { type: "object" } },
    errorPolicy: { maxRetries: 1, backoffMs: 400, retryableErrorCodes: ["SANDBOX_BOOT_RETRY"] },
    enabled: true,
    tags: ["sandbox", "runtime"],
  },
  {
    id: "design",
    workerType: "design",
    version: "1.2.0",
    name: "UI/UX & Design System Worker",
    specialization: "Visual Design Tokens, Typography & Anti-AI Slop Compliance",
    description: "Synthesizes tailored color palettes, typography scales, and WCAG AA accessible layout guidance.",
    supportedTaskTypes: ["design", "full_engineering", "ui_build"],
    systemInstructions: "Generate cohesive, accessible, project-specific design tokens and RTL-ready layout guidance.",
    requiredSkills: ["frontend-anti-ai-slop", "multilingual-arabic-precision"],
    optionalSkills: ["evidence-based-reporting"],
    allowedTools: [],
    preferredModels: ["core", "pro"],
    fallbackModels: ["spark"],
    contextRequirements: { requiresSandbox: false, requiresProjectMemory: true, requiresWorkspaceFiles: false, minContextTokens: 16000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 2, maxToolCalls: 4 },
    permissionBoundaries: ["memory:read"],
    inputSchema: { projectGoal: { type: "string", required: true }, preferredTheme: { type: "string" } },
    outputSchema: { success: { type: "boolean", required: true }, theme: { type: "string" }, colorTokens: { type: "object" } },
    errorPolicy: { maxRetries: 1, backoffMs: 300, retryableErrorCodes: ["PARSE_RETRY"] },
    enabled: true,
    tags: ["design", "ui", "ux"],
  },
  {
    id: "research",
    workerType: "research",
    version: "1.2.0",
    name: "Technical Web Research Worker",
    specialization: "Official Documentation & Live Web Synthesis",
    description: "Searches live web documentation with SSRF/IPI protection and summarizes actionable technical guidance.",
    supportedTaskTypes: ["research", "full_engineering", "documentation"],
    systemInstructions: "Ground all technical guidance in real retrieved search results wrapped safely as untrusted data.",
    requiredSkills: ["ssrf-safe-web-research", "model-armor-ipi-defense", "evidence-based-reporting"],
    optionalSkills: ["multilingual-arabic-precision"],
    allowedTools: ["search_web", "web_search", "open_page"],
    preferredModels: ["core", "pro"],
    fallbackModels: ["spark"],
    contextRequirements: { requiresSandbox: false, requiresProjectMemory: false, requiresWorkspaceFiles: false, minContextTokens: 32000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 3, maxToolCalls: 10 },
    permissionBoundaries: ["web:search", "web:fetch"],
    inputSchema: { topic: { type: "string", required: true }, depth: { type: "string", enum: ["quick", "deep"] } },
    outputSchema: { success: { type: "boolean", required: true }, summary: { type: "string" }, sources: { type: "array" } },
    errorPolicy: { maxRetries: 2, backoffMs: 500, retryableErrorCodes: ["SEARCH_TRANSIENT"] },
    enabled: true,
    tags: ["research", "web", "docs"],
  },
  {
    id: "coding",
    workerType: "coding",
    version: "1.3.0",
    name: "Multi-File Software Engineering Worker",
    specialization: "Full-Stack TypeScript, React & Next.js Implementation",
    description: "Implements and modifies complete project files cleanly inside the isolated sandbox workspace.",
    supportedTaskTypes: ["coding", "full_engineering", "refactor"],
    systemInstructions: "Write complete, modular, type-safe files using workspace file tools and security checks.",
    requiredSkills: ["clean-nextjs-typescript", "evidence-based-reporting"],
    optionalSkills: ["frontend-anti-ai-slop", "turso-drizzle-sqlite", "model-armor-ipi-defense"],
    allowedTools: [
      "read_file",
      "create_file",
      "edit_file",
      "delete_file",
      "search_files",
      "search_code",
      "rename_file",
      "move_file",
      "create_checkpoint",
      "search_web",
      "install_dependency",
    ],
    preferredModels: ["coder", "pro"],
    fallbackModels: ["core", "ultra"],
    contextRequirements: { requiresSandbox: true, requiresProjectMemory: true, requiresWorkspaceFiles: true, minContextTokens: 64000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 5, maxToolCalls: 30 },
    permissionBoundaries: ["read:workspace", "write:workspace", "sandbox:exec", "web:search", "agent:delegate"],
    inputSchema: { taskGoal: { type: "string", required: true }, framework: { type: "string" } },
    outputSchema: { success: { type: "boolean", required: true }, filesCreated: { type: "array" }, filesModified: { type: "array" } },
    errorPolicy: { maxRetries: 2, backoffMs: 500, retryableErrorCodes: ["PARSE_RETRY", "FILE_WRITE_RETRY"], fallbackAgentId: "debug" },
    dependencies: ["sandbox"],
    enabled: true,
    tags: ["coding", "engineering", "typescript"],
  },
  {
    id: "file",
    workerType: "file",
    version: "1.1.0",
    name: "Workspace File Operations Worker",
    specialization: "Atomic File Inspection, Search & Containment",
    description: "Performs safe path-contained read, write, rename, move, search, and code-search operations in the sandbox.",
    supportedTaskTypes: ["file_ops", "coding", "refactor"],
    systemInstructions: "Operate atomically on workspace files while enforcing path traversal containment.",
    requiredSkills: ["least-privilege-tool-audit"],
    optionalSkills: ["evidence-based-reporting"],
    allowedTools: ["read_file", "create_file", "edit_file", "delete_file", "search_files", "search_code", "rename_file", "move_file"],
    preferredModels: ["spark", "core"],
    fallbackModels: ["core"],
    contextRequirements: { requiresSandbox: true, requiresProjectMemory: false, requiresWorkspaceFiles: true, minContextTokens: 16000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 3, maxToolCalls: 25 },
    permissionBoundaries: ["read:workspace", "write:workspace", "delete:workspace"],
    inputSchema: { action: { type: "string", required: true }, filePath: { type: "string" } },
    outputSchema: { success: { type: "boolean", required: true }, data: { type: "object" } },
    errorPolicy: { maxRetries: 1, backoffMs: 200, retryableErrorCodes: ["IO_TRANSIENT"] },
    dependencies: ["sandbox"],
    enabled: true,
    tags: ["files", "workspace"],
  },
  {
    id: "dependency",
    workerType: "dependency",
    version: "1.1.0",
    name: "Package & Dependency Verification Worker",
    specialization: "Safe Dependency Auditing & Installation",
    description: "Validates package safety against blocklists and installs vetted dependencies cleanly inside the sandbox.",
    supportedTaskTypes: ["dependency_management", "full_engineering", "coding"],
    systemInstructions: "Verify package safety and lockfile compatibility before executing sandbox package installs.",
    requiredSkills: ["least-privilege-tool-audit"],
    optionalSkills: ["evidence-based-reporting"],
    allowedTools: ["install_dependency", "read_file", "run_command"],
    preferredModels: ["spark", "core"],
    fallbackModels: ["core"],
    contextRequirements: { requiresSandbox: true, requiresProjectMemory: false, requiresWorkspaceFiles: true, minContextTokens: 16000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 2, maxToolCalls: 15, timeoutMs: 180000 },
    permissionBoundaries: ["read:workspace", "sandbox:exec"],
    inputSchema: { action: { type: "string", required: true }, packages: { type: "array" } },
    outputSchema: { success: { type: "boolean", required: true }, installed: { type: "array" }, failed: { type: "array" } },
    errorPolicy: { maxRetries: 1, backoffMs: 1000, retryableErrorCodes: ["NPM_TRANSIENT"] },
    dependencies: ["sandbox"],
    enabled: true,
    tags: ["dependencies", "npm"],
  },
  {
    id: "testing",
    workerType: "testing",
    version: "1.2.0",
    name: "Build, Test & Quality Telemetry Worker",
    specialization: "Automated Build, Typecheck & Preview Health Validation",
    description: "Executes sandbox builds, tests, and preview server checks to compute an objective QualityReport.",
    supportedTaskTypes: ["testing", "full_engineering", "verification"],
    systemInstructions: "Report actual build, test, and preview command outcomes without fabricating passes.",
    requiredSkills: ["structured-verification", "evidence-based-reporting"],
    optionalSkills: ["surgical-debugging"],
    allowedTools: ["run_build", "run_tests", "start_preview", "inspect_preview", "get_logs", "inspect_errors", "read_file"],
    preferredModels: ["core", "coder"],
    fallbackModels: ["spark"],
    contextRequirements: { requiresSandbox: true, requiresProjectMemory: false, requiresWorkspaceFiles: true, minContextTokens: 32000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 3, maxToolCalls: 15, timeoutMs: 180000 },
    permissionBoundaries: ["read:workspace", "sandbox:read", "sandbox:exec", "agent:delegate"],
    inputSchema: { testCommand: { type: "string" } },
    outputSchema: { success: { type: "boolean", required: true }, qualityReport: { type: "object", required: true } },
    errorPolicy: { maxRetries: 1, backoffMs: 500, retryableErrorCodes: ["BUILD_RETRY"], fallbackAgentId: "debug" },
    dependencies: ["sandbox"],
    enabled: true,
    tags: ["testing", "build", "qa"],
  },
  {
    id: "debug",
    workerType: "debug",
    version: "1.2.0",
    name: "Root-Cause Debug & Self-Healing Worker",
    specialization: "Build/Runtime Failure Diagnosis & Minimal Code Repair",
    description: "Inspects build/runtime error logs, locates failing symbols, and applies minimal surgical fixes.",
    supportedTaskTypes: ["debugging", "full_engineering", "coding"],
    systemInstructions: "Diagnose root cause strictly from real logs and files, then apply minimal surgical patches.",
    requiredSkills: ["surgical-debugging", "evidence-based-reporting"],
    optionalSkills: ["clean-nextjs-typescript"],
    allowedTools: ["read_file", "search_files", "edit_file", "search_code", "inspect_errors", "get_logs", "run_build", "restore_checkpoint"],
    preferredModels: ["coder", "pro"],
    fallbackModels: ["core", "ultra"],
    contextRequirements: { requiresSandbox: true, requiresProjectMemory: false, requiresWorkspaceFiles: true, minContextTokens: 64000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 4, maxToolCalls: 20 },
    permissionBoundaries: ["read:workspace", "write:workspace", "sandbox:read", "sandbox:exec"],
    inputSchema: { errorLog: { type: "string", required: true } },
    outputSchema: { success: { type: "boolean", required: true }, fixedFiles: { type: "array" }, diagnosis: { type: "string" } },
    errorPolicy: { maxRetries: 2, backoffMs: 400, retryableErrorCodes: ["DEBUG_RETRY"] },
    dependencies: ["sandbox"],
    enabled: true,
    tags: ["debug", "recovery"],
  },
  {
    id: "vision",
    workerType: "vision",
    version: "1.1.0",
    name: "Visual QA & UI Inspection Worker",
    specialization: "Rendered Layout, Contrast & Responsiveness Evaluation",
    description: "Inspects preview surface readiness and evaluates layout, spacing, typography, WCAG AA contrast, and responsiveness.",
    supportedTaskTypes: ["vision_qa", "full_engineering", "design"],
    systemInstructions: "Evaluate rendered UI quality objectively against WCAG AA and responsive layout criteria.",
    requiredSkills: ["frontend-anti-ai-slop", "evidence-based-reporting"],
    optionalSkills: [],
    allowedTools: ["capture_screenshot", "inspect_preview", "start_preview"],
    preferredModels: ["vision", "core"],
    fallbackModels: ["pro"],
    contextRequirements: { requiresSandbox: true, requiresProjectMemory: false, requiresWorkspaceFiles: false, minContextTokens: 16000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 2, maxToolCalls: 8 },
    permissionBoundaries: ["sandbox:read", "sandbox:exec"],
    inputSchema: {},
    outputSchema: { success: { type: "boolean", required: true }, evaluation: { type: "object", required: true } },
    errorPolicy: { maxRetries: 1, backoffMs: 300, retryableErrorCodes: ["PREVIEW_RETRY"] },
    dependencies: ["sandbox"],
    enabled: true,
    tags: ["vision", "qa", "ui"],
  },
  {
    id: "security",
    workerType: "security",
    version: "1.2.0",
    name: "Security & Guardrail Audit Worker",
    specialization: "Command Safety, Secret Leak Detection, Path & SSRF Auditing",
    description: "Audits commands, file paths, generated code, and URLs against dangerous shell patterns, traversal, and secret exposure.",
    supportedTaskTypes: ["security_audit", "full_engineering", "coding", "database_design"],
    systemInstructions: "Flag any dangerous shell command, path traversal, SSRF risk, or exposed secret pattern immediately.",
    requiredSkills: ["least-privilege-tool-audit", "model-armor-ipi-defense"],
    optionalSkills: ["evidence-based-reporting"],
    allowedTools: ["read_file", "search_code", "search_files"],
    preferredModels: ["pro", "core"],
    fallbackModels: ["spark"],
    contextRequirements: { requiresSandbox: false, requiresProjectMemory: false, requiresWorkspaceFiles: true, minContextTokens: 32000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 3, maxToolCalls: 15 },
    permissionBoundaries: ["read:workspace", "security:audit"],
    inputSchema: { command: { type: "string" }, filePath: { type: "string" }, codeContent: { type: "string" } },
    outputSchema: { isSafe: { type: "boolean", required: true }, violations: { type: "array", required: true } },
    errorPolicy: { maxRetries: 0, backoffMs: 0, retryableErrorCodes: [] },
    enabled: true,
    tags: ["security", "audit", "waf"],
  },
  {
    id: "verification",
    workerType: "verification",
    version: "1.2.0",
    name: "Final Pre-Delivery Verification Worker",
    specialization: "Strict Deliverable Checklist & Completeness Gate",
    description: "Runs final objective verification across sandbox status, generated files, and preview reachability before task completion.",
    supportedTaskTypes: ["verification", "full_engineering"],
    systemInstructions: "Apply strict pre-delivery checks and record unresolved issues honestly without masking failures.",
    requiredSkills: ["structured-verification", "evidence-based-reporting"],
    optionalSkills: [],
    allowedTools: ["read_file", "search_files", "inspect_preview", "run_build", "run_tests"],
    preferredModels: ["core", "pro"],
    fallbackModels: ["spark"],
    contextRequirements: { requiresSandbox: true, requiresProjectMemory: false, requiresWorkspaceFiles: true, minContextTokens: 16000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 2, maxToolCalls: 10 },
    permissionBoundaries: ["read:workspace", "sandbox:read", "sandbox:exec"],
    inputSchema: { taskGoal: { type: "string", required: true }, qualityThreshold: { type: "number" } },
    outputSchema: { isVerified: { type: "boolean", required: true }, score: { type: "number", required: true } },
    errorPolicy: { maxRetries: 1, backoffMs: 250, retryableErrorCodes: [] },
    dependencies: ["sandbox"],
    enabled: true,
    tags: ["verification", "qa"],
  },

  // ====================================================
  // 3. NEW GENUINE-GAP SPECIALIZED AGENTS (4)
  // ====================================================
  {
    id: "architecture_analyst",
    workerType: "architecture_analyst",
    version: "1.0.0",
    name: "Architecture & Codebase Impact Analyst",
    specialization: "System Topology, Module Boundaries & Regression Impact",
    description:
      "Analyzes codebase structure, identifies integration seams, detects architectural duplication, and generates implementation blueprints before coding starts.",
    supportedTaskTypes: ["architecture_review", "full_engineering", "refactor"],
    systemInstructions:
      "Analyze real workspace files and module dependencies to produce concrete interface blueprints, boundary definitions, and risk assessments.",
    requiredSkills: ["architecture-impact-analysis", "goal-decomposition", "evidence-based-reporting"],
    optionalSkills: ["clean-nextjs-typescript", "turso-drizzle-sqlite"],
    allowedTools: ["search_files", "search_code", "read_file"],
    preferredModels: ["pro", "ultra"],
    fallbackModels: ["core"],
    contextRequirements: { requiresSandbox: false, requiresProjectMemory: true, requiresWorkspaceFiles: true, minContextTokens: 64000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 4, maxToolCalls: 20 },
    permissionBoundaries: ["read:workspace", "memory:read"],
    inputSchema: { taskGoal: { type: "string", required: true }, targetPaths: { type: "array" } },
    outputSchema: { success: { type: "boolean", required: true }, blueprint: { type: "object" }, impactedModules: { type: "array" } },
    errorPolicy: { maxRetries: 1, backoffMs: 300, retryableErrorCodes: ["PROVIDER_TRANSIENT"] },
    enabled: true,
    tags: ["architecture", "analysis", "blueprint"],
  },
  {
    id: "database_engineer",
    workerType: "database_engineer",
    version: "1.0.0",
    name: "Database & Turso Persistence Specialist",
    specialization: "Turso / libSQL, Drizzle SQLite Schemas, Indexes & Transactions",
    description:
      "Designs and audits SQLite/Turso Drizzle schemas, additive idempotent migrations, transactions, and query optimization without running destructive production commands.",
    supportedTaskTypes: ["database_design", "architecture_review", "full_engineering"],
    systemInstructions:
      "Design Turso/libSQL Drizzle schemas with proper sqlite-core types, foreign keys, indexes, and atomic transactions. Never emit PostgreSQL-only syntax or destructive DDL.",
    requiredSkills: ["turso-drizzle-sqlite", "idempotent-checkpoint-recovery", "evidence-based-reporting"],
    optionalSkills: ["least-privilege-tool-audit"],
    allowedTools: ["read_file", "search_code", "search_files", "create_file", "edit_file"],
    preferredModels: ["pro", "coder"],
    fallbackModels: ["core"],
    contextRequirements: { requiresSandbox: false, requiresProjectMemory: true, requiresWorkspaceFiles: true, minContextTokens: 32000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 3, maxToolCalls: 15 },
    permissionBoundaries: ["read:workspace", "write:workspace", "db:read"],
    inputSchema: { taskGoal: { type: "string", required: true }, schemaNotes: { type: "string" } },
    outputSchema: { success: { type: "boolean", required: true }, schemaDesign: { type: "object" }, recommendations: { type: "array" } },
    errorPolicy: { maxRetries: 1, backoffMs: 300, retryableErrorCodes: ["PROVIDER_TRANSIENT"] },
    enabled: true,
    tags: ["database", "turso", "drizzle", "sqlite"],
  },
  {
    id: "workflow_automation",
    workerType: "workflow_automation",
    version: "1.0.0",
    name: "Workflow & Scheduled Automation Specialist",
    specialization: "Durable Worker Queue Jobs & Scheduled Task Orchestration",
    description:
      "Orchestrates user-scoped scheduled reminders/tasks and durable background WorkerQueue jobs safely via ScheduledTaskRepository and WorkerJobRepository.",
    supportedTaskTypes: ["workflow_automation", "scheduling"],
    systemInstructions:
      "Validate schedule timestamps, user ownership, and idempotency keys before persisting scheduled tasks or queuing background jobs.",
    requiredSkills: ["workflow-job-scheduling", "idempotent-checkpoint-recovery", "evidence-based-reporting"],
    optionalSkills: ["multilingual-arabic-precision"],
    allowedTools: ["task_create", "task_list", "schedule_email", "schedule_cancel", "get_current_time", "convert_time", "enqueue_worker_job"],
    preferredModels: ["core", "spark"],
    fallbackModels: ["spark"],
    contextRequirements: { requiresSandbox: false, requiresProjectMemory: true, requiresWorkspaceFiles: false, minContextTokens: 16000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 3, maxToolCalls: 12 },
    permissionBoundaries: ["schedule:read", "schedule:write", "queue:enqueue", "memory:read"],
    inputSchema: { taskGoal: { type: "string", required: true }, action: { type: "string" } },
    outputSchema: { success: { type: "boolean", required: true }, scheduledItems: { type: "array" }, summary: { type: "string" } },
    errorPolicy: { maxRetries: 1, backoffMs: 300, retryableErrorCodes: ["SQLITE_BUSY"] },
    enabled: true,
    tags: ["workflow", "scheduler", "queue", "automation"],
  },
  {
    id: "documentation_engineer",
    workerType: "documentation_engineer",
    version: "1.0.0",
    name: "Documentation & API Verification Engineer",
    specialization: "Code-Grounded Technical Documentation & API Contract Verification",
    description:
      "Generates technical documentation, API references, and architectural summaries grounded in verified workspace files and real runtime evidence.",
    supportedTaskTypes: ["documentation", "architecture_review", "full_engineering"],
    systemInstructions:
      "Inspect actual files/routes before writing documentation; explicitly separate verified implementation details from unexecuted runtime checks.",
    requiredSkills: ["verified-technical-docs", "evidence-based-reporting", "multilingual-arabic-precision"],
    optionalSkills: ["structured-verification"],
    allowedTools: ["read_file", "search_files", "search_code", "create_file", "edit_file", "souf_file"],
    preferredModels: ["writer", "pro", "core"],
    fallbackModels: ["core", "spark"],
    contextRequirements: { requiresSandbox: false, requiresProjectMemory: true, requiresWorkspaceFiles: true, minContextTokens: 32000 },
    executionLimits: { ...BASE_EXECUTION_LIMITS, maxIterations: 3, maxToolCalls: 15 },
    permissionBoundaries: ["read:workspace", "write:workspace"],
    inputSchema: { taskGoal: { type: "string", required: true }, targetFiles: { type: "array" } },
    outputSchema: { success: { type: "boolean", required: true }, documentContent: { type: "string" }, verifiedFiles: { type: "array" } },
    errorPolicy: { maxRetries: 1, backoffMs: 300, retryableErrorCodes: ["PROVIDER_TRANSIENT"] },
    enabled: true,
    tags: ["documentation", "openapi", "verification"],
  },
];

export class NexusAgentRegistry {
  private agents: Map<string, NexusAgentDefinition> = new Map();
  private versionHistory: Map<string, NexusAgentDefinition[]> = new Map();

  constructor(initialAgents: NexusAgentDefinition[] = BUILTIN_NEXUS_AGENTS) {
    for (const agent of initialAgents) {
      this.registerAgent(agent);
    }
  }

  public registerAgent(definition: NexusAgentDefinition): void {
    if (this.agents.has(definition.id)) {
      throw new Error(`NexusAgentRegistry: Agent ID '${definition.id}' is already registered.`);
    }
    this.validateDefinition(definition);

    const cloned: NexusAgentDefinition = {
      ...definition,
      supportedTaskTypes: [...(definition.supportedTaskTypes || [])],
      requiredSkills: [...(definition.requiredSkills || [])],
      optionalSkills: [...(definition.optionalSkills || [])],
      allowedTools: [...(definition.allowedTools || [])],
      preferredModels: [...(definition.preferredModels || [])],
      fallbackModels: [...(definition.fallbackModels || [])],
      permissionBoundaries: [...(definition.permissionBoundaries || [])],
      tags: [...(definition.tags || [])],
      updatedAt: new Date().toISOString(),
      createdAt: definition.createdAt || new Date().toISOString(),
    };

    this.storeAgentVersion(cloned);
  }

  private validateDefinition(definition: NexusAgentDefinition): void {
    if (
      !definition.id?.trim() ||
      !definition.version?.trim() ||
      !definition.workerType ||
      !definition.name?.trim() ||
      !definition.description?.trim() ||
      !definition.specialization?.trim() ||
      !definition.systemInstructions?.trim()
    ) {
      throw new Error(
        "NexusAgentRegistry: id, version, workerType, name, description, specialization, and systemInstructions are required."
      );
    }

    const positiveLimits = [
      definition.executionLimits?.maxIterations,
      definition.executionLimits?.maxToolCalls,
      definition.executionLimits?.maxTokensBudget,
      definition.executionLimits?.timeoutMs,
      definition.executionLimits?.maxConcurrentSubtasks,
    ];
    if (
      positiveLimits.some((value) => !Number.isFinite(value) || value <= 0) ||
      !Number.isFinite(definition.executionLimits?.maxDelegationDepth) ||
      definition.executionLimits.maxDelegationDepth < 0 ||
      !Number.isFinite(definition.contextRequirements?.minContextTokens) ||
      definition.contextRequirements.minContextTokens <= 0
    ) {
      throw new Error(`NexusAgentRegistry: Agent '${definition.id}' has invalid execution limits.`);
    }

    if (!definition.inputSchema || !definition.outputSchema || !definition.errorPolicy) {
      throw new Error(`NexusAgentRegistry: Agent '${definition.id}' is missing contract metadata.`);
    }
  }

  private storeAgentVersion(cloned: NexusAgentDefinition): void {
    this.agents.set(cloned.id, cloned);
    const history = this.versionHistory.get(cloned.id) || [];
    history.push(cloned);
    this.versionHistory.set(cloned.id, history);
  }

  public updateAgent(
    agentId: string,
    updates: Partial<Omit<NexusAgentDefinition, "id" | "workerType">> & { version: string }
  ): NexusAgentDefinition {
    const current = this.agents.get(agentId);
    if (!current) {
      throw new Error(`NexusAgentRegistry: Agent '${agentId}' not found.`);
    }
    if (!updates.version || updates.version === current.version) {
      throw new Error(
        `NexusAgentRegistry: Controlled update for '${agentId}' requires a new version string.`
      );
    }

    const merged: NexusAgentDefinition = {
      ...current,
      ...updates,
      id: current.id,
      workerType: current.workerType,
      updatedAt: new Date().toISOString(),
    };

    this.validateDefinition(merged);
    this.storeAgentVersion(merged);
    return merged;
  }

  public setAgentEnabled(agentId: string, enabled: boolean): boolean {
    const existing = this.agents.get(agentId);
    if (!existing) return false;
    existing.enabled = enabled;
    existing.updatedAt = new Date().toISOString();
    return true;
  }

  public getAgent(agentId: string): NexusAgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  public getAgentByWorkerType(workerType: string): NexusAgentDefinition | undefined {
    const direct = this.agents.get(workerType);
    if (direct) return direct;
    return Array.from(this.agents.values()).find((a) => a.workerType === workerType);
  }

  public getAgentHistory(agentId: string): NexusAgentDefinition[] {
    return [...(this.versionHistory.get(agentId) || [])];
  }

  public listAgents(filter?: {
    enabledOnly?: boolean;
    taskType?: string;
    tag?: string;
  }): NexusAgentDefinition[] {
    let list = Array.from(this.agents.values());
    if (filter?.enabledOnly) {
      list = list.filter((a) => a.enabled);
    }
    if (filter?.taskType) {
      list = list.filter((a) => a.supportedTaskTypes.includes(filter.taskType!));
    }
    if (filter?.tag) {
      list = list.filter((a) => a.tags.includes(filter.tag!));
    }
    return list;
  }

  public matchAgentsForTask(params: {
    goal: string;
    taskType?: string;
    requiredPermissions?: NexusPermission[];
    requireSandboxFree?: boolean;
  }): Array<{ agent: NexusAgentDefinition; score: number; matchedReasons: string[] }> {
    const lower = (params.goal || "").toLowerCase();
    const results: Array<{ agent: NexusAgentDefinition; score: number; matchedReasons: string[] }> = [];

    for (const agent of this.agents.values()) {
      if (!agent.enabled) continue;
      if (params.requireSandboxFree && agent.contextRequirements.requiresSandbox) continue;

      if (params.requiredPermissions && params.requiredPermissions.length > 0) {
        const permSet = new Set(agent.permissionBoundaries);
        const hasAll = params.requiredPermissions.every((p) => permSet.has(p));
        if (!hasAll) continue;
      }

      let score = 0;
      const reasons: string[] = [];

      if (params.taskType && agent.supportedTaskTypes.includes(params.taskType)) {
        score += 40;
        reasons.push(`taskType:${params.taskType}`);
      }

      for (const tag of agent.tags) {
        if (lower.includes(tag.toLowerCase())) {
          score += 18;
          reasons.push(`tag:${tag}`);
        }
      }

      const specTokens = agent.specialization.toLowerCase().split(/[\s,/]+/);
      for (const tok of specTokens) {
        if (tok.length > 3 && lower.includes(tok)) {
          score += 10;
          reasons.push(`spec:${tok}`);
        }
      }

      if (score > 0 || !params.taskType) {
        results.push({ agent, score, matchedReasons: reasons });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  public validateDependencies(agentId?: string): {
    valid: boolean;
    issues: Array<{ agentId: string; type: string; detail: string }>;
  } {
    const issues: Array<{ agentId: string; type: string; detail: string }> = [];
    const targets = agentId
      ? ([this.agents.get(agentId)].filter(Boolean) as NexusAgentDefinition[])
      : Array.from(this.agents.values());

    for (const agent of targets) {
      // 1. Validate required skills exist and are enabled
      for (const skillId of agent.requiredSkills) {
        const skill = nexusSkillRegistry.getSkill(skillId);
        if (!skill) {
          issues.push({
            agentId: agent.id,
            type: "missing_skill",
            detail: `Required skill '${skillId}' is not registered.`,
          });
        } else if (!skill.enabled) {
          issues.push({
            agentId: agent.id,
            type: "disabled_skill",
            detail: `Required skill '${skillId}' is disabled.`,
          });
        } else {
          const permSet = new Set(agent.permissionBoundaries);
          const missingPerms = skill.requiredPermissions.filter((p) => !permSet.has(p));
          if (missingPerms.length > 0) {
            issues.push({
              agentId: agent.id,
              type: "skill_permission_mismatch",
              detail: `Skill '${skillId}' requires permissions [${missingPerms.join(", ")}] outside agent boundaries.`,
            });
          }
        }
      }

      // 2. Validate agent dependencies and detect cycles
      const visited = new Set<string>();
      const stack = new Set<string>();
      const checkAgentDeps = (currId: string) => {
        if (stack.has(currId)) {
          issues.push({
            agentId: agent.id,
            type: "circular_agent_dependency",
            detail: `Circular agent dependency involving '${currId}'.`,
          });
          return;
        }
        if (visited.has(currId)) return;
        stack.add(currId);
        const curr = this.agents.get(currId);
        if (curr?.dependencies) {
          for (const depId of curr.dependencies) {
            const depAgent = this.agents.get(depId);
            if (!depAgent) {
              issues.push({
                agentId: agent.id,
                type: "missing_agent_dependency",
                detail: `Dependency agent '${depId}' is not registered.`,
              });
            } else if (!depAgent.enabled) {
              issues.push({
                agentId: agent.id,
                type: "disabled_agent_dependency",
                detail: `Dependency agent '${depId}' is disabled.`,
              });
            } else {
              checkAgentDeps(depId);
            }
          }
        }
        stack.delete(currId);
        visited.add(currId);
      };

      checkAgentDeps(agent.id);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}

export const nexusAgentRegistry = new NexusAgentRegistry();
