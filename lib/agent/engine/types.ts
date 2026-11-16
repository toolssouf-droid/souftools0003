/**
 * SoufAI Agent Engine - Core Type Definitions
 * 
 * Defines data structures for the Autonomous Multi-Agent Orchestrator,
 * 11 Specialized Worker Capabilities, DAG Task Dependency Graphs,
 * Real Event Streams, Tool Registry, and Quality Verification.
 */

export type AgentWorkerType =
  | "orchestrator"
  | "conversational"
  | "coding"
  | "research"
  | "design"
  | "debug"
  | "testing"
  | "vision"
  | "file"
  | "sandbox"
  | "dependency"
  | "security"
  | "verification"
  | "architecture_analyst"
  | "database_engineer"
  | "workflow_automation"
  | "documentation_engineer";

export type TaskStatus =
  | "pending"
  | "running"
  | "planning"
  | "executing"
  | "waiting_for_dependencies"
  | "retrying"
  | "evaluating"
  | "verifying"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled"
  | "suspended"
  | "recovery_required";

export type BudgetTier = "quick" | "balanced" | "deep" | "auto";

export type ToolRiskLevel = "low" | "medium" | "high" | "critical";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  permissions: string[];
  riskLevel: ToolRiskLevel;
  timeoutMs: number;
  maxCallsPerTask: number;
  supportedAgents: AgentWorkerType[];
  execute: (args: any, context: EngineExecutionContext) => Promise<ToolExecutionOutput>;
}

export interface ToolExecutionOutput {
  success: boolean;
  data?: any;
  error?: string;
  logs?: string[];
  artifacts?: Array<{
    type: string;
    title: string;
    path?: string;
    content?: string;
    metadata?: Record<string, any>;
  }>;
}

export interface EngineExecutionContext {
  taskId: string;
  subtaskId?: string;
  userId: string;
  projectId?: string;
  workspaceDir?: string;
  sandboxId?: string;
  signal?: AbortSignal;
  emitEvent: (
    eventType: string,
    title: string,
    opts?: {
      agentWorker?: AgentWorkerType;
      summary?: string;
      status?: "running" | "completed" | "failed" | "warning";
      payload?: Record<string, any>;
    }
  ) => Promise<void>;
  logToolCall: (
    toolName: string,
    agentWorker: AgentWorkerType,
    args: any,
    result: any,
    durationMs: number,
    status?: "success" | "failed"
  ) => Promise<void>;
  invokeTool?: (
    toolName: string,
    args: Record<string, any>,
    options?: { idempotencyKey?: string; timeoutMs?: number }
  ) => Promise<ToolExecutionOutput>;
}

export interface SubtaskNode {
  id: string;
  taskId: string;
  title: string;
  agentWorker: AgentWorkerType;
  dependencies: string[]; // Subtask IDs that must complete before this runs
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  inputArgs: Record<string, any>;
  outputResult?: Record<string, any>;
  error?: string | null;
  durationMs?: number;
  parallelGroup?: number;
}

export interface TaskGraph {
  taskId: string;
  goal: string;
  nodes: SubtaskNode[];
  edges: Array<{ from: string; to: string }>;
}

export interface RealAgentEvent {
  id: string;
  taskId: string;
  subtaskId?: string;
  eventType: string;
  agentWorker: AgentWorkerType;
  title: string;
  summary?: string;
  status: "running" | "completed" | "failed" | "warning";
  payload?: Record<string, any>;
  timestamp: string;
}

export interface QualityReport {
  typecheck: "PASS" | "FAIL" | "SKIPPED";
  lint: "PASS" | "FAIL" | "SKIPPED";
  tests: "PASS" | "FAIL" | "SKIPPED";
  build: "PASS" | "FAIL" | "SKIPPED";
  runtime: "PASS" | "FAIL" | "SKIPPED";
  preview: "PASS" | "FAIL" | "SKIPPED";
  score: number; // 0 - 100
  details: string[];
}

export interface VisionEvaluation {
  score: number;
  layout: "excellent" | "good" | "needs_work" | "poor";
  spacing: "consistent" | "inconsistent";
  typography: "refined" | "acceptable" | "poor";
  contrast: "pass_wcag_aa" | "fail";
  responsive: "mobile_ready" | "desktop_only";
  issues: string[];
  recommendations: string[];
}

export interface AgentEngineRunOptions {
  userPrompt: string;
  userId: string;
  projectId?: string;
  sandboxId?: string;
  taskType?: string;
  budgetMode?: string;
  modelId?: "spark" | "core" | "pro" | "coder" | "ultra";
  budgetTier?: BudgetTier;
  maxSteps?: number;
  initialFiles?: Record<string, string>;
  taskId?: string;
  resumeTaskId?: string;
  signal?: AbortSignal;
}

export interface AgentEngineRunResult {
  taskId: string;
  goal: string;
  status: TaskStatus;
  summary: string;
  finalResponse: string;
  qualityReport?: QualityReport;
  visionEvaluation?: VisionEvaluation;
  filesChanged: string[];
  sandboxId?: string;
  previewUrl?: string;
  totalDurationMs: number;
  stepsExecuted: number;
  events: RealAgentEvent[];
}
