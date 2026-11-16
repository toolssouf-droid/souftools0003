/**
 * SoufAI Agent Engine - Specialized File Worker
 * 
 * Manages atomic filesystem operations, structural integrity,
 * import path updates, and safe file indexing within the workspace.
 */

import { EngineExecutionContext } from "../types";
import { invokeWorkerTool } from "../contextTools";
import { throwIfAborted } from "../abort";

export interface FileWorkerInput {
  action: "read" | "create" | "edit" | "delete" | "search" | "list";
  filePath?: string;
  content?: string;
  pattern?: string;
}

export interface FileWorkerResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function runFileWorker(
  input: FileWorkerInput,
  ctx: EngineExecutionContext
): Promise<FileWorkerResult> {
  const toolName =
    input.action === "read"
      ? "read_file"
      : input.action === "create"
      ? "create_file"
      : input.action === "edit"
      ? "edit_file"
      : input.action === "delete"
      ? "delete_file"
      : "search_files";

  const res = await invokeWorkerTool(
    ctx,
    toolName,
    {
      filePath: input.filePath,
      content: input.content,
      pattern: input.pattern,
    }
  );
  throwIfAborted(ctx.signal);

  return {
    success: res.success,
    data: res.data,
    error: res.error,
  };
}
