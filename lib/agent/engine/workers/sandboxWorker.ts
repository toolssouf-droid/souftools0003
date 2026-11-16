/**
 * SoufAI Agent Engine - Specialized Runtime / Sandbox Worker
 * 
 * Manages isolated Linux container lifecycles, runs sanitized commands,
 * controls previews, streams logs, and enforces security constraints.
 */

import { EngineExecutionContext } from "../types";
import { invokeWorkerTool } from "../contextTools";
import { throwIfAborted } from "../abort";

export interface SandboxWorkerInput {
  action: "create" | "run_command" | "start_preview" | "capture_screenshot" | "get_status" | "stop";
  command?: string;
  projectName?: string;
  framework?: string;
  timeoutMs?: number;
}

export interface SandboxWorkerResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function runSandboxWorker(
  input: SandboxWorkerInput,
  ctx: EngineExecutionContext
): Promise<SandboxWorkerResult> {
  throwIfAborted(ctx.signal);
  if (input.action === "create") {
    const result = await invokeWorkerTool(ctx, "create_sandbox", {
      projectName: input.projectName || "SoufTools App",
      framework: input.framework || "react_nextjs",
    }, { timeoutMs: input.timeoutMs || 15000 });
    if (result.success && typeof result.data?.sandboxId === "string") {
      ctx.sandboxId = result.data.sandboxId;
    }
    return { success: result.success, data: result.data, error: result.error };
  }

  if (!ctx.sandboxId) {
    return { success: false, error: "Sandbox is not active or not found." };
  }

  if (input.action === "run_command") {
    if (!input.command) return { success: false, error: "Command string is required." };
    const result = await invokeWorkerTool(ctx, "run_command", {
      command: input.command,
      timeoutMs: input.timeoutMs || 60000,
    }, { timeoutMs: input.timeoutMs || 60000 });
    return { success: result.success, data: result.data, error: result.error };
  }

  if (input.action === "start_preview") {
    const result = await invokeWorkerTool(ctx, "start_preview");
    return { success: result.success, data: result.data, error: result.error };
  }

  if (input.action === "capture_screenshot") {
    const result = await invokeWorkerTool(ctx, "inspect_preview");
    return { success: result.success, data: result.data, error: result.error };
  }

  if (input.action === "get_status") {
    const result = await invokeWorkerTool(ctx, "get_status");
    return { success: result.success, data: result.data, error: result.error };
  }

  if (input.action === "stop") {
    const result = await invokeWorkerTool(ctx, "stop_preview");
    return { success: result.success, data: result.data, error: result.error };
  }

  return { success: false, error: "Unsupported sandbox action." };
}
