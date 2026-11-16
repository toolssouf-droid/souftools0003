/**
 * SoufAI Live Agent Activity Types
 */

export type AgentActivityStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled';

export type AgentActivityType =
  | 'thinking_summary'
  | 'search_started'
  | 'search_query'
  | 'page_opened'
  | 'page_reading'
  | 'source_found'
  | 'source_selected'
  | 'file_opened'
  | 'file_analyzed'
  | 'tool_started'
  | 'tool_completed'
  | 'decision'
  | 'clarification_needed'
  | 'verification'
  | 'error'
  | 'finalizing'
  | 'completed'
  // Multimodal Vision System Activity Types
  | 'image_received'
  | 'image_analyzing'
  | 'quality_evaluating'
  | 'images_comparing'
  | 'editing_routing'
  | 'result_reviewing'
  | 'process_completed'
  // Backward compatibility aliases
  | 'agent.started'
  | 'agent.planning'
  | 'agent.searching'
  | 'agent.opening_source'
  | 'agent.reading_source'
  | 'agent.analyzing'
  | 'agent.tool_started'
  | 'agent.tool_completed'
  | 'agent.verifying'
  | 'agent.generating'
  | 'agent.completed'
  | 'agent.failed';

export interface SearchSourceItem {
  title: string;
  url: string;
  domain?: string;
  image?: string;
  snippet?: string;
  status?: 'reading' | 'used' | 'verified' | 'opening';
}

export interface AgentActivity {
  id: string;
  type: AgentActivityType;
  title: string;
  description?: string;
  status: AgentActivityStatus;
  timestamp: number;
  tool?: string;
  url?: string;
  source?: SearchSourceItem;
  metadata?: Record<string, any>;
}

export interface AgentPlanStep {
  stepNumber: number;
  title: string;
  status: AgentActivityStatus;
  retryCount?: number;
  details?: string;
}

export interface AgentToolUsage {
  id: string;
  name: string;
  icon?: string;
  status: AgentActivityStatus;
  detail?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (args: any, context?: any) => Promise<any>;
}

export interface AgentFileAnalysis {
  name: string;
  fileType: string;
  totalPages?: number;
  currentPage?: number;
  status: AgentActivityStatus;
  detail?: string;
}

export type TaskCategory = 'search' | 'math' | 'coding' | 'files' | 'image' | 'agent' | 'general';

export interface AgentActivityState {
  taskId: string;
  category: TaskCategory;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  activities: AgentActivity[];
  planSteps: AgentPlanStep[];
  toolsUsed: AgentToolUsage[];
  sources: SearchSourceItem[];
  fileProgress?: AgentFileAnalysis;
  currentActiveStepTitle?: string;
  projectName?: string;
  metadata?: Record<string, any>;
  error?: {
    toolName?: string;
    message: string;
    canRetry?: boolean;
    retryCount?: number;
  };
  totalDurationMs?: number;
}

export function buildAgentActivityState(
  agentSteps: string[] = [],
  sources: SearchSourceItem[] = [],
  queriesUsed: string[] = [],
  pagesRead: Array<{ url: string; title: string; length: number }> = [],
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' = 'completed',
  category: TaskCategory = 'agent'
): AgentActivityState {
  const activities: AgentActivity[] = [];
  const planSteps: AgentPlanStep[] = [];
  const toolsUsed: AgentToolUsage[] = [];

  // Determine category dynamically if default
  let detectedCategory: TaskCategory = category;
  const allText = agentSteps.join(' ').toLowerCase();
  if (allText.includes('بحث') || allText.includes('search') || queriesUsed.length > 0) detectedCategory = 'search';
  else if (allText.includes('رياضيات') || allText.includes('حساب') || allText.includes('math') || allText.includes('calc')) detectedCategory = 'math';
  else if (allText.includes('كود') || allText.includes('برمجة') || allText.includes('code')) detectedCategory = 'coding';
  else if (allText.includes('ملف') || allText.includes('مستند') || allText.includes('file') || pagesRead.length > 0) detectedCategory = 'files';
  else if (allText.includes('صورة') || allText.includes('رسم') || allText.includes('image')) detectedCategory = 'image';

  agentSteps.forEach((step, idx) => {
    let actType: AgentActivityType = 'agent.analyzing';
    let toolName = 'SoufAI Core';

    if (step.includes('بحث') || step.includes('Google') || step.includes('search')) {
      actType = 'agent.searching';
      toolName = 'Google Search Engine';
    } else if (step.includes('ملف') || step.includes('قراءة') || step.includes('page')) {
      actType = 'agent.reading_source';
      toolName = 'Doc Reader';
    } else if (step.includes('صياغة') || step.includes('إجابة') || step.includes('توليد')) {
      actType = 'agent.generating';
      toolName = 'Response Synthesizer';
    } else if (step.includes('أداة') || step.includes('تشغيل')) {
      actType = 'agent.tool_completed';
      toolName = 'Tool Executor';
    }

    activities.push({
      id: `act_${idx}_${Date.now()}`,
      type: actType,
      title: step,
      status: status === 'completed' ? 'completed' : idx === agentSteps.length - 1 ? 'running' : 'completed',
      timestamp: Date.now() - (agentSteps.length - idx) * 300,
      tool: toolName,
    });

    planSteps.push({
      stepNumber: idx + 1,
      title: step,
      status: status === 'completed' ? 'completed' : idx === agentSteps.length - 1 ? 'running' : 'completed',
    });

    if (!toolsUsed.some((t) => t.name === toolName)) {
      toolsUsed.push({
        id: `tool_${idx}`,
        name: toolName,
        status: 'completed',
      });
    }
  });

  return {
    taskId: `task_${Date.now()}`,
    category: detectedCategory,
    status,
    activities,
    planSteps,
    toolsUsed,
    sources,
    currentActiveStepTitle: agentSteps[agentSteps.length - 1] || 'اكتملت جميع العمليات',
  };
}
