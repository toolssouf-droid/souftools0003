/**
 * SOUFAI AGENT ENGINE - Unified Facade Adapter over SoufAI Nexus Engine
 *
 * Preserves full backward compatibility for existing API routes:
 * - /api/v1/agent/run
 * - /api/v1/agent/stop
 * - /api/v1/agent/resume
 * - /api/v1/agent/events
 *
 * All multi-agent orchestration, DAG planning, agent/skill registries,
 * intelligent model routing, controlled delegation, fail-loud Turso checkpoints,
 * and evaluation trace separation are executed by SoufAINexusEngine.
 */

import {
  AgentEngineRunOptions,
  AgentEngineRunResult,
  RealAgentEvent,
} from "./types";
import { SoufAINexusEngine } from "../nexus";

type EventCallback = (event: RealAgentEvent) => void;

export class SoufAIEngine {
  /**
   * Subscribe to real-time events for a specific task (SSE / WebSockets)
   */
  public static subscribeToTaskEvents(taskId: string, cb: EventCallback): () => void {
    return SoufAINexusEngine.subscribeToTaskEvents(taskId, cb);
  }

  /**
   * Gracefully stops an active running task and terminates sandbox subprocesses
   */
  public static async stopTask(
    taskId: string,
    userId?: string
  ): Promise<{ success: boolean; message: string }> {
    return SoufAINexusEngine.stopTask(taskId, userId);
  }

  /**
   * Resumes execution of a previously halted, checkpointed, or pending task from Turso
   */
  public static async resumeTask(taskId: string, userId?: string): Promise<AgentEngineRunResult> {
    return SoufAINexusEngine.resumeTask(taskId, userId);
  }

  /**
   * Main Execution Entry Point (delegates to SoufAI Nexus Engine)
   */
  public static async run(options: AgentEngineRunOptions): Promise<AgentEngineRunResult> {
    return SoufAINexusEngine.run({
      ...options,
      channel: "web",
    });
  }
}
