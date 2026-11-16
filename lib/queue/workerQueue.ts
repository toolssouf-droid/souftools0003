/**
 * SoufTools Durable Background Job & Worker Queue Engine (Turso-Backed)
 * Uses Claim/Lease atomic locking, exponential retry backoff, stale lease recovery,
 * and durable checkpointing in Turso `worker_jobs`.
 */

import {
  UserRepository,
  ConversationRepository,
  MemoryRepository,
  BehaviorRepository,
  StorageRepository,
  AuditRepository,
  WorkerJobRepository,
} from "@/lib/db";
import { ObjectStorage } from "@/lib/storage/objectStorage";
import { DatabaseMaintenanceService } from "@/lib/db/maintenance";
import os from "os";

export type JobType =
  | "cleanup_expired_sessions"
  | "cleanup_orphaned_storage"
  | "recalculate_storage_quotas"
  | "export_user_data"
  | "purge_user_data"
  | "agent_task_execution";

export interface BackgroundJob {
  id: string;
  type: JobType | string;
  payload: any;
  status: "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
  attempts: number;
  maxAttempts: number;
  checkpoint?: Record<string, any>;
  result?: any;
  error?: string | null;
  createdAt: number;
  processedAt?: number;
}

class BackgroundWorkerQueue {
  private readonly workerId: string;
  private isPolling = false;
  private schedulerTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly LEASE_MS = 90_000;

  constructor() {
    this.workerId = `worker_${os.hostname()}_${process.pid}_${Math.random().toString(36).slice(2, 7)}`;
    if (typeof window === "undefined") {
      this.startLoops();
    }
  }

  private startLoops() {
    const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
    if (isBuildPhase) return;

    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);

    // Periodic maintenance & stale lease sweep
    this.schedulerTimer = setInterval(() => {
      if (!process.env.TURSO_DATABASE_URL) return;
      WorkerJobRepository.recoverStaleLeases().catch(() => {});
      this.enqueueAsync("cleanup_expired_sessions", {}).catch(() => {});
      this.enqueueAsync("cleanup_orphaned_storage", {}).catch(() => {});
    }, 15 * 60 * 1000);
    if (this.schedulerTimer.unref) this.schedulerTimer.unref();

    // Poll durable queue every 5 seconds for pending/queued/expired-lease jobs
    this.pollTimer = setInterval(() => {
      if (!process.env.TURSO_DATABASE_URL) return;
      this.processNext().catch(() => {});
    }, 5000);
    if (this.pollTimer.unref) this.pollTimer.unref();
  }

  /**
   * Synchronously returns an ID and durably persists the job into Turso `worker_jobs`.
   */
  public enqueue(type: JobType | string, payload: any, maxAttempts = 3): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const userId = payload?.userId ? String(payload.userId) : undefined;
    const projectId = payload?.projectId ? String(payload.projectId) : undefined;

    WorkerJobRepository.enqueue({
      id,
      type,
      payload,
      maxAttempts,
      userId,
      projectId,
      status: "queued",
    })
      .then(() => {
        this.processNext().catch(() => {});
      })
      .catch((err) => {
        console.error("[WorkerQueue] Failed to enqueue durable job:", err);
      });

    return id;
  }

  /**
   * Async durable enqueue that awaits Turso persistence before returning.
   */
  public async enqueueAsync(
    type: JobType | string,
    payload: any,
    options: { id?: string; maxAttempts?: number; userId?: string; projectId?: string } = {}
  ) {
    const row = await WorkerJobRepository.enqueue({
      id: options.id,
      type,
      payload,
      maxAttempts: options.maxAttempts ?? 3,
      userId: options.userId || (payload?.userId ? String(payload.userId) : undefined),
      projectId: options.projectId || (payload?.projectId ? String(payload.projectId) : undefined),
      status: "queued",
    });

    setImmediate(() => {
      this.processNext().catch(() => {});
    });

    return row;
  }

  /**
   * Claims the next available durable job atomically using Claim/Lease and executes it.
   */
  public async processNext(): Promise<boolean> {
    if (this.isPolling) return false;
    this.isPolling = true;

    try {
      const claimed = await WorkerJobRepository.claimNextJob(this.workerId, this.LEASE_MS);
      if (!claimed) return false;

      const leaseRenewInterval = setInterval(() => {
        WorkerJobRepository.renewLease(claimed.id, this.workerId, this.LEASE_MS).catch(() => {});
      }, Math.floor(this.LEASE_MS / 3));
      if (leaseRenewInterval.unref) leaseRenewInterval.unref();

      try {
        const result = await this.executeJob(claimed);
        await WorkerJobRepository.completeJob(claimed.id, this.workerId, result || {});
      } catch (err: any) {
        await WorkerJobRepository.failJob(
          claimed.id,
          this.workerId,
          err?.message || "Job execution failed"
        );
      } finally {
        clearInterval(leaseRenewInterval);
      }

      // Immediately check for more queued jobs
      setImmediate(() => {
        this.processNext().catch(() => {});
      });
      return true;
    } finally {
      this.isPolling = false;
    }
  }

  private async executeJob(job: any): Promise<any> {
    const payload = job.payload || {};
    switch (job.type) {
      case "cleanup_expired_sessions": {
        await WorkerJobRepository.updateCheckpoint(job.id, { phase: "running_full_maintenance", at: Date.now() });
        const stats = await DatabaseMaintenanceService.runFullMaintenance();
        return {
          message: "Full Turso database maintenance completed successfully",
          stats,
        };
      }

      case "cleanup_orphaned_storage": {
        await WorkerJobRepository.updateCheckpoint(job.id, { phase: "sweeping_sandboxes", at: Date.now() });
        const stats = await DatabaseMaintenanceService.cleanStaleSandboxes(7);
        return { message: "Storage and sandbox sweep completed", cleanedSandboxes: stats };
      }

      case "recalculate_storage_quotas": {
        const { userId } = payload;
        if (!userId) return { skipped: true };
        const files = await StorageRepository.listByUser(userId);
        const totalSize = files.reduce((sum: number, f: any) => sum + (f.sizeBytes || 0), 0);
        const user = await UserRepository.getById(userId);
        if (user) {
          const delta = totalSize - (user.storageUsedBytes || 0);
          if (delta !== 0) {
            await UserRepository.updateStorageUsage(userId, delta);
          }
        }
        return { userId, recalculatedSize: totalSize };
      }

      case "export_user_data": {
        const { userId } = payload;
        const [user, conversations, memories, behavior, files] = await Promise.all([
          UserRepository.getById(userId),
          ConversationRepository.listByUser(userId),
          MemoryRepository.listByUser(userId),
          BehaviorRepository.getProfile(userId),
          StorageRepository.listByUser(userId),
        ]);

        return {
          user,
          conversations,
          memories,
          behavior,
          files: files.map((f: any) => ({
            id: f.id,
            filename: f.filename,
            category: f.category,
            sizeBytes: f.sizeBytes,
            createdAt: f.createdAt,
          })),
          exportedAt: new Date().toISOString(),
        };
      }

      case "purge_user_data": {
        const { userId } = payload;
        const files = await StorageRepository.listByUser(userId);
        await WorkerJobRepository.updateCheckpoint(job.id, {
          phase: "deleting_storage_objects",
          totalFiles: files.length,
        });
        for (const file of files) {
          await ObjectStorage.deleteObject(file.id, userId);
        }
        await MemoryRepository.clearAll(userId);
        await BehaviorRepository.saveProfile(userId, { preferences: {}, patterns: {}, stats: {} });

        await AuditRepository.logAction({
          adminUserId: userId,
          action: "GDPR_ACCOUNT_PURGE",
          resourceType: "user",
          resourceId: userId,
          details: { purgedFilesCount: files.length },
        });

        return { success: true, purgedFiles: files.length };
      }

      case "agent_task_execution": {
        const { taskId, userRequest, userId, projectId, resumeFromCheckpoint } = payload;
        const { runAgentRuntime } = await import("@/lib/agent/agentRuntime");
        await WorkerJobRepository.updateCheckpoint(job.id, {
          phase: "delegated_to_agent_runtime",
          taskId,
          at: Date.now(),
        });
        const result = await runAgentRuntime({
          taskId,
          resumeTaskId: resumeFromCheckpoint ? taskId : undefined,
          prompt: userRequest || "",
          userId: userId || "default_user",
          projectId,
          channel: "api",
        });
        return {
          taskId: result.taskId,
          status: result.status,
          iteration: result.state.iteration,
        };
      }

      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  public async getJobStatusAsync(jobId: string, userId?: string): Promise<BackgroundJob | null> {
    const row = await WorkerJobRepository.getById(jobId, userId);
    if (!row) return null;
    return {
      id: row.id,
      type: row.type,
      payload: row.payload,
      status: row.status as BackgroundJob["status"],
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      checkpoint: row.checkpoint || {},
      result: row.result,
      error: row.error,
      createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : Number(row.createdAt || Date.now()),
      processedAt: row.startedAt instanceof Date ? row.startedAt.getTime() : undefined,
    };
  }

  public async cancelJob(jobId: string, userId?: string) {
    return WorkerJobRepository.cancelJob(jobId, userId);
  }

  public async resumeJob(jobId: string, userId?: string) {
    const resumed = await WorkerJobRepository.resumeJob(jobId, userId);
    if (resumed) {
      setImmediate(() => {
        this.processNext().catch(() => {});
      });
    }
    return resumed;
  }
}

export const WorkerQueue = new BackgroundWorkerQueue();
