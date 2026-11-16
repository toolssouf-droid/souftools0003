/**
 * SoufAI Real Agent State Model & Types
 */

import { StructuredToolResult } from "./tools/toolInterface";
import { SoufAISuggestionItem } from "@/store/chatStore";
import { AgentActivity, AgentActivityState, SearchSourceItem } from "./agentActivityTypes";

export type AgentStatus =
  | "idle"
  | "planning"
  | "executing"
  | "observing"
  | "verifying"
  | "waiting_for_user"
  | "completed"
  | "recovery_required"
  | "failed"
  | "cancelled";

export interface ObservationItem {
  stepNumber: number;
  tool: string;
  actionDescription: string;
  result: StructuredToolResult;
  timestamp: number;
}

export interface AgentErrorItem {
  tool: string;
  error: string;
  iteration: number;
  retryCount?: number;
  recovered?: boolean;
}

export interface AgentToolCallRecord {
  id: string;
  tool: string;
  args: any;
  timestamp: number;
  durationMs?: number;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
}

export interface AgentState {
  taskId: string;
  status: AgentStatus;
  userRequest: string;
  goal: string;
  plan: string[];
  currentStep: string;
  completedSteps: string[];
  observations: ObservationItem[];
  toolCalls: AgentToolCallRecord[];
  toolResults: Record<string, any>;
  errors: AgentErrorItem[];
  iteration: number;
  maxSteps: number;
  startedAt: number;
  completedAt: number | null;
  finalAnswer?: string;
  agentSteps: string[];
  activities: AgentActivity[];
  toolBudget: Record<string, number>;
  budgetUsed: Record<string, number>;
  questionTitle?: string;
  suggestions?: SoufAISuggestionItem[];
  conversation?: Array<{ role: "user" | "model" | "assistant" | "system"; content: string }>;
  reasoningSteps?: string[];
  innerMonologue?: string;
  reflectionSteps?: string[];
  hypotheses?: string[];
  confidenceScore?: number;
  metadata?: Record<string, any>;
}

export type AgentEventType =
  | "agent_started"
  | "planning"
  | "reasoning_thought"
  | "hypothesis_generated"
  | "tool_started"
  | "tool_progress"
  | "tool_completed"
  | "tool_failed"
  | "observation"
  | "reflection"
  | "verification"
  | "waiting_user"
  | "agent_completed"
  | "agent_failed"
  | "agent_cancelled";

export interface AgentEvent {
  id: string;
  taskId: string;
  type: AgentEventType;
  timestamp: number;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  title: string;
  summary?: string;
  tool?: string;
  metadata?: Record<string, any>;
}

export interface AgentRuntimeOptions {
  modelId?: "spark" | "core" | "pro" | "ultra" | string;
  prompt: string;
  rawPrompt?: string;
  channel?: "web" | "telegram" | "whatsapp" | "api";
  messages?: Array<{ role: "user" | "model" | "assistant" | "system"; content: string }>;
  webSearchEnabled?: boolean;
  activeTools?: string[];
  attachments?: any[];
  origin?: string;
  userId?: string;
  projectId?: string;
  gmailToken?: string | null;
  maxIterations?: number;
  maxStepsTier?: "quick" | "balanced" | "deep" | "auto";
  taskId?: string;
  resumeTaskId?: string;
  userResponse?: string;
  suggestionsConfig?: any;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
  onActivityEvent?: (event: AgentActivity, state: AgentActivityState) => void;
  onAgentEvent?: (event: AgentEvent, state: AgentState) => void;
}

export interface AgentRuntimeResult {
  taskId: string;
  status: AgentStatus;
  text: string;
  agentSteps: string[];
  sources: Array<{ title: string; snippet: string; url: string; domain?: string }>;
  widgetData?: any;
  queriesUsed: string[];
  pagesRead: Array<{ url: string; title: string; length: number }>;
  state: AgentState;
  activities?: AgentActivity[];
  activityState?: AgentActivityState;
  modelUsed?: string;
  providerUsed?: string;
  suggestions?: SoufAISuggestionItem[];
  questionTitle?: string;
  reasoningSteps?: string[];
  innerMonologue?: string;
  reflectionSteps?: string[];
  confidenceScore?: number;
  hypotheses?: string[];
}
