/**
 * SoufAI Live Agent Event Bridge & Formatter
 */

import { AgentEvent, AgentEventType, AgentState, AgentStatus } from "./agentState";
import { AgentActivity, AgentActivityState, SearchSourceItem, TaskCategory } from "./agentActivityTypes";

export function createAgentEvent(
  taskId: string,
  type: AgentEventType,
  title: string,
  options: {
    status?: "pending" | "running" | "completed" | "failed" | "cancelled";
    summary?: string;
    tool?: string;
    metadata?: Record<string, any>;
  } = {}
): AgentEvent {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    taskId,
    type,
    timestamp: Date.now(),
    status: options.status || "completed",
    title,
    summary: options.summary,
    tool: options.tool,
    metadata: options.metadata,
  };
}

export function formatAgentActivityFromEvent(event: AgentEvent): AgentActivity {
  return {
    id: event.id,
    type: mapEventTypeToActivityType(event.type),
    title: event.title,
    description: event.summary,
    status: event.status,
    timestamp: event.timestamp,
    tool: event.tool,
    metadata: event.metadata,
  };
}

function mapEventTypeToActivityType(type: AgentEventType): any {
  switch (type) {
    case "agent_started":
    case "planning":
    case "reasoning_thought":
    case "hypothesis_generated":
      return "thinking_summary";
    case "tool_started":
      return "tool_started";
    case "tool_progress":
      return "page_reading";
    case "tool_completed":
      return "tool_completed";
    case "tool_failed":
      return "error";
    case "observation":
      return "source_found";
    case "verification":
    case "reflection":
      return "verification";
    case "waiting_user":
      return "clarification_needed";
    case "agent_completed":
      return "completed";
    case "agent_failed":
      return "error";
    case "agent_cancelled":
      return "completed";
    default:
      return "thinking_summary";
  }
}

export function compileAgentActivityState(
  state: AgentState,
  accumulatedSources: SearchSourceItem[] = []
): AgentActivityState {
  const internalReasoningTitle =
    /(?:تحليل واستدلال أولي|تقييم ومتابعة الاستدلال|توليد مسارات التفكير|مراجعة ونقد ذاتي|Tree of Thoughts|Reflexion)/i;
  const safeActivities = state.activities.filter((activity) => !internalReasoningTitle.test(activity.title));
  let category: TaskCategory = "agent";
  const allText = (state.userRequest + " " + state.plan.join(" ") + " " + state.activities.map((a) => a.title).join(" ")).toLowerCase();

  if (allText.includes("بحث") || allText.includes("search") || accumulatedSources.length > 0) category = "search";
  else if (allText.includes("حساب") || allText.includes("رياضيات") || allText.includes("calc")) category = "math";
  else if (allText.includes("كود") || allText.includes("برمجة") || allText.includes("code") || allText.includes("html") || allText.includes("react")) category = "coding";
  else if (allText.includes("ملف") || allText.includes("مستند") || allText.includes("file")) category = "files";
  else if (allText.includes("صورة") || allText.includes("رسم") || allText.includes("image")) category = "image";

  const toolsUsed = Array.from(new Set(safeActivities.map((a) => a.tool).filter(Boolean))).map((t, idx) => ({
    id: `tool_${idx}`,
    name: t!,
    status: (state.status === "completed" ? "completed" : "running") as any,
  }));

  const lastActivity = safeActivities[safeActivities.length - 1];

  return {
    taskId: state.taskId,
    category,
    status: (state.status as string) === "running" || (state.status as string) === "planning" || (state.status as string) === "executing" ? "running" : (state.status as any),
    activities: safeActivities,
    planSteps: state.plan.map((p, idx) => ({
      stepNumber: idx + 1,
      title: p,
      status: idx < state.completedSteps.length ? "completed" : idx === state.completedSteps.length && state.status !== "completed" ? "running" : "pending",
    })),
    toolsUsed,
    sources: accumulatedSources,
    currentActiveStepTitle: lastActivity ? lastActivity.title : state.currentStep || "جاري التنفيذ...",
  };
}
