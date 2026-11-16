/**
 * SoufAI Nexus Engine — Persistent Memory, Fail-Loud Checkpoints & Recovery Manager
 *
 * Integrates strictly with Turso / libSQL via AgentRepository, NexusRepository,
 * and MemoryService. Keeps database persistence cleanly separated from WorkerQueue.
 *
 * Core Guarantee: NEVER report checkpoint success if Turso persistence fails.
 */

import { AgentRepository, NexusRepository, type AgentTaskLease } from "@/lib/db";
import { getUserMemories } from "@/lib/memory/memoryService";
import { serverErrorManager } from "@/lib/errors/errorManager";
import type {
  NexusCheckpointEnvelope,
  NexusCheckpointSaveResult,
  NexusDelegationRecord,
  NexusEvaluationTrace,
} from "./types";

export class NexusPersistenceManager {
  /**
   * Loads user & project-scoped long-term memory snippets without cross-user leakage.
   */
  public async loadProjectContext(params: {
    userId: string;
    projectId?: string;
    maxItems?: number;
  }): Promise<{ memoriesSummary: string; itemCount: number }> {
    if (!params.userId || params.userId === "anonymous") {
      return { memoriesSummary: "", itemCount: 0 };
    }
    const all = await getUserMemories(params.userId);
    const filtered = all
      .filter((m) => m.enabled && m.status === "active")
      .filter((m) => !params.projectId || !m.projectId || m.projectId === params.projectId)
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, params.maxItems ?? 8);

    if (filtered.length === 0) {
      return { memoriesSummary: "", itemCount: 0 };
    }

    const lines = filtered.map(
      (m) => `- [${m.type}${m.projectName ? `/${m.projectName}` : ""}]: ${m.content}`
    );
    return {
      memoriesSummary: lines.join("\n"),
      itemCount: filtered.length,
    };
  }

  /**
   * Persists a strict checkpoint envelope into Turso.
   * Returns { persisted: false, error } on failure — NEVER fakes success.
   */
  public async saveCheckpointStrict(
    envelope: NexusCheckpointEnvelope,
    lease: AgentTaskLease
  ): Promise<NexusCheckpointSaveResult> {
    try {
      const saved = await AgentRepository.saveCheckpoint(
        envelope.taskId,
        envelope.stepNumber,
        envelope.stepName,
        envelope,
        lease
      );
      if (!saved?.id) {
        return {
          persisted: false,
          stepNumber: envelope.stepNumber,
          error: "Turso checkpoint write returned empty acknowledgment.",
        };
      }
      return {
        persisted: true,
        checkpointId: saved.id,
        stepNumber: envelope.stepNumber,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      try {
        serverErrorManager.recordError({
          title: "Nexus Checkpoint Persistence Failure",
          message: `Task ${envelope.taskId} step ${envelope.stepNumber}: ${errMsg}`,
          category: "database",
          severity: "high",
          stackTrace: err?.stack,
        });
      } catch (loggingError) {
        console.error("[NexusPersistenceManager.saveCheckpointStrict] error logging failed:", loggingError);
      }
      return {
        persisted: false,
        stepNumber: envelope.stepNumber,
        error: errMsg,
      };
    }
  }

  /**
   * Loads latest checkpoint envelope for idempotent resumption.
   */
  public async loadLatestCheckpoint(taskId: string): Promise<NexusCheckpointEnvelope | null> {
    const latest = await AgentRepository.getLatestCheckpoint(taskId);
    if (!latest?.state) return null;
    const raw = latest.state as Record<string, any>;
    if (raw.version === "nexus_cp_v1") {
      return raw as NexusCheckpointEnvelope;
    }
    // Upgrade legacy SoufAIEngine checkpoint seamlessly for backward-compatible resume
    return {
      version: "nexus_cp_v1",
      taskId,
      stepNumber: latest.stepNumber || 0,
      stepName: latest.stepName || "legacy_checkpoint",
      completedOperationKeys: Array.isArray(raw.completedOperationKeys)
        ? raw.completedOperationKeys
        : [],
      plan: raw.plan,
      sharedContext: {
        planJson: raw.planJson,
        designOutput: raw.designOutput,
        researchOutput: raw.researchOutput,
        codingRes: raw.codingRes,
      },
      delegations: Array.isArray(raw.delegations) ? raw.delegations : [],
      activeAgents: Array.isArray(raw.activeAgents) ? raw.activeAgents : [],
      skillsUsed: Array.isArray(raw.skillsUsed) ? raw.skillsUsed : [],
      filesChanged: Array.isArray(raw.filesChanged) ? raw.filesChanged : [],
      sandboxId: raw.sandboxId,
      qualityReport: raw.qualityReport,
      visionEvaluation: raw.visionEvaluation,
      savedAt:
        latest.createdAt instanceof Date
          ? latest.createdAt.toISOString()
          : new Date().toISOString(),
    };
  }

  public async recordDelegation(
    record: NexusDelegationRecord,
    lease: AgentTaskLease
  ): Promise<void> {
    await NexusRepository.recordDelegation({
      id: record.id,
      taskId: record.taskId,
      lease,
      subtaskId: record.subtaskId,
      parentAgentId: record.parentAgentId,
      targetAgentId: record.targetAgentId,
      depth: record.depth,
      reason: record.reason,
      status: record.status,
      inputSummary: record.inputSummary,
      outputSummary: record.outputSummary,
      blockedReason: record.blockedReason,
      durationMs: record.durationMs,
      completedAt:
        record.status === "completed" || record.status === "failed" || record.status === "blocked"
          ? new Date()
          : null,
    });
  }

  public async recordSkillActivations(
    taskId: string,
    agentId: string,
    activations: Array<{
      skillId: string;
      version: string;
      relevanceScore: number;
      reason: string;
      estimatedTokens: number;
    }>,
    lease?: AgentTaskLease,
    subtaskId?: string
  ): Promise<void> {
    if (!activations || activations.length === 0) return;
    await NexusRepository.recordSkillActivations(
      activations.map((a) => ({
        taskId,
        subtaskId,
        agentId,
        skillId: a.skillId,
        skillVersion: a.version,
        relevanceScore: a.relevanceScore,
        reason: a.reason,
        estimatedTokens: a.estimatedTokens,
        status: "active",
      })),
      lease
    );
  }

  public async recordEvaluationTrace(
    trace: NexusEvaluationTrace,
    lease?: AgentTaskLease
  ): Promise<{ persisted: boolean; error?: string }> {
    try {
      await NexusRepository.recordExecutionTrace({
        id: trace.traceId,
        taskId: trace.taskId,
        lease,
        userId: trace.userId,
        engineMode: trace.engineMode,
        agentId: trace.modelsUsed[0]?.agentId || "orchestrator",
        agentVersion: trace.configSnapshot.engineVersion,
        modelUsed: trace.modelsUsed.map((m) => m.model).join(", ") || "unassigned",
        providerUsed: trace.modelsUsed.map((m) => m.provider).join(", ") || "none",
        routingReason: trace.modelsUsed[0]?.reason,
        skillsUsed: Array.from(new Set(trace.skillsActivated.map((s) => `${s.skillId}@${s.version}`))),
        toolsInvoked: trace.stepsEvidence.flatMap((s) =>
          s.toolsExecuted.map((t) => ({ stepId: s.stepId, agentId: s.agentId, ...t }))
        ),
        delegationsCount: trace.delegations.length,
        checkpointId: trace.lastCheckpointId,
        completedStepKeys: trace.completedOperationKeys,
        evidence: {
          stepsEvidence: trace.stepsEvidence,
          errors: trace.errors,
          checkpointPersisted: trace.checkpointPersisted,
        },
        costEstimateUsd: trace.estimatedCostUsd,
        latencyMs: trace.totalDurationMs,
        status: trace.status,
        errorSummary: trace.errors.map((e) => e.message).slice(0, 3).join(" | ") || undefined,
        configSnapshot: trace.configSnapshot,
      });
      return { persisted: true };
    } catch (err: any) {
      return { persisted: false, error: err?.message || String(err) };
    }
  }
}

export const nexusPersistenceManager = new NexusPersistenceManager();
