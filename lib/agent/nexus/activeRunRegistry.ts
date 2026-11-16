import type { AgentTaskLease } from "@/lib/db";
import type { NexusRunRequest } from "./types";

export interface ActiveNexusRun {
  runId: string;
  request: NexusRunRequest;
  controller: AbortController;
  lease: AgentTaskLease;
  sandboxId?: string;
}

export function activeRunOwnsLease(
  run: ActiveNexusRun | undefined,
  task: { leaseOwner?: string | null; leaseToken?: string | null; leaseGeneration: number }
): boolean {
  return Boolean(
    run &&
    task.leaseOwner === run.lease.workerId &&
    task.leaseToken === run.lease.token &&
    task.leaseGeneration === run.lease.generation
  );
}

export class ActiveNexusRunRegistry {
  private readonly runs = new Map<string, ActiveNexusRun>();

  public get(taskId: string): ActiveNexusRun | undefined {
    return this.runs.get(taskId);
  }

  public register(taskId: string, run: ActiveNexusRun): void {
    const current = this.runs.get(taskId);
    if (current && current.lease.generation >= run.lease.generation) {
      throw new Error(`Active Nexus run '${taskId}' already has an equal or newer lease generation.`);
    }
    this.runs.set(taskId, run);
  }

  public updateSandbox(taskId: string, runId: string, sandboxId: string): boolean {
    const run = this.runs.get(taskId);
    if (!run || run.runId !== runId) return false;
    run.sandboxId = sandboxId;
    return true;
  }

  public delete(taskId: string, runId: string): boolean {
    if (this.runs.get(taskId)?.runId !== runId) return false;
    this.runs.delete(taskId);
    return true;
  }
}

export const activeNexusRunRegistry = new ActiveNexusRunRegistry();
