/**
 * SoufAI Nexus Engine — Canonical Type Contracts
 *
 * Defines unified multi-agent orchestration types covering:
 * - Centralized Agent Registry definitions & lifecycle
 * - Reusable, lazy-loaded Skills framework
 * - Intelligent Model Routing criteria & decisions
 * - Security, permission boundaries & approval gates
 * - Dynamic DAG execution plans, controlled delegation & budgets
 * - Fail-loud Turso checkpoints & idempotent recovery envelopes
 * - Independent evaluation traces & completion evidence
 */

import type {
  AgentEngineRunOptions,
  AgentEngineRunResult,
  AgentWorkerType,
  BudgetTier,
  EngineExecutionContext,
  QualityReport,
  RealAgentEvent,
  TaskStatus,
  ToolRiskLevel,
  VisionEvaluation,
} from "../engine/types";
import type { AgentTaskLease } from "@/lib/db";

export type NexusModelTier =
  | "spark"
  | "core"
  | "pro"
  | "coder"
  | "ultra"
  | "vision"
  | "writer"
  | "lite_free";

export type NexusChannel = "web" | "telegram" | "whatsapp" | "api";

export type NexusPermission =
  | "read:workspace"
  | "write:workspace"
  | "delete:workspace"
  | "sandbox:create"
  | "sandbox:read"
  | "sandbox:exec"
  | "sandbox:delete"
  | "web:search"
  | "web:fetch"
  | "db:read"
  | "db:mutate"
  | "memory:read"
  | "memory:write"
  | "schedule:read"
  | "schedule:write"
  | "queue:enqueue"
  | "comms:gmail_read"
  | "comms:gmail_write"
  | "comms:whatsapp_send"
  | "media:generate"
  | "media:analyze"
  | "media:control"
  | "agent:delegate"
  | "security:audit"
  | "secrets:access";

export type NexusTaskComplexity = "trivial" | "low" | "medium" | "high" | "frontier";

export interface NexusExecutionLimits {
  maxIterations: number;
  maxToolCalls: number;
  maxTokensBudget: number;
  timeoutMs: number;
  maxDelegationDepth: number;
  maxConcurrentSubtasks: number;
  leaseDurationMs: number;
  leaseHeartbeatIntervalMs: number;
}

export interface NexusRetryPolicy {
  maxRetries: number;
  backoffMs: number;
  retryableErrorCodes: string[];
  fallbackAgentId?: string;
}

export interface NexusSchemaField {
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  description?: string;
  enum?: string[];
}

export interface NexusAgentDefinition {
  id: string;
  workerType: AgentWorkerType;
  version: string;
  name: string;
  specialization: string;
  description: string;
  supportedTaskTypes: string[];
  systemInstructions: string;
  requiredSkills: string[];
  optionalSkills: string[];
  allowedTools: string[];
  preferredModels: NexusModelTier[];
  fallbackModels: NexusModelTier[];
  contextRequirements: {
    requiresSandbox: boolean;
    requiresProjectMemory: boolean;
    requiresWorkspaceFiles: boolean;
    minContextTokens: number;
  };
  executionLimits: NexusExecutionLimits;
  permissionBoundaries: NexusPermission[];
  inputSchema: Record<string, NexusSchemaField>;
  outputSchema: Record<string, NexusSchemaField>;
  errorPolicy: NexusRetryPolicy;
  dependencies?: string[];
  enabled: boolean;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type NexusSkillCategory =
  | "core_reasoning"
  | "engineering"
  | "architecture"
  | "database"
  | "security"
  | "research"
  | "design_ui"
  | "automation"
  | "documentation";

export interface NexusSkillDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  category: NexusSkillCategory;
  triggerKeywords: string[];
  supportedTaskTypes: string[];
  compatibleAgents: string[];
  dependencies: Array<{ skillId: string; versionConstraint?: string }>;
  requiredPermissions: NexusPermission[];
  instructionBody: string;
  estimatedTokenCost: number;
  priority: number;
  composeWith?: string[];
  enabled: boolean;
}

export interface NexusComposedSkillContext {
  activeSkillIds: string[];
  resolvedOrder: string[];
  rejectedSkills: Array<{ skillId: string; reason: string }>;
  totalEstimatedTokens: number;
  tokensSavedVsFullCatalog: number;
  mergedInstructions: string;
  activations: Array<{
    skillId: string;
    version: string;
    relevanceScore: number;
    reason: string;
    estimatedTokens: number;
  }>;
}

export interface NexusModelRoutingCriteria {
  taskComplexity: NexusTaskComplexity;
  requiresReasoning: boolean;
  requiresCoding: boolean;
  requiresVision: boolean;
  requiresStructuredOutput: boolean;
  requiresToolCalling?: boolean;
  minContextTokens: number;
  latencyPreference: "instant" | "balanced" | "deliberate";
  costSensitivity: "ultra_low" | "standard" | "unrestricted";
  preferredTiers?: NexusModelTier[];
  fallbackTiers?: NexusModelTier[];
}

export interface NexusModelSelectionDecision {
  selectedTier: NexusModelTier;
  selectedModel: string;
  selectedProvider: string;
  reason: string;
  candidatesEvaluated: Array<{
    tier: string;
    providerId: string;
    model: string;
    score: number;
    available: boolean;
    reason: string;
  }>;
  fallbackChain: NexusModelTier[];
  fallbackCandidates?: Array<{
    tier: NexusModelTier;
    providerId: string;
    model: string;
  }>;
  adminEnforced: boolean;
}

export interface NexusExecutionBudget {
  maxTotalSteps: number;
  maxDelegationDepth: number;
  maxActiveAgents: number;
  maxConcurrentTasks: number;
  maxTokensBudget: number;
  maxToolCalls: number;
  maxRetriesPerStep: number;
  stepTimeoutMs: number;
  taskTimeoutMs: number;
  leaseDurationMs: number;
  leaseHeartbeatIntervalMs: number;
}

export interface NexusSecurityPolicy {
  channel: NexusChannel;
  userId: string;
  grantedPermissions: NexusPermission[];
  requireApprovalForRiskLevels: ToolRiskLevel[];
  blockDangerousShellPatterns: boolean;
  enforceSsrfGuard: boolean;
  enforcePathContainment: boolean;
  wrapUntrustedToolOutputs: boolean;
  redactSecretsInOutput: boolean;
  approvalHandler?: (req: {
    taskId: string;
    agentId: string;
    toolName: string;
    riskLevel: ToolRiskLevel;
    reason: string;
    argsSummary: string;
    signal?: AbortSignal;
  }) => Promise<boolean>;
}

export interface NexusToolAuthorizationResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  riskLevel: ToolRiskLevel;
  missingPermissions: NexusPermission[];
}

export interface NexusPlanNode {
  id: string;
  title: string;
  description: string;
  required?: boolean;
  assignedAgentId: string;
  workerType: AgentWorkerType;
  dependencies: string[];
  parallelGroup: number;
  requiredSkills: string[];
  routingCriteria: NexusModelRoutingCriteria;
  inputArgs: Record<string, any>;
  idempotencyKey: string;
  maxRetries: number;
  timeoutMs: number;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  outputResult?: Record<string, any>;
  error?: string | null;
  durationMs?: number;
}

export interface NexusExecutionPlan {
  planId: string;
  goal: string;
  taskCategory: string;
  completionCriteria: string[];
  requiredCapabilities: string[];
  selectedSkills: string[];
  framework: string;
  themeArchetype: string;
  needsSandbox: boolean;
  nodes: NexusPlanNode[];
  estimatedBudget: Partial<NexusExecutionBudget>;
  createdAt: string;
}

export interface NexusDelegationRequest {
  taskId: string;
  parentAgentId: string;
  targetAgentId: string;
  reason: string;
  depth: number;
  callStack: string[];
  input: Record<string, any>;
  parentPermissions: NexusPermission[];
}

export interface NexusDelegationRecord {
  id: string;
  taskId: string;
  subtaskId?: string;
  required?: boolean;
  parentAgentId: string;
  targetAgentId: string;
  depth: number;
  reason: string;
  status: "pending" | "running" | "completed" | "failed" | "blocked";
  inputSummary?: string;
  outputSummary?: string;
  blockedReason?: string;
  durationMs: number;
  createdAt: string;
}

export interface NexusCheckpointEnvelope {
  version: "nexus_cp_v1";
  taskId: string;
  stepNumber: number;
  stepName: string;
  completedOperationKeys: string[];
  plan?: NexusExecutionPlan;
  sharedContext: Record<string, any>;
  delegations: NexusDelegationRecord[];
  activeAgents: string[];
  skillsUsed: string[];
  filesChanged: string[];
  sandboxId?: string;
  qualityReport?: QualityReport;
  visionEvaluation?: VisionEvaluation;
  savedAt: string;
}

export interface NexusCheckpointSaveResult {
  persisted: boolean;
  checkpointId?: string;
  stepNumber: number;
  error?: string;
}

export interface NexusStepEvidence {
  stepId: string;
  agentId: string;
  agentVersion: string;
  status: "completed" | "failed" | "skipped";
  durationMs: number;
  modelUsed?: string;
  providerUsed?: string;
  skillsLoaded: string[];
  toolsExecuted: Array<{
    tool: string;
    success: boolean;
    durationMs: number;
    error?: string;
  }>;
  artifactsProduced: string[];
  verificationPassed?: boolean;
  error?: string;
}

export interface NexusEvaluationTrace {
  traceId: string;
  taskId: string;
  userId: string;
  engineMode: "nexus_orchestrator" | "nexus_conversational" | "nexus_coding";
  goal: string;
  status: TaskStatus | "waiting_for_user";
  stepsEvidence: NexusStepEvidence[];
  delegations: NexusDelegationRecord[];
  skillsActivated: Array<{ skillId: string; version: string; agentId: string; tokens: number }>;
  modelsUsed: Array<{ agentId: string; tier: string; model: string; provider: string; reason: string }>;
  completedOperationKeys: string[];
  lastCheckpointId?: string;
  checkpointPersisted: boolean;
  totalDurationMs: number;
  estimatedCostUsd: number;
  configSnapshot: {
    engineVersion: string;
    budget: NexusExecutionBudget;
    channel: NexusChannel;
  };
  errors: Array<{ stepId?: string; agentId?: string; code: string; message: string }>;
  createdAt: string;
}

export interface NexusExecutionContext extends EngineExecutionContext {
  lease: AgentTaskLease;
  engineMode: "nexus_orchestrator" | "nexus_conversational" | "nexus_coding";
  agentId: string;
  workerTypeCompat?: AgentWorkerType;
  channel: NexusChannel;
  delegationDepth: number;
  callStack: string[];
  effectivePermissions: NexusPermission[];
  budget: NexusExecutionBudget;
  securityPolicy: NexusSecurityPolicy;
  sharedContext: Record<string, any>;
  completedOperationKeys: Set<string>;
  delegateToAgent: (
    targetAgentId: string,
    reason: string,
    input: Record<string, any>
  ) => Promise<{
    success: boolean;
    output?: Record<string, any>;
    error?: string;
    blockedReason?: string;
  }>;
  invokeTool: (
    toolName: string,
    args: Record<string, any>,
    options?: { idempotencyKey?: string; timeoutMs?: number }
  ) => Promise<{
    success: boolean;
    data?: any;
    error?: string;
    contextNote?: string;
    sources?: any[];
    widgetData?: any;
  }>;
}

export interface NexusRunRequest extends AgentEngineRunOptions {
  channel?: NexusChannel;
  budget?: Partial<NexusExecutionBudget>;
  preferredAgents?: string[];
  requiredSkills?: string[];
  securityPolicy?: Partial<NexusSecurityPolicy>;
}

export interface NexusRunResult extends AgentEngineRunResult {
  plan?: NexusExecutionPlan;
  delegations?: NexusDelegationRecord[];
  evaluationTrace?: NexusEvaluationTrace;
  checkpointPersisted: boolean;
  lastCheckpointId?: string;
  nexusEvents?: RealAgentEvent[];
  budgetMode?: BudgetTier | string;
}
