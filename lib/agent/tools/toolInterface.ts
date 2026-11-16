/**
 * SoufAI Standardized Agent Tool Interface
 * Plug-in Architecture for Real Autonomous Agent Execution
 */

export interface StructuredToolResult {
  success: boolean;
  tool: string;
  data: any;
  error: { code: string; message: string; retryable?: boolean } | null;
  contextNote?: string;
  agentSteps?: string[];
  widgetData?: any;
  sources?: Array<{ title: string; snippet: string; url: string; domain?: string }>;
  suggestions?: any[];
  metadata?: Record<string, any>;
}

export interface AgentToolExecutionContext {
  taskId: string;
  origin: string;
  userId?: string;
  projectId?: string;
  gmailToken?: string | null;
  attachments?: any[];
  channel?: "web" | "telegram" | "whatsapp" | "api";
  signal?: AbortSignal;
  onProgress?: (progress: { title: string; summary?: string; metadata?: any }) => void;
}

export type ToolCategory = "server_safe" | "sandbox_system" | "admin_restricted";
export type SupportedChannel = "web" | "telegram" | "api";

export interface AgentTool {
  name: string;
  description: string;
  category?: ToolCategory;
  allowedChannels?: SupportedChannel[];
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      items?: any;
      default?: any;
    }>;
    required?: string[];
  };
  permissions: string[];
  timeout: number; // in milliseconds
  cost: number; // budget cost units
  supportsParallel: boolean;
  execute: (args: any, context: AgentToolExecutionContext) => Promise<StructuredToolResult>;
}
