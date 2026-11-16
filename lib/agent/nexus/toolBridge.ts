/**
 * SoufAI Nexus Engine — Unified Tool Bridge
 *
 * Bridges both existing tool registries without duplicating implementations:
 * 1. GlobalToolRegistry (lib/agent/engine/toolRegistry.ts) — workspace/sandbox/build tools
 * 2. globalToolRegistry (lib/agent/tools/toolRegistry.ts) — chat/web/memory/channel/schedule tools
 *
 * Enforces NexusSecurityController authorization, approval gates, timeouts,
 * per-task budgets, <untrusted_tool_data> isolation, and Turso tool call logging.
 */

import { GlobalToolRegistry as EngineToolRegistry } from "../engine/toolRegistry";
import { globalToolRegistry as RuntimeToolRegistry } from "../tools/toolRegistry";
import { AgentRepository } from "@/lib/db";
import { nexusSecurityController } from "./securityController";
import type { ToolRiskLevel } from "../engine/types";
import type {
  NexusAgentDefinition,
  NexusExecutionContext,
  NexusPermission,
} from "./types";
import { NexusPersistenceError } from "./taskLifecycle";
import { getAbortError, isAbortError, throwIfAborted } from "../engine/abort";

const RUNTIME_TOOL_PERMISSION_MAP: Record<string, { permissions: NexusPermission[]; risk: ToolRiskLevel }> = {
  web_search: { permissions: ["web:search"], risk: "low" },
  open_page: { permissions: ["web:fetch"], risk: "low" },
  coding: { permissions: ["write:workspace"], risk: "medium" },
  calculator: { permissions: [], risk: "low" },
  generate_image: { permissions: ["media:generate"], risk: "low" },
  analyze_image: { permissions: ["media:analyze"], risk: "low" },
  retrieve_memory: { permissions: ["memory:read"], risk: "low" },
  save_user_memory: { permissions: ["memory:write"], risk: "low" },
  update_user_memory: { permissions: ["memory:write"], risk: "low" },
  delete_user_memory: { permissions: ["memory:write"], risk: "medium" },
  get_user_profile: { permissions: ["memory:read"], risk: "low" },
  get_current_time: { permissions: [], risk: "low" },
  convert_time: { permissions: [], risk: "low" },
  task_create: { permissions: ["schedule:write"], risk: "low" },
  task_list: { permissions: ["schedule:read"], risk: "low" },
  schedule_email: { permissions: ["schedule:write", "comms:gmail_write"], risk: "medium" },
  schedule_cancel: { permissions: ["schedule:write"], risk: "low" },
  souf_file: { permissions: ["write:workspace"], risk: "low" },
  whatsapp_send: { permissions: ["comms:whatsapp_send"], risk: "medium" },
  whatsapp_template: { permissions: ["comms:whatsapp_send"], risk: "medium" },
  gmail_search: { permissions: ["comms:gmail_read"], risk: "low" },
  gmail_read: { permissions: ["comms:gmail_read"], risk: "low" },
  gmail_draft: { permissions: ["comms:gmail_write"], risk: "medium" },
  gmail_summarize: { permissions: ["comms:gmail_read"], risk: "low" },
  media_player: { permissions: ["media:control"], risk: "low" },
};

const UNTRUSTED_DATA_TOOLS = new Set([
  "web_search",
  "search_web",
  "open_page",
  "gmail_search",
  "gmail_read",
]);

export interface NexusToolExecutionResponse {
  success: boolean;
  toolName: string;
  sourceRegistry: "engine" | "runtime" | "none";
  data?: any;
  error?: string;
  contextNote?: string;
  sources?: any[];
  widgetData?: any;
  durationMs: number;
  skippedByIdempotency?: boolean;
}

function validateToolArguments(
  schema: Record<string, any>,
  args: Record<string, any>
): string | undefined {
  const properties = schema.properties || schema;
  const required = Array.isArray(schema.required)
    ? schema.required
    : Object.entries(properties)
        .filter(([, definition]) => (definition as any)?.required)
        .map(([name]) => name);

  for (const name of required) {
    if (args[name] === undefined || args[name] === null) {
      return `Missing required tool argument '${name}'.`;
    }
  }

  for (const [name, definition] of Object.entries(properties)) {
    const value = args[name];
    if (value === undefined || value === null || !definition || typeof definition !== "object") continue;
    const type = (definition as any).type;
    const validType =
      type === "array" ? Array.isArray(value) :
      type === "object" ? typeof value === "object" && !Array.isArray(value) :
      type === "number" ? typeof value === "number" && Number.isFinite(value) :
      type === "integer" ? Number.isInteger(value) :
      typeof type === "string" ? typeof value === type :
      true;
    if (!validType) return `Tool argument '${name}' must be ${type}.`;
    const allowedValues = (definition as any).enum;
    if (Array.isArray(allowedValues) && !allowedValues.includes(value)) {
      return `Tool argument '${name}' has an unsupported value.`;
    }
  }
}

export class NexusToolBridge {
  private async persistToolCall(
    data: Parameters<typeof AgentRepository.logToolCall>[0],
    lease: NexusExecutionContext["lease"]
  ): Promise<void> {
    try {
      await AgentRepository.logToolCall({ ...data, lease });
    } catch (error) {
      throw new NexusPersistenceError(
        `Could not persist tool execution '${data.toolName}' for task '${data.taskId}': ${
          error instanceof Error ? error.message : String(error)
        }`,
        error
      );
    }
  }

  public listAvailableToolNames(agent?: NexusAgentDefinition): string[] {
    const names = new Set<string>();
    for (const t of EngineToolRegistry.listTools()) {
      names.add(t.name);
    }
    for (const t of RuntimeToolRegistry.getAllTools()) {
      names.add(t.name);
    }
    if (!agent) return Array.from(names);
    const allowed = new Set(agent.allowedTools.map((x) => x.toLowerCase()));
    if (allowed.has("*")) return Array.from(names);
    return Array.from(names).filter((n) => allowed.has(n.toLowerCase()));
  }

  public async executeTool(params: {
    toolName: string;
    args: Record<string, any>;
    agent: NexusAgentDefinition;
    ctx: NexusExecutionContext;
    idempotencyKey?: string;
    timeoutMs?: number;
    toolCallCounter?: { count: number };
  }): Promise<NexusToolExecutionResponse> {
    const { toolName, args, agent, ctx, idempotencyKey, timeoutMs, toolCallCounter } = params;
    const start = Date.now();

    throwIfAborted(ctx.signal);

    // 1. Idempotency check so recovery never repeats side effects
    if (idempotencyKey && ctx.completedOperationKeys.has(`tool:${idempotencyKey}`)) {
      return {
        success: true,
        toolName,
        sourceRegistry: "none",
        data: { skipped: true, reason: "Already completed in checkpoint" },
        durationMs: 0,
        skippedByIdempotency: true,
      };
    }

    // 2. Budget guard
    if (toolCallCounter) {
      if (toolCallCounter.count >= ctx.budget.maxToolCalls) {
        return {
          success: false,
          toolName,
          sourceRegistry: "none",
          error: `Task tool call budget exceeded (${ctx.budget.maxToolCalls}).`,
          durationMs: 0,
        };
      }
      toolCallCounter.count += 1;
    }

    const engineTool = EngineToolRegistry.get(toolName);
    const runtimeTool = engineTool ? undefined : RuntimeToolRegistry.getTool(toolName);

    if (!engineTool && !runtimeTool) {
      return {
        success: false,
        toolName,
        sourceRegistry: "none",
        error: `Tool '${toolName}' is not registered in either engine or runtime catalogs.`,
        durationMs: Date.now() - start,
      };
    }

    const inputError = validateToolArguments(
      (engineTool?.inputSchema || runtimeTool!.inputSchema) as Record<string, any>,
      args || {}
    );
    if (inputError) {
      return {
        success: false,
        toolName,
        sourceRegistry: engineTool ? "engine" : "runtime",
        error: inputError,
        durationMs: Date.now() - start,
      };
    }

    const toolPermissions = engineTool
      ? (engineTool.permissions as NexusPermission[])
      : RUNTIME_TOOL_PERMISSION_MAP[toolName]?.permissions || [];
    const riskLevel: ToolRiskLevel = engineTool
      ? engineTool.riskLevel
      : RUNTIME_TOOL_PERMISSION_MAP[toolName]?.risk || "low";
    const effectiveTimeout = Math.min(
      timeoutMs || (engineTool ? engineTool.timeoutMs : runtimeTool!.timeout) || 30000,
      ctx.budget.stepTimeoutMs
    );

    const runWithTimeout = async <T>(fn: (signal: AbortSignal) => Promise<T>): Promise<T> => {
      const controller = new AbortController();
      const abortFromParent = () => controller.abort(ctx.signal?.reason);
      if (ctx.signal?.aborted) {
        abortFromParent();
      } else {
        ctx.signal?.addEventListener("abort", abortFromParent, { once: true });
      }
      const timer = setTimeout(
        () => controller.abort(new Error(`Tool '${toolName}' timed out after ${effectiveTimeout}ms`)),
        effectiveTimeout
      );
      let abortListener: (() => void) | undefined;
      try {
        throwIfAborted(controller.signal);
        const aborted = new Promise<never>((_, reject) => {
          abortListener = () =>
            reject(controller.signal.reason || new Error("Tool execution aborted."));
          controller.signal.addEventListener("abort", abortListener, { once: true });
        });
        const result = await Promise.race([fn(controller.signal), aborted]);
        throwIfAborted(controller.signal);
        return result;
      } finally {
        clearTimeout(timer);
        ctx.signal?.removeEventListener("abort", abortFromParent);
        if (abortListener) controller.signal.removeEventListener("abort", abortListener);
      }
    };

    // 3. Security authorization & channel containment
    const auth = nexusSecurityController.authorizeToolExecution({
      agent,
      effectivePermissions: ctx.effectivePermissions,
      toolName,
      toolPermissions,
      riskLevel,
      args: args || {},
      policy: ctx.securityPolicy,
    });

    if (!auth.allowed) {
      if (auth.requiresApproval && ctx.securityPolicy.approvalHandler) {
        let approved = false;
        try {
          approved = await runWithTimeout((signal) => ctx.securityPolicy.approvalHandler!({
            taskId: ctx.taskId,
            agentId: agent.id,
            toolName,
            riskLevel: auth.riskLevel,
            reason: auth.reason || "Elevated risk tool",
            argsSummary: JSON.stringify(args || {}).slice(0, 200),
            signal,
          }));
        } catch (error) {
          if (isAbortError(error, ctx.signal)) throw getAbortError(ctx.signal);
          console.error(`[NexusToolBridge] approval handler failed for '${toolName}':`, error);
          throw new Error(`Tool '${toolName}' was denied because approval could not be confirmed.`);
        }
        if (!approved) {
          return {
            success: false,
            toolName,
            sourceRegistry: engineTool ? "engine" : "runtime",
            error: `APPROVAL_DENIED: ${auth.reason}`,
            durationMs: Date.now() - start,
          };
        }
      } else {
        return {
          success: false,
          toolName,
          sourceRegistry: engineTool ? "engine" : "runtime",
          error: auth.requiresApproval
            ? `APPROVAL_REQUIRED: ${auth.reason}`
            : auth.reason || "Unauthorized tool invocation",
          durationMs: Date.now() - start,
        };
      }
    }

    try {
      if (engineTool) {
        const out = await runWithTimeout((signal) =>
          engineTool.execute(args || {}, { ...ctx, signal })
        );
        const durationMs = Date.now() - start;

        await this.persistToolCall({
          taskId: ctx.taskId,
          subtaskId: ctx.subtaskId,
          toolName,
          agentWorker: ctx.workerTypeCompat || agent.workerType,
          args: { keys: Object.keys(args || {}).slice(0, 32) },
          result: { status: out.success ? "success" : "failed" },
          status: out.success ? "success" : "failed",
          errorMessage: out.success ? undefined : "Tool execution failed.",
          durationMs,
        }, ctx.lease);

        if (out.success && idempotencyKey) {
          ctx.completedOperationKeys.add(`tool:${idempotencyKey}`);
        }

        let contextNote: string | undefined;
        if (
          out.success &&
          ctx.securityPolicy.wrapUntrustedToolOutputs &&
          UNTRUSTED_DATA_TOOLS.has(toolName) &&
          out.data
        ) {
          contextNote = nexusSecurityController.quarantineExternalData(
            JSON.stringify(out.data).slice(0, 4000),
            toolName,
            toolName
          );
        }

        return {
          success: out.success,
          toolName,
          sourceRegistry: "engine",
          data: out.data,
          error: out.error,
          contextNote,
          durationMs,
        };
      }

      // Runtime tool execution
      const channelCompat: "web" | "telegram" | "api" =
        ctx.channel === "whatsapp" ? "telegram" : ctx.channel;

      if (!RuntimeToolRegistry.isToolAllowedForChannel(toolName, channelCompat)) {
        return {
          success: false,
          toolName,
          sourceRegistry: "runtime",
          error: `Tool '${toolName}' is restricted on channel '${ctx.channel}'.`,
          durationMs: Date.now() - start,
        };
      }

      const out = await runWithTimeout((signal) =>
        runtimeTool!.execute(args || {}, {
          taskId: ctx.taskId,
          origin: "http://localhost:3000",
          userId: ctx.userId,
          projectId: ctx.projectId,
          channel: ctx.channel,
          signal,
        })
      );
      const durationMs = Date.now() - start;

      await this.persistToolCall({
        taskId: ctx.taskId,
        subtaskId: ctx.subtaskId,
        toolName,
        agentWorker: agent.workerType,
        args: { keys: Object.keys(args || {}).slice(0, 32) },
        result: { status: out.success ? "success" : "failed" },
        status: out.success ? "success" : "failed",
        errorMessage: out.success ? undefined : "Tool execution failed.",
        durationMs,
      }, ctx.lease);

      if (out.success && idempotencyKey) {
        ctx.completedOperationKeys.add(`tool:${idempotencyKey}`);
      }

      const contextNote =
        ctx.securityPolicy.wrapUntrustedToolOutputs &&
        UNTRUSTED_DATA_TOOLS.has(toolName) &&
        out.contextNote
          ? nexusSecurityController.quarantineExternalData(out.contextNote, toolName, toolName)
          : out.contextNote;

      return {
        success: out.success,
        toolName,
        sourceRegistry: "runtime",
        data: out.data,
        error: out.error?.message,
        contextNote,
        sources: out.sources,
        widgetData: out.widgetData,
        durationMs,
      };
    } catch (err: any) {
      if (err instanceof NexusPersistenceError) {
        throw err;
      }
      if (isAbortError(err, ctx.signal)) throw getAbortError(ctx.signal);
      const durationMs = Date.now() - start;
      const errMsg = err?.message || String(err);
      await this.persistToolCall({
        taskId: ctx.taskId,
        subtaskId: ctx.subtaskId,
        toolName,
        agentWorker: agent.workerType,
        args: { keys: Object.keys(args || {}).slice(0, 32) },
        result: { status: "failed" },
        status: "failed",
        errorMessage: "Tool execution failed.",
        durationMs,
      }, ctx.lease);

      return {
        success: false,
        toolName,
        sourceRegistry: engineTool ? "engine" : "runtime",
        error: errMsg,
        durationMs,
      };
    }
  }
}

export const nexusToolBridge = new NexusToolBridge();
