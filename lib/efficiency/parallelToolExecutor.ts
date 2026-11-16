// lib/efficiency/parallelToolExecutor.ts
/**
 * Parallel Tool Execution Engine
 * Runs independent tool tasks concurrently (e.g. multi-query search, multi-url scraping)
 * to cut latency drastically and prevent sequential blocking.
 */

import { getEfficiencyConfig } from "./efficiencyStore";

export interface ToolCallItem {
  toolName: string;
  args: Record<string, any>;
  executor: (toolName: string, args: any) => Promise<any>;
  description?: string;
}

export interface ParallelToolExecutionResult {
  results: Array<{
    toolName: string;
    success: boolean;
    data: any;
    error: any;
    executionTimeMs: number;
  }>;
  totalTimeMs: number;
  isParallel: boolean;
}

/**
 * Execute multiple tool calls in parallel or sequence based on config
 */
export async function executeParallelTools(
  toolCalls: ToolCallItem[]
): Promise<ParallelToolExecutionResult> {
  const config = getEfficiencyConfig();
  const startTime = Date.now();

  if (toolCalls.length === 0) {
    return { results: [], totalTimeMs: 0, isParallel: false };
  }

  // If parallel is disabled or only 1 tool, run sequentially
  if (!config.parallelToolsEnabled || toolCalls.length === 1) {
    const results = [];
    for (const call of toolCalls) {
      const stepStart = Date.now();
      try {
        const data = await call.executor(call.toolName, call.args);
        results.push({
          toolName: call.toolName,
          success: true,
          data,
          error: null,
          executionTimeMs: Date.now() - stepStart,
        });
      } catch (err: any) {
        results.push({
          toolName: call.toolName,
          success: false,
          data: null,
          error: err,
          executionTimeMs: Date.now() - stepStart,
        });
      }
    }

    return {
      results,
      totalTimeMs: Date.now() - startTime,
      isParallel: false,
    };
  }

  // Execute in Parallel via Promise.allSettled
  const promises = toolCalls.map(async (call) => {
    const stepStart = Date.now();
    try {
      const data = await call.executor(call.toolName, call.args);
      return {
        toolName: call.toolName,
        success: true,
        data,
        error: null,
        executionTimeMs: Date.now() - stepStart,
      };
    } catch (err: any) {
      return {
        toolName: call.toolName,
        success: false,
        data: null,
        error: err,
        executionTimeMs: Date.now() - stepStart,
      };
    }
  });

  const settled = await Promise.allSettled(promises);
  const results = settled.map((s, idx) => {
    if (s.status === "fulfilled") {
      return s.value;
    } else {
      return {
        toolName: toolCalls[idx].toolName,
        success: false,
        data: null,
        error: s.reason,
        executionTimeMs: 0,
      };
    }
  });

  return {
    results,
    totalTimeMs: Date.now() - startTime,
    isParallel: true,
  };
}
