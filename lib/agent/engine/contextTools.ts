import type { EngineExecutionContext, ToolExecutionOutput } from "./types";
import { throwIfAborted } from "./abort";

export async function invokeWorkerTool(
  ctx: EngineExecutionContext,
  toolName: string,
  args: Record<string, unknown> = {},
  options?: { idempotencyKey?: string; timeoutMs?: number }
): Promise<ToolExecutionOutput> {
  throwIfAborted(ctx.signal);
  if (!ctx.invokeTool) {
    throw new Error(`Worker tool '${toolName}' requires the NexusToolBridge execution context.`);
  }
  return ctx.invokeTool(toolName, args, options);
}
