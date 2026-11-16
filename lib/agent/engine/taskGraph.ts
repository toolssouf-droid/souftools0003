/**
 * SoufAI Agent Engine - Task Dependency Graph (DAG) & Parallel Scheduler
 *
 * Manages dynamic subtask graph resolution, parallel execution of independent tasks,
 * topological sorting, durable Turso subtask state persistence, and downstream dependency pipelines.
 */

import { AgentRepository } from "@/lib/db";
import { SubtaskNode, EngineExecutionContext } from "./types";

export interface SubtaskExecutor {
  (subtask: SubtaskNode, ctx: EngineExecutionContext): Promise<{
    success: boolean;
    output?: Record<string, any>;
    error?: string;
  }>;
}

export class TaskDependencyGraph {
  public taskId: string;
  public nodes: Map<string, SubtaskNode> = new Map();
  public results: Map<string, Record<string, any>> = new Map();
  private readonly pendingSubtaskCreates: Promise<void>[] = [];
  private subtaskCreateError: unknown = null;

  constructor(taskId: string) {
    this.taskId = taskId;
  }

  public addNode(node: SubtaskNode): void {
    this.nodes.set(node.id, node);
    this.pendingSubtaskCreates.push(AgentRepository.createSubtask({
      id: `${this.taskId}_${node.id}`,
      taskId: this.taskId,
      title: node.title,
      agentWorker: node.agentWorker,
      status: node.status,
      dependencies: node.dependencies,
      parallelGroup: node.parallelGroup || 0,
      inputArgs: node.inputArgs,
    }).then(() => undefined).catch((error) => {
      this.subtaskCreateError = error;
      console.error(`[TaskDependencyGraph] Could not persist subtask '${node.id}':`, error);
    }));
  }

  public getReadyNodes(): SubtaskNode[] {
    const ready: SubtaskNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.status !== "pending") continue;
      const depsCompleted = node.dependencies.every((depId) => {
        const parent = this.nodes.get(depId);
        return parent && parent.status === "completed";
      });
      if (depsCompleted) {
        ready.push(node);
      }
    }
    return ready;
  }

  public hasUnfinishedNodes(): boolean {
    for (const node of this.nodes.values()) {
      if (node.status === "pending" || node.status === "running") {
        return true;
      }
    }
    return false;
  }

  /**
   * Executes all ready nodes concurrently in waves (parallel execution)
   */
  public async executeGraph(
    ctx: EngineExecutionContext,
    executor: SubtaskExecutor
  ): Promise<{
    completedCount: number;
    failedCount: number;
    results: Record<string, any>;
  }> {
    await Promise.all(this.pendingSubtaskCreates);
    if (this.subtaskCreateError) {
      throw new Error(`Task '${this.taskId}' could not persist its subtask plan.`, {
        cause: this.subtaskCreateError,
      });
    }

    let completedCount = 0;
    let failedCount = 0;

    while (this.hasUnfinishedNodes()) {
      if (ctx.signal?.aborted) {
        for (const node of this.nodes.values()) {
          if (node.status === "pending") {
            node.status = "skipped";
            await AgentRepository.updateSubtask(`${this.taskId}_${node.id}`, {
              status: "skipped",
              error: "Task aborted by user",
              completedAt: new Date(),
            });
          }
        }
        break;
      }

      const readyWave = this.getReadyNodes();
      if (readyWave.length === 0) {
        for (const node of this.nodes.values()) {
          if (node.status === "pending") {
            node.status = "skipped";
            node.error = "Unresolved dependency prerequisites";
            await AgentRepository.updateSubtask(`${this.taskId}_${node.id}`, {
              status: "skipped",
              error: node.error,
              completedAt: new Date(),
            });
          }
        }
        break;
      }

      if (readyWave.length > 1) {
        await ctx.emitEvent(
          "agent.parallel.started",
          `تشغيل ${readyWave.length} مهام فرعية بالتوازي`,
          {
            agentWorker: "orchestrator",
            status: "running",
            summary: readyWave.map((n) => `[${n.agentWorker}] ${n.title}`).join(" | "),
          }
        );
      }

      for (const node of readyWave) {
        node.status = "running";
        await AgentRepository.updateSubtask(`${this.taskId}_${node.id}`, {
          status: "running",
          startedAt: new Date(),
        });
      }

      const wavePromises = readyWave.map(async (node) => {
        const startTime = Date.now();
        const dbSubtaskId = `${this.taskId}_${node.id}`;
        await ctx.emitEvent("agent.subtask.started", `بدء تنفيذ المهمة: ${node.title}`, {
          agentWorker: node.agentWorker,
          status: "running",
        });

        try {
          const res = await executor(node, ctx);
          node.durationMs = Date.now() - startTime;
          if (res.success) {
            node.status = "completed";
            node.outputResult = res.output || {};
            this.results.set(node.id, node.outputResult);
            completedCount++;
            await AgentRepository.updateSubtask(dbSubtaskId, {
              status: "completed",
              outputResult: node.outputResult,
              durationMs: node.durationMs,
              completedAt: new Date(),
            });
            await ctx.emitEvent("agent.subtask.completed", `اكتملت المهمة: ${node.title}`, {
              agentWorker: node.agentWorker,
              status: "completed",
              summary: `استغرقت ${node.durationMs}ms`,
            });
          } else {
            node.status = "failed";
            node.error = res.error || "Execution failed";
            failedCount++;
            await AgentRepository.updateSubtask(dbSubtaskId, {
              status: "failed",
              error: node.error,
              durationMs: node.durationMs,
              completedAt: new Date(),
            });
            await ctx.emitEvent("agent.subtask.failed", `فشلت المهمة: ${node.title}`, {
              agentWorker: node.agentWorker,
              status: "failed",
              summary: node.error || undefined,
            });
          }
        } catch (err: any) {
          node.status = "failed";
          node.error = err.message || "Unknown error";
          node.durationMs = Date.now() - startTime;
          failedCount++;
          await AgentRepository.updateSubtask(dbSubtaskId, {
            status: "failed",
            error: node.error,
            durationMs: node.durationMs,
            completedAt: new Date(),
          });
          await ctx.emitEvent("agent.subtask.failed", `استثناء في المهمة: ${node.title}`, {
            agentWorker: node.agentWorker,
            status: "failed",
            summary: node.error || undefined,
          });
        }
      });

      const waveResults = await Promise.allSettled(wavePromises);
      const rejectedResult = waveResults.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      if (rejectedResult) throw rejectedResult.reason;
    }

    const aggregated: Record<string, any> = {};
    for (const [id, res] of this.results.entries()) {
      aggregated[id] = res;
    }

    return { completedCount, failedCount, results: aggregated };
  }
}
