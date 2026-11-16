/**
 * SoufAI Nexus Engine — Canonical Multi-Agent Operating System Orchestrator
 *
 * Unifies:
 * - Dynamic central planning (NexusPlanner)
 * - Capability-matched multi-agent DAG execution (parallel & sequential waves)
 * - Controlled agent-to-agent delegation (depth, active-agent, cycle & escalation guards)
 * - Centralized Agent Registry & on-demand Skills Framework
 * - Intelligent Capability-Based Model Routing
 * - Strict Security & Tool Authorization
 * - Fail-loud Turso/libSQL Checkpointing & Idempotent Recovery
 * - Evaluation Trace Separation (NexusEvaluationTrace)
 */

import { AgentRepository, type AgentTaskLease } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { SandboxManager } from "@/lib/sandbox/sandboxManager";
import { nexusAgentRegistry } from "./agentRegistry";
import { nexusSecurityController } from "./securityController";
import { nexusPersistenceManager } from "./persistenceManager";
import { nexusToolBridge } from "./toolBridge";
import { nexusPlanner } from "./planner";
import { dispatchNexusAgent } from "./workers";
import { activeNexusRunRegistry, activeRunOwnsLease } from "./activeRunRegistry";
import {
  assertValidTaskTransition,
  decideNexusTaskCompletion,
  type NexusTaskLifecycleState,
} from "./taskLifecycle";
import type {
  AgentWorkerType,
  QualityReport,
  RealAgentEvent,
  VisionEvaluation,
} from "../engine/types";
import type {
  NexusCheckpointEnvelope,
  NexusDelegationRecord,
  NexusEvaluationTrace,
  NexusExecutionBudget,
  NexusExecutionContext,
  NexusExecutionPlan,
  NexusPermission,
  NexusRunRequest,
  NexusRunResult,
  NexusStepEvidence,
} from "./types";

const ENGINE_VERSION = "nexus-1.0.0";
const TASK_CANCELLED_REASON = "NEXUS_TASK_CANCELLED";

function sanitizeNexusTelemetryText(value: string, userPrompt: string): string {
  let sanitized = value;
  const prompt = userPrompt.trim();
  if (prompt) sanitized = sanitized.split(prompt).join("[redacted user prompt]");
  return sanitized
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[redacted key]")
    .replace(/\b(api[_ -]?key|token|password|secret|authorization)\s*[:=]\s*["']?[^"'\s,;]+/gi, "$1=[redacted]")
    .slice(0, 1000);
}

type EventCallback = (event: RealAgentEvent) => void;
const activeTaskListeners: Map<string, Set<EventCallback>> = new Map();
const activeRuns = activeNexusRunRegistry;

function resolveBudget(request: NexusRunRequest): NexusExecutionBudget {
  const tier = request.budgetTier || "auto";
  const base: NexusExecutionBudget =
    tier === "quick"
      ? {
          maxTotalSteps: 6,
          maxDelegationDepth: 1,
          maxActiveAgents: 5,
          maxConcurrentTasks: 2,
          leaseDurationMs: 180_000,
          leaseHeartbeatIntervalMs: 60_000,
          maxTokensBudget: 32000,
          maxToolCalls: 20,
          maxRetriesPerStep: 1,
          stepTimeoutMs: 60000,
          taskTimeoutMs: 180000,
        }
      : tier === "deep"
      ? {
          maxTotalSteps: 14,
          maxDelegationDepth: 3,
          maxActiveAgents: 10,
          maxConcurrentTasks: 4,
          leaseDurationMs: 180_000,
          leaseHeartbeatIntervalMs: 60_000,
          maxTokensBudget: 160000,
          maxToolCalls: 80,
          maxRetriesPerStep: 2,
          stepTimeoutMs: 180000,
          taskTimeoutMs: 600000,
        }
      : {
          maxTotalSteps: request.maxSteps || 10,
          maxDelegationDepth: 2,
          maxActiveAgents: 8,
          maxConcurrentTasks: 3,
          leaseDurationMs: 180_000,
          leaseHeartbeatIntervalMs: 60_000,
          maxTokensBudget: 96000,
          maxToolCalls: 50,
          maxRetriesPerStep: 2,
          stepTimeoutMs: 120000,
          taskTimeoutMs: 360000,
        };

  const resolved: NexusExecutionBudget = {
    ...base,
    ...(request.budget || {}),
  };
  if (
    !Number.isFinite(resolved.leaseDurationMs) ||
    resolved.leaseDurationMs < 1_000 ||
    !Number.isFinite(resolved.leaseHeartbeatIntervalMs) ||
    resolved.leaseHeartbeatIntervalMs <= 0 ||
    resolved.leaseHeartbeatIntervalMs >= resolved.leaseDurationMs
  ) {
    throw new Error("Nexus lease duration and heartbeat interval are invalid.");
  }
  return resolved;
}

export class SoufAINexusEngine {
  public static subscribeToTaskEvents(taskId: string, cb: EventCallback): () => void {
    if (!activeTaskListeners.has(taskId)) {
      activeTaskListeners.set(taskId, new Set());
    }
    activeTaskListeners.get(taskId)!.add(cb);
    return () => {
      activeTaskListeners.get(taskId)?.delete(cb);
      if (activeTaskListeners.get(taskId)?.size === 0) {
        activeTaskListeners.delete(taskId);
      }
    };
  }

  public static async stopTask(
    taskId: string,
    userId?: string
  ): Promise<{ success: boolean; message: string }> {
    const task = await AgentRepository.getTask(taskId, userId);
    if (!task) {
      return { success: false, message: "المهمة غير نشطة أو غير موجودة" };
    }

    const activeRun = activeRuns.get(taskId);
    const activeLeaseMatches = activeRunOwnsLease(activeRun, task);
    const controller = activeLeaseMatches ? activeRun?.controller : undefined;
    const sandboxId = activeLeaseMatches ? activeRun?.sandboxId : undefined;
    controller?.abort(new Error(TASK_CANCELLED_REASON));

    let cancelled = false;
    let cancellationError: unknown = null;
    try {
      cancelled = await AgentRepository.cancelTask(taskId, userId);
    } catch (error) {
      cancellationError = error;
    }
    let sandboxStopError: unknown = null;
    if (sandboxId) {
      try {
        SandboxManager.stopSandbox(sandboxId);
      } catch (e) {
        sandboxStopError = e;
        console.error("[NexusEngine.stopTask] Failed to stop sandbox:", e);
      }
    }

    if (cancellationError) throw cancellationError;
    if (!cancelled) {
      return { success: false, message: "تعذر إلغاء المهمة لأنها لم تعد نشطة." };
    }

    return {
      success: !sandboxStopError,
      message: sandboxStopError
        ? "تم إلغاء المهمة، لكن تعذر إيقاف بيئة التنفيذ بالكامل."
        : controller
        ? "تم إيقاف مهمة الوكيل بنجاح"
        : "تم تحديث حالة المهمة إلى ملغية",
    };
  }

  public static async resumeTask(taskId: string, userId?: string): Promise<NexusRunResult> {
    const saved = activeRuns.get(taskId)?.request;
    const task = await AgentRepository.getTask(taskId, userId);
    if (!task) {
      throw new Error(`المهمة ${taskId} غير موجودة لاستئنافها.`);
    }

    return SoufAINexusEngine.run({
      taskId,
      resumeTaskId: taskId,
      userPrompt: saved?.userPrompt || task.goal,
      userId: saved?.userId || task.userId,
      projectId: (saved?.projectId || task.projectId) ?? undefined,
      sandboxId: saved?.sandboxId || (task.metadata as any)?.sandboxId || undefined,
      taskType: saved?.taskType || task.category,
      budgetTier: (saved?.budgetTier || (task.budgetTier as any)) ?? "auto",
      budgetMode: saved?.budgetMode,
      channel: saved?.channel,
      preferredAgents: saved?.preferredAgents,
      requiredSkills: saved?.requiredSkills,
    });
  }

  public static async run(request: NexusRunRequest): Promise<NexusRunResult> {
    const startTime = Date.now();
    const taskId =
      request.resumeTaskId ||
      request.taskId ||
      `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const workerLeaseId = `nexus_${process.pid}_${randomUUID()}`;
    const workerLeaseToken = randomUUID();
    const runId = randomUUID();
    const channel = request.channel || "web";
    const budget = resolveBudget(request);

    const abortController = new AbortController();
    let cancellationRequested = false;
    const onRequestAbort = () => {
      cancellationRequested = true;
      abortController.abort(request.signal?.reason);
    };
    if (request.signal?.aborted) {
      onRequestAbort();
    } else {
      request.signal?.addEventListener("abort", onRequestAbort, { once: true });
    }

    const events: RealAgentEvent[] = [];
    const filesChangedSet = new Set<string>();
    const stepsEvidence: NexusStepEvidence[] = [];
    const delegations: NexusDelegationRecord[] = [];
    const skillsActivatedTrace: NexusEvaluationTrace["skillsActivated"] = [];
    const modelsUsedTrace: NexusEvaluationTrace["modelsUsed"] = [];
    const traceErrors: NexusEvaluationTrace["errors"] = [];
    const completedOperationKeys = new Set<string>();
    const activeAgentsCount = { count: 1 }; // orchestrator counts as 1
    const toolCallCounter = { count: 0 };

    let checkpointPersisted = false;
    let lastCheckpointId: string | undefined;
    let currentStep = 0;
    let taskLease: AgentTaskLease | null = null;
    let restoredSandboxId = request.sandboxId;
    let leaseOwned = false;
    let deadlineExceeded = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    let taskDeadlineTimer: ReturnType<typeof setTimeout> | undefined;
    let leaseRenewalInFlight: Promise<boolean> | null = null;

    const clearExecutionTimers = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (taskDeadlineTimer) clearTimeout(taskDeadlineTimer);
      heartbeatTimer = undefined;
      taskDeadlineTimer = undefined;
    };
    const cleanupActiveRun = () => activeRuns.delete(taskId, runId);

    if (abortController.signal.aborted) {
      request.signal?.removeEventListener("abort", onRequestAbort);
      return {
        taskId,
        goal: request.userPrompt,
        status: "cancelled",
        summary: "أُلغيت المهمة قبل الحصول على Lease.",
        finalResponse: "أُلغيت المهمة قبل بدء التنفيذ.",
        filesChanged: [],
        totalDurationMs: Date.now() - startTime,
        stepsExecuted: 0,
        events,
        checkpointPersisted: false,
      };
    }

    // Input prompt guardrail inspection
    const inputVerdict = nexusSecurityController.inspectInputPrompt(request.userPrompt);
    if (!inputVerdict.safe) {
      request.signal?.removeEventListener("abort", onRequestAbort);
      return {
        taskId,
        goal: request.userPrompt,
        status: "failed",
        summary: "Blocked by Nexus Security Guardrail",
        finalResponse: inputVerdict.reason || "Prompt rejected by security guardrail.",
        filesChanged: [],
        totalDurationMs: Date.now() - startTime,
        stepsExecuted: 0,
        events,
        checkpointPersisted: false,
      };
    }

    const emitEvent = async (
      eventType: string,
      title: string,
      opts?: {
        agentWorker?: AgentWorkerType;
        summary?: string;
        status?: "running" | "completed" | "failed" | "warning";
        payload?: Record<string, any>;
        persistAfterLeaseRelease?: boolean;
      }
    ) => {
      const evt: RealAgentEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        taskId,
        eventType,
        agentWorker: opts?.agentWorker || "orchestrator",
        title,
        summary: opts?.summary,
        status: opts?.status || "running",
        payload: opts?.payload || {},
        timestamp: new Date().toISOString(),
      };
      events.push(evt);

      if (!taskLease || leaseOwned || opts?.persistAfterLeaseRelease) {
        await AgentRepository.logEvent({
          id: evt.id,
          taskId: evt.taskId,
          lease: leaseOwned ? taskLease || undefined : undefined,
          eventType: evt.eventType,
          agentWorker: evt.agentWorker,
          title: evt.title,
          summary: evt.summary,
          status: evt.status,
          payload: evt.payload,
        });
      }

      const subs = activeTaskListeners.get(taskId);
      if (subs) {
        subs.forEach((cb) => {
          try {
            cb(evt);
          } catch (listenerError) {
            console.error("[NexusEngine.emitEvent] task event listener failed:", listenerError);
          }
        });
      }
    };

    const logToolCall = async (
      toolName: string,
      agentWorker: AgentWorkerType,
      args: any,
      result: any,
      durationMs: number,
      status: "success" | "failed" = "success"
    ) => {
      await AgentRepository.logToolCall({
        taskId,
        lease: requireTaskLease(),
        toolName,
        agentWorker,
        args: { keys: Object.keys(args || {}).slice(0, 32) },
        result: { status },
        durationMs,
        status,
      });
    };

    // Task record & atomic Turso Claim/Lease
    let existingTask: Awaited<ReturnType<typeof AgentRepository.getTask>> | null = null;
    let taskLifecycleState: NexusTaskLifecycleState = "pending";
    let restoredCheckpoint: NexusCheckpointEnvelope | null = null;
    try {
      existingTask = await AgentRepository.getTask(taskId, request.userId);
      taskLifecycleState = (existingTask?.status as NexusTaskLifecycleState) || "pending";

      if (abortController.signal.aborted) {
        throw abortController.signal.reason instanceof Error
          ? abortController.signal.reason
          : new Error("Nexus task execution was aborted before acquiring a lease.");
      }
      if (!existingTask) {
        await AgentRepository.createTask({
          id: taskId,
          userId: request.userId,
          projectId: request.projectId,
          goal: request.userPrompt,
          category: request.taskType || "full_engineering",
          status: "pending",
          budgetTier: request.budgetTier || "auto",
          maxSteps: budget.maxTotalSteps,
          metadata: {
            engine: "soufai_nexus",
            engineVersion: ENGINE_VERSION,
            channel,
            sandboxId: request.sandboxId || null,
            budgetMode: request.budgetMode || null,
          },
        });
      } else {
        restoredCheckpoint = await nexusPersistenceManager.loadLatestCheckpoint(taskId);
        if (restoredCheckpoint) {
          for (const k of restoredCheckpoint.completedOperationKeys) completedOperationKeys.add(k);
          for (const f of restoredCheckpoint.filesChanged) filesChangedSet.add(f);
          if (restoredCheckpoint.delegations) delegations.push(...restoredCheckpoint.delegations);
          if (restoredCheckpoint.sandboxId) restoredSandboxId = restoredCheckpoint.sandboxId;
        }
      }

      if (abortController.signal.aborted) {
        throw abortController.signal.reason instanceof Error
          ? abortController.signal.reason
          : new Error("Nexus task execution was aborted before acquiring a lease.");
      }
      const claimed = await AgentRepository.claimTask(
        taskId,
        workerLeaseId,
        workerLeaseToken,
        budget.leaseDurationMs
      );
      if (!claimed) {
        throw new Error(`تعذر حجز المهمة '${taskId}'؛ قد تكون غير موجودة أو مملوكة لعامل آخر.`);
      }
      taskLease = {
        workerId: workerLeaseId,
        token: workerLeaseToken,
        generation: claimed.leaseGeneration,
      };
      leaseOwned = true;
      taskLifecycleState = "running";
      activeRuns.register(taskId, {
        runId,
        request,
        controller: abortController,
        lease: taskLease,
        sandboxId: restoredSandboxId,
      });
    } catch (taskSetupError) {
      cleanupActiveRun();
      request.signal?.removeEventListener("abort", onRequestAbort);
      throw taskSetupError;
    }

    const requireTaskLease = (): AgentTaskLease => {
      if (!taskLease) throw new Error(`Task '${taskId}' has no acquired lease.`);
      return taskLease;
    };

    const markLeaseLost = (reason: unknown) => {
      if (!leaseOwned) return;
      leaseOwned = false;
      traceErrors.push({
        code: "LEASE_OWNERSHIP_UNCONFIRMED",
        message: "Lease renewal or a fenced task mutation was rejected; execution was aborted.",
      });
      const abortReason = reason instanceof Error ? reason : new Error(String(reason));
      abortController.abort(abortReason);
      void emitEvent("lease.lost", "فُقدت ملكية المهمة؛ أُوقف التنفيذ الآمن", {
        agentWorker: "orchestrator",
        status: "failed",
        summary: "تم إيقاف أي تحديثات لاحقة بعد تعذر تجديد أو إثبات ملكية الـ lease.",
      }).catch((eventError) => {
        console.error("[NexusEngine.run] lease loss event could not be persisted:", eventError);
      });
    };

    const renewLease = (): Promise<boolean> => {
      if (!taskLease || !leaseOwned) return Promise.resolve(false);
      if (leaseRenewalInFlight) return leaseRenewalInFlight;
      leaseRenewalInFlight = AgentRepository.renewTaskLease(
        taskLease,
        taskId,
        budget.leaseDurationMs
      )
        .then((renewed) => {
          if (!renewed) {
            markLeaseLost(new Error("Task lease renewal was rejected."));
          }
          return renewed;
        })
        .catch((renewalError) => {
          markLeaseLost(renewalError);
          throw renewalError;
        })
        .finally(() => {
          leaseRenewalInFlight = null;
        });
      return leaseRenewalInFlight;
    };

    const ensureLease = async () => {
      if (abortController.signal.aborted) {
        throw abortController.signal.reason instanceof Error
          ? abortController.signal.reason
          : new Error("Nexus task execution was aborted.");
      }
      if (!taskLease || !leaseOwned) {
        throw new Error(`Worker lease for task '${taskId}' is no longer owned.`);
      }
      const renewed = await renewLease();
      if (!renewed) {
        throw new Error(`Worker lease for task '${taskId}' expired or was replaced.`);
      }
    };

    const updateTaskOwnedOrThrow = async (
      expectedStatuses: string[],
      updates: Parameters<typeof AgentRepository.updateTaskOwned>[3]
    ): Promise<void> => {
      try {
        const updated = await AgentRepository.updateTaskOwned(
          taskId,
          requireTaskLease(),
          expectedStatuses,
          updates
        );
        if (!updated) throw new Error("Fenced task update was rejected.");
      } catch (error) {
        markLeaseLost(error);
        throw error;
      }
    };

    const updateSubtaskOwnedOrThrow = async (
      subtaskId: string,
      updates: Parameters<typeof AgentRepository.updateSubtaskOwned>[3]
    ): Promise<void> => {
      try {
        await AgentRepository.updateSubtaskOwned(taskId, subtaskId, requireTaskLease(), updates);
      } catch (error) {
        markLeaseLost(error);
        throw error;
      }
    };

    heartbeatTimer = setInterval(() => {
      void renewLease().catch((renewalError) => {
        console.error("[NexusEngine.run] lease heartbeat failed:", renewalError);
      });
    }, budget.leaseHeartbeatIntervalMs);
    const remainingTaskTime = Math.max(0, budget.taskTimeoutMs - (Date.now() - startTime));
    taskDeadlineTimer = setTimeout(() => {
      deadlineExceeded = true;
      abortController.abort(new Error("NEXUS_TASK_DEADLINE_EXCEEDED"));
    }, remainingTaskTime);

    const securityPolicy = nexusSecurityController.buildDefaultPolicy(
      request.userId,
      channel,
      request.securityPolicy
    );

    const orchestratorAgent = nexusAgentRegistry.getAgent("orchestrator")!;
    const sharedContext: Record<string, any> = {
      ...(restoredCheckpoint?.sharedContext || {}),
      goal: request.userPrompt,
      sandboxId: restoredSandboxId,
    };

    // Load project-scoped memory context
    let memoryCtx: Awaited<ReturnType<typeof nexusPersistenceManager.loadProjectContext>>;
    try {
      memoryCtx = await nexusPersistenceManager.loadProjectContext({
        userId: request.userId,
        projectId: request.projectId,
      });
    } catch (contextError) {
      try {
        await updateTaskOwnedOrThrow(["running"], {
          status: "recovery_required",
          summary: "Project context could not be loaded; task requires recovery.",
          leaseOwner: null,
          leaseToken: null,
          leaseExpiresAt: null,
        });
      } catch (persistenceError) {
        console.error("[NexusEngine.run] could not persist recovery state:", persistenceError);
      }
      clearExecutionTimers();
      cleanupActiveRun();
      request.signal?.removeEventListener("abort", onRequestAbort);
      throw contextError;
    }
    if (memoryCtx.memoriesSummary) {
      sharedContext.projectMemorySummary = memoryCtx.memoriesSummary;
    }

    let executionPlan: NexusExecutionPlan | undefined = restoredCheckpoint?.plan;

    const persistStrictCheckpoint = async (stepNum: number, stepName: string) => {
      await ensureLease();
      const envelope: NexusCheckpointEnvelope = {
        version: "nexus_cp_v1",
        taskId,
        stepNumber: stepNum,
        stepName,
        completedOperationKeys: Array.from(completedOperationKeys),
        plan: executionPlan,
        sharedContext,
        delegations,
        activeAgents: Array.from(new Set(stepsEvidence.map((s) => s.agentId))),
        skillsUsed: Array.from(new Set(skillsActivatedTrace.map((s) => s.skillId))),
        filesChanged: Array.from(filesChangedSet),
        sandboxId: sharedContext.sandboxId,
        qualityReport: sharedContext.qualityReport,
        visionEvaluation: sharedContext.visionEvaluation,
        savedAt: new Date().toISOString(),
      };

      if (!taskLease) throw new Error("Cannot save a Nexus checkpoint without a task lease.");
      const res = await nexusPersistenceManager.saveCheckpointStrict(envelope, requireTaskLease());
      checkpointPersisted = res.persisted;
      if (res.persisted && res.checkpointId) {
        lastCheckpointId = res.checkpointId;
      } else {
        const safeError = sanitizeNexusTelemetryText(
          res.error || "Failed to persist required task checkpoint.",
          request.userPrompt
        );
        traceErrors.push({
          code: "CHECKPOINT_PERSISTENCE_FAILED",
          message: safeError,
        });
        await emitEvent("checkpoint.failed", "تعذر حفظ نقطة الاستعادة في قاعدة البيانات", {
          agentWorker: "orchestrator",
          status: "warning",
          summary: safeError,
        });
        throw new Error(safeError);
      }
      return res;
    };

    const buildAgentContext = (params: {
      agentId: string;
      workerType: AgentWorkerType;
      subtaskId?: string;
      depth: number;
      callStack: string[];
      effectivePermissions: NexusPermission[];
    }): NexusExecutionContext => {
      const ctx: NexusExecutionContext = {
        taskId,
        subtaskId: params.subtaskId,
        userId: request.userId,
        projectId: request.projectId,
        sandboxId: sharedContext.sandboxId,
        lease: requireTaskLease(),
        signal: abortController.signal,
        emitEvent,
        logToolCall,
        engineMode: "nexus_orchestrator",
        agentId: params.agentId,
        workerTypeCompat: params.workerType,
        channel,
        delegationDepth: params.depth,
        callStack: params.callStack,
        effectivePermissions: params.effectivePermissions,
        budget,
        securityPolicy,
        sharedContext,
        completedOperationKeys,
        invokeTool: async (toolName, args, opts) => {
          const agentDef = nexusAgentRegistry.getAgent(params.agentId) || orchestratorAgent;
          return nexusToolBridge.executeTool({
            toolName,
            args,
            agent: agentDef,
            ctx,
            idempotencyKey: opts?.idempotencyKey,
            timeoutMs: opts?.timeoutMs,
            toolCallCounter,
          });
        },
        delegateToAgent: async (targetAgentId, reason, input) => {
          const delStart = Date.now();
          const delId = `del_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

          const recordAndBlock = async (blockedReason: string) => {
            const rec: NexusDelegationRecord = {
              id: delId,
              taskId,
              subtaskId: params.subtaskId,
              required: true,
              parentAgentId: params.agentId,
              targetAgentId,
              depth: params.depth + 1,
              reason: "Specialist delegation requested.",
              status: "blocked",
              inputSummary: `Input fields: ${Object.keys(input || {}).slice(0, 16).join(", ")}`,
              blockedReason,
              durationMs: Date.now() - delStart,
              createdAt: new Date().toISOString(),
            };
            delegations.push(rec);
            await nexusPersistenceManager.recordDelegation(rec, requireTaskLease());
            return { success: false, blockedReason, error: blockedReason };
          };

          if (params.depth + 1 > budget.maxDelegationDepth) {
            return recordAndBlock(`Max delegation depth (${budget.maxDelegationDepth}) reached.`);
          }
          if (activeAgentsCount.count >= budget.maxActiveAgents) {
            return recordAndBlock(`Max active agents (${budget.maxActiveAgents}) reached.`);
          }
          if (params.callStack.includes(targetAgentId)) {
            return recordAndBlock(`Delegation cycle detected for '${targetAgentId}'.`);
          }
          if (!params.effectivePermissions.includes("agent:delegate")) {
            return recordAndBlock(`Agent '${params.agentId}' lacks 'agent:delegate' permission.`);
          }

          const targetAgent = nexusAgentRegistry.getAgent(targetAgentId);
          if (!targetAgent || !targetAgent.enabled) {
            return recordAndBlock(`Target agent '${targetAgentId}' not found or disabled.`);
          }

          const childPermissions = nexusSecurityController.computeDelegatedPermissions({
            parentPermissions: params.effectivePermissions,
            targetAgent,
            policy: securityPolicy,
          });

          activeAgentsCount.count += 1;
          const childCtx = buildAgentContext({
            agentId: targetAgent.id,
            workerType: targetAgent.workerType,
            subtaskId: params.subtaskId,
            depth: params.depth + 1,
            callStack: [...params.callStack, targetAgent.id],
            effectivePermissions: childPermissions,
          });

          const syntheticNode = {
            id: `${params.subtaskId || "root"}_del_${targetAgent.id}`,
            title: reason,
            description: reason,
            assignedAgentId: targetAgent.id,
            workerType: targetAgent.workerType,
            dependencies: [],
            parallelGroup: 0,
            requiredSkills: targetAgent.requiredSkills,
            routingCriteria: {
              taskComplexity: "medium" as const,
              requiresReasoning: true,
              requiresCoding: targetAgent.id === "coding" || targetAgent.id === "debug",
              requiresVision: targetAgent.id === "vision",
              requiresStructuredOutput: true,
              minContextTokens: targetAgent.contextRequirements.minContextTokens,
              latencyPreference: "balanced" as const,
              costSensitivity: "standard" as const,
              preferredTiers: targetAgent.preferredModels,
              fallbackTiers: targetAgent.fallbackModels,
            },
            inputArgs: input,
            idempotencyKey: `${taskId}:del:${params.agentId}->${targetAgent.id}:${Date.now()}`,
            maxRetries: 1,
            timeoutMs: budget.stepTimeoutMs,
            status: "running" as const,
          };

          let outcome: Awaited<ReturnType<typeof dispatchNexusAgent>>;
          try {
            outcome = await dispatchNexusAgent({
              agent: targetAgent,
              node: syntheticNode,
              ctx: childCtx,
            });
          } finally {
            activeAgentsCount.count -= 1;
          }

          const rec: NexusDelegationRecord = {
            id: delId,
            taskId,
            subtaskId: params.subtaskId,
            required: true,
            parentAgentId: params.agentId,
            targetAgentId: targetAgent.id,
            depth: params.depth + 1,
            reason: "Specialist delegation requested.",
            status: outcome.success ? "completed" : "failed",
            inputSummary: `Input fields: ${Object.keys(input || {}).slice(0, 16).join(", ")}`,
            outputSummary: `Output fields: ${Object.keys(outcome.output || {}).slice(0, 16).join(", ")}`,
            durationMs: Date.now() - delStart,
            createdAt: new Date().toISOString(),
          };
          delegations.push(rec);
          await nexusPersistenceManager.recordDelegation(rec, requireTaskLease());

          return {
            success: outcome.success,
            output: outcome.output,
            error: outcome.error,
          };
        },
      };

      return ctx;
    };

    try {
      await ensureLease();
      await emitEvent(
        "agent.started",
        restoredCheckpoint
          ? `استئناف SoufAI Nexus Engine من نقطة الاستعادة (${restoredCheckpoint.stepName})`
          : "بدء تشغيل محرك SoufAI Nexus Engine الموحد",
        {
          agentWorker: "orchestrator",
          status: "running",
          summary: "بدأ التنفيذ بعد تحميل سياق المهمة والتحقق من ملكية lease.",
        }
      );

      // 1. Dynamic Planning (skip if already checkpointed cleanly)
      currentStep = 1;
      if (!executionPlan) {
        await emitEvent("agent.reasoning", "تحليل الهدف وهندسة خطة الوكلاء الديناميكية (DAG)", {
          agentWorker: "orchestrator",
          status: "running",
        });

        const planned = await nexusPlanner.createPlan({
          taskId,
          goal: request.userPrompt,
          taskType: request.taskType,
          projectMemorySummary: sharedContext.projectMemorySummary,
          budget,
          signal: abortController.signal,
          explicitAgents: request.preferredAgents,
          explicitSkills: request.requiredSkills,
        });
        executionPlan = planned.plan;
        if (planned.routingDecision) {
          modelsUsedTrace.push({
            agentId: "orchestrator",
            tier: "core",
            ...planned.routingDecision,
          });
        }
        sharedContext.framework = executionPlan.framework;
        sharedContext.themeArchetype = executionPlan.themeArchetype;

        for (const n of executionPlan.nodes) {
          await AgentRepository.createSubtask({
            id: `${taskId}_${n.id}`,
            taskId,
            title: n.title,
            agentWorker: n.workerType,
            status: "pending",
            dependencies: n.dependencies,
            parallelGroup: n.parallelGroup,
            inputArgs: n.inputArgs,
          }, requireTaskLease());
        }

        assertValidTaskTransition(taskLifecycleState, "executing");
        await updateTaskOwnedOrThrow(["running"], {
          plan: executionPlan.nodes.map((n) => `[${n.assignedAgentId}] ${n.title}`),
          activeAgents: executionPlan.requiredCapabilities,
          status: "executing",
          currentStep: 1,
        });
        taskLifecycleState = "executing";

        await emitEvent("agent.plan.created", "تم اعتماد خطة التنفيذ وتعيين الوكلاء والمهارات", {
          agentWorker: "orchestrator",
          status: "completed",
          summary: executionPlan.nodes.map((n) => `${n.assignedAgentId}: ${n.title}`).join(" ➔ "),
          payload: {
            plan: executionPlan.nodes.map((n) => n.title),
            completionCriteria: executionPlan.completionCriteria,
            skills: executionPlan.selectedSkills,
          },
        });

        await persistStrictCheckpoint(1, "nexus_plan_created");
      }

      if (taskLifecycleState === "running") {
        assertValidTaskTransition(taskLifecycleState, "executing");
        await updateTaskOwnedOrThrow(["running"], {
          status: "executing",
          currentStep: currentStep || 1,
        });
        taskLifecycleState = "executing";
      }

      // Restore node completion flags from idempotent keys
      for (const n of executionPlan.nodes) {
        if (completedOperationKeys.has(`subtask:${n.id}`)) {
          n.status = "completed";
        }
      }

      // 2. Dynamic DAG Execution Loop
      const orchestratorEffectivePermissions = securityPolicy.grantedPermissions.filter((p) =>
        orchestratorAgent.permissionBoundaries.includes(p)
      );

      while (
        executionPlan.nodes.some((n) => n.status === "pending") &&
        currentStep < budget.maxTotalSteps
      ) {
        if (abortController.signal.aborted) {
          for (const n of executionPlan.nodes) {
            if (n.status === "pending") n.status = "skipped";
          }
          break;
        }

        if (Date.now() - startTime > budget.taskTimeoutMs) {
          traceErrors.push({
            code: "TASK_TIMEOUT_EXCEEDED",
            message: `Task exceeded configured timeout (${budget.taskTimeoutMs}ms).`,
          });
          break;
        }

        const readyNodes = executionPlan.nodes.filter((n) => {
          if (n.status !== "pending") return false;
          return n.dependencies.every((depId) => {
            const parent = executionPlan!.nodes.find((p) => p.id === depId);
            return parent?.status === "completed";
          });
        });

        if (readyNodes.length === 0) {
          // Deadlock / upstream failure prevented remaining nodes
          for (const n of executionPlan.nodes) {
            if (n.status === "pending") {
              n.status = "skipped";
              n.error = "Upstream dependency failed or unresolved";
            }
          }
          break;
        }

        const waveBatch = readyNodes.slice(0, budget.maxConcurrentTasks);
        currentStep += 1;

        if (waveBatch.length > 1) {
          await emitEvent("agent.parallel.started", `تشغيل ${waveBatch.length} وكلاء بالتوازي`, {
            agentWorker: "orchestrator",
            status: "running",
            summary: waveBatch.map((n) => `[${n.assignedAgentId}] ${n.title}`).join(" | "),
          });
        }

        await ensureLease();
        const wavePromises = waveBatch.map(async (node) => {
          const agentDef = nexusAgentRegistry.getAgent(node.assignedAgentId);
          if (!agentDef || !agentDef.enabled) {
            node.status = "failed";
            node.error = `Agent '${node.assignedAgentId}' unavailable`;
            await updateSubtaskOwnedOrThrow(`${taskId}_${node.id}`, {
              status: "failed",
              error: node.error,
              completedAt: new Date(),
            });
            return;
          }

          if (completedOperationKeys.has(`subtask:${node.id}`)) {
            node.status = "completed";
            return;
          }

          node.status = "running";
          const dbSubtaskId = `${taskId}_${node.id}`;
          await ensureLease();
          await updateSubtaskOwnedOrThrow(dbSubtaskId, {
            status: "running",
            startedAt: new Date(),
          });

          await emitEvent("agent.subtask.started", `بدء: ${node.title}`, {
            agentWorker: node.workerType,
            status: "running",
          });

          const childPermissions = nexusSecurityController.computeDelegatedPermissions({
            parentPermissions: orchestratorEffectivePermissions,
            targetAgent: agentDef,
            policy: securityPolicy,
          });

          const subCtx = buildAgentContext({
            agentId: agentDef.id,
            workerType: agentDef.workerType,
            subtaskId: node.id,
            depth: 0,
            callStack: [agentDef.id],
            effectivePermissions: childPermissions,
          });

          const nodeStart = Date.now();
          let attempt = 0;
          let outcome: Awaited<ReturnType<typeof dispatchNexusAgent>> | null = null;

          while (attempt <= node.maxRetries) {
            await ensureLease();
            attempt += 1;
            outcome = await dispatchNexusAgent({ agent: agentDef, node, ctx: subCtx });
            if (outcome.success) break;
          }

          node.durationMs = Date.now() - nodeStart;
          if (abortController.signal.aborted) {
            node.status = "skipped";
            node.error = "Task cancelled before the worker result could be committed.";
            return;
          }
          await ensureLease();
          if (outcome?.success) {
            node.status = "completed";
            node.outputResult = outcome.output;
            completedOperationKeys.add(`subtask:${node.id}`);
            for (const art of outcome.artifactsProduced) filesChangedSet.add(art);
            if (sharedContext.sandboxId) {
              activeRuns.updateSandbox(taskId, runId, sharedContext.sandboxId);
            }

            if (outcome.modelUsed) {
              modelsUsedTrace.push({
                agentId: agentDef.id,
                tier: node.routingCriteria.preferredTiers?.[0] || "core",
                model: outcome.modelUsed,
                provider: outcome.providerUsed || "unknown",
                reason: outcome.routingReason || "nexus_routing",
              });
            }
            for (const sk of outcome.skillsLoaded) {
              skillsActivatedTrace.push({
                skillId: sk,
                version: "1.0.0",
                agentId: agentDef.id,
                tokens: 150,
              });
            }
            stepsEvidence.push({
              stepId: node.id,
              agentId: agentDef.id,
              agentVersion: agentDef.version,
              status: "completed",
              durationMs: node.durationMs,
              modelUsed: outcome.modelUsed,
              providerUsed: outcome.providerUsed,
              skillsLoaded: outcome.skillsLoaded,
              toolsExecuted: [],
              artifactsProduced: outcome.artifactsProduced,
              verificationPassed:
                node.assignedAgentId === "verification" ? Boolean(outcome.output?.isVerified) : undefined,
            });

            await updateSubtaskOwnedOrThrow(dbSubtaskId, {
              status: "completed",
              outputResult: node.outputResult,
              durationMs: node.durationMs,
              completedAt: new Date(),
            });

            await emitEvent("agent.subtask.completed", `اكتمل: ${node.title}`, {
              agentWorker: node.workerType,
              status: "completed",
              summary: `${node.durationMs}ms`,
            });
          } else {
            node.status = "failed";
            node.error = outcome?.error || "Subtask failed";
            traceErrors.push({
              stepId: node.id,
              agentId: agentDef.id,
              code: "SUBTASK_FAILED",
              message: node.error,
            });
            stepsEvidence.push({
              stepId: node.id,
              agentId: agentDef.id,
              agentVersion: agentDef.version,
              status: "failed",
              durationMs: node.durationMs,
              skillsLoaded: outcome?.skillsLoaded || [],
              toolsExecuted: [],
              artifactsProduced: outcome?.artifactsProduced || [],
              error: node.error,
            });

            await updateSubtaskOwnedOrThrow(dbSubtaskId, {
              status: "failed",
              error: node.error,
              durationMs: node.durationMs,
              completedAt: new Date(),
            });

            await emitEvent("agent.subtask.failed", `تعثر: ${node.title}`, {
              agentWorker: node.workerType,
              status: "failed",
              summary: sanitizeNexusTelemetryText(node.error, request.userPrompt),
            });
          }
        });

        const waveResults = await Promise.allSettled(wavePromises);
        const rejectedResult = waveResults.find(
          (result): result is PromiseRejectedResult => result.status === "rejected"
        );
        if (rejectedResult) {
          throw rejectedResult.reason;
        }
        await persistStrictCheckpoint(currentStep, `wave_${currentStep}_completed`);
      }

      // 3. Consolidate Results & Evidence
      const sandbox = sharedContext.sandboxId
        ? SandboxManager.getSandbox(sharedContext.sandboxId)
        : null;
      const previewUrl = sandbox?.previewUrl;
      const qualityReport: QualityReport | undefined = sharedContext.qualityReport;
      const visionEvaluation: VisionEvaluation | undefined = sharedContext.visionEvaluation;

      const completedCount = executionPlan.nodes.filter((n) => n.status === "completed").length;
      const finalResponse = nexusSecurityController.sanitizeOutput(
        `### تقرير تنفيذ Nexus\n\n- المهام الفرعية المكتملة: ${completedCount}/${executionPlan.nodes.length}.\n- الملفات المتأثرة: ${filesChangedSet.size}.${qualityReport ? `\n- تقرير الجودة: ${qualityReport.score}/100 (${qualityReport.build}).` : ""}${sharedContext.architectureBlueprint?.blueprintSummary ? `\n- المعمارية: ${sharedContext.architectureBlueprint.blueprintSummary}` : ""}${sharedContext.documentationOutput ? `\n\n${sharedContext.documentationOutput}` : ""}`
      );
      sharedContext.finalResponse = finalResponse;
      await persistStrictCheckpoint(currentStep + 1, "nexus_finalizing");

      const completionDecision = decideNexusTaskCompletion({
        nodes: executionPlan.nodes.map((node) => ({
          id: node.id,
          agentId: node.assignedAgentId,
          dependencies: node.dependencies,
          required: node.required,
          status: node.status,
          verificationPassed:
            node.assignedAgentId === "verification"
              ? stepsEvidence.find((step) => step.stepId === node.id)?.verificationPassed
              : undefined,
          outputResult: node.outputResult,
        })),
        delegations,
        finalResponse,
        checkpointPersisted,
        persistenceFailed: traceErrors.some((error) =>
          error.code.includes("PERSISTENCE_FAILED")
        ),
        leaseOwned,
        cancelled:
          !deadlineExceeded &&
          (cancellationRequested ||
            (abortController.signal.reason instanceof Error &&
              abortController.signal.reason.message === TASK_CANCELLED_REASON)),
        timedOut: deadlineExceeded || Date.now() - startTime > budget.taskTimeoutMs,
      });
      for (const reason of completionDecision.reasons) {
        traceErrors.push({ code: "COMPLETION_POLICY_REJECTED", message: reason });
      }

      const finalStatus = completionDecision.status;
      assertValidTaskTransition(taskLifecycleState, finalStatus);
      const finalSummary =
        finalStatus === "completed"
          ? `تم إكمال جميع الأعمال المطلوبة (${completedCount}/${executionPlan.nodes.length}).`
          : finalStatus === "partial"
          ? `اكتملت الأعمال المطلوبة مع تعذر بعض الأعمال الاختيارية (${completedCount}/${executionPlan.nodes.length}).`
          : `لم تُعتمد المهمة كناجحة؛ الحالة النهائية: ${finalStatus}.`;
      const totalDurationMs = Date.now() - startTime;

      const evaluationTrace: NexusEvaluationTrace = {
        traceId: `trace_${taskId}_${Date.now()}`,
        taskId,
        userId: request.userId,
        engineMode: "nexus_orchestrator",
        goal: request.userPrompt,
        status: finalStatus,
        stepsEvidence: stepsEvidence.map((step) =>
          step.error
            ? { ...step, error: sanitizeNexusTelemetryText(step.error, request.userPrompt) }
            : step
        ),
        delegations,
        skillsActivated: skillsActivatedTrace,
        modelsUsed: modelsUsedTrace,
        completedOperationKeys: Array.from(completedOperationKeys),
        lastCheckpointId,
        checkpointPersisted,
        totalDurationMs,
        estimatedCostUsd: 0,
        configSnapshot: {
          engineVersion: ENGINE_VERSION,
          budget,
          channel,
        },
        errors: traceErrors.map((error) => ({
          ...error,
          message: sanitizeNexusTelemetryText(error.message, request.userPrompt),
        })),
        createdAt: new Date().toISOString(),
      };

      const traceSave = await nexusPersistenceManager.recordEvaluationTrace(
        evaluationTrace,
        requireTaskLease()
      );
      if (!traceSave.persisted) {
        throw new Error(`Failed to persist Nexus execution trace: ${traceSave.error || "unknown error"}`);
      }

      await AgentRepository.recordRun({
        taskId,
        userId: request.userId,
        lease: requireTaskLease(),
        modelUsed:
          modelsUsedTrace.map((m) => `${m.provider}/${m.model}`).slice(0, 2).join(", ") ||
          "nexus-adaptive",
        totalDurationMs,
        filesCreatedCount: sharedContext.codingRes?.filesCreated?.length || 0,
        filesModifiedCount: sharedContext.codingRes?.filesModified?.length || 0,
        toolCallsCount: toolCallCounter.count,
        retriesCount: traceErrors.length,
        status: finalStatus,
      });

      await updateTaskOwnedOrThrow(
        ["running", "planning", "executing", "verifying"],
        {
        status: finalStatus,
        filesChanged: Array.from(filesChangedSet),
        summary: finalSummary,
        finalResponse,
        qualityScore: qualityReport?.score,
        leaseOwner: null,
        leaseToken: null,
        leaseExpiresAt: null,
        completedAt: new Date(),
        }
      );
      leaseOwned = false;
      clearExecutionTimers();
      taskLifecycleState = finalStatus;

      try {
        await emitEvent(
          finalStatus === "completed" || finalStatus === "partial" ? "agent.completed" : "agent.failed",
          finalStatus === "completed"
            ? "اكتمل تنفيذ خطة Nexus بنجاح"
            : finalStatus === "partial"
            ? "اكتملت المهام المطلوبة مع عناصر اختيارية غير مكتملة"
            : "انتهى التنفيذ دون اعتماد النجاح",
          {
            agentWorker: "orchestrator",
            status: finalStatus === "completed" || finalStatus === "partial" ? "completed" : "failed",
            summary: finalSummary,
            payload: {
              previewUrl,
              filesChanged: Array.from(filesChangedSet),
              qualityScore: qualityReport?.score,
              checkpointPersisted,
            },
            persistAfterLeaseRelease: true,
          }
        );
      } catch (eventError) {
        console.error("[NexusEngine.run] final event could not be persisted:", eventError);
      }

      return {
        taskId,
        goal: request.userPrompt,
        status: finalStatus,
        summary: finalSummary,
        finalResponse,
        qualityReport,
        visionEvaluation,
        filesChanged: Array.from(filesChangedSet),
        sandboxId: sharedContext.sandboxId,
        previewUrl,
        totalDurationMs,
        stepsExecuted: currentStep,
        events,
        plan: executionPlan,
        delegations,
        evaluationTrace,
        checkpointPersisted,
        lastCheckpointId,
        nexusEvents: events,
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const safeErrMsg = sanitizeNexusTelemetryText(errMsg, request.userPrompt);
      try {
        await emitEvent("agent.failed", "فشل محرك Nexus.", {
          agentWorker: "orchestrator",
          status: "failed",
          summary: safeErrMsg,
        });
      } catch (eventError) {
        console.error("[NexusEngine.run] failure event could not be persisted:", eventError);
      }

      const wasCancelled =
        !deadlineExceeded &&
        (cancellationRequested ||
          (abortController.signal.reason instanceof Error &&
            abortController.signal.reason.message === TASK_CANCELLED_REASON));
      const isPersistenceFailure = /persist|database|turso|checkpoint|lease/i.test(errMsg);
      const failureStatus: NexusTaskLifecycleState = deadlineExceeded
        ? "failed"
        : wasCancelled
        ? "cancelled"
        : !leaseOwned || isPersistenceFailure
        ? "recovery_required"
        : "failed";

      if (leaseOwned) {
        try {
          assertValidTaskTransition(taskLifecycleState, failureStatus);
          await updateTaskOwnedOrThrow(
            ["running", "planning", "executing", "verifying"],
            {
              status: failureStatus,
              summary: `Nexus task did not complete: ${safeErrMsg}`,
              leaseOwner: null,
              leaseToken: null,
              leaseExpiresAt: null,
              completedAt: failureStatus === "recovery_required" ? null : new Date(),
            }
          );
          taskLifecycleState = failureStatus;
        } catch (persistenceError) {
          leaseOwned = false;
          console.error("[NexusEngine.run] failed to persist terminal task state:", persistenceError);
        }
      }

      try {
        await AgentRepository.logError({
          taskId,
          errorCode: failureStatus === "recovery_required" ? "NEXUS_RECOVERY_REQUIRED" : "NEXUS_ENGINE_EXCEPTION",
          errorMessage: safeErrMsg,
        });
      } catch (loggingError) {
        console.error("[NexusEngine.run] failed to persist task error:", loggingError);
      }

      return {
        taskId,
        goal: request.userPrompt,
        status: failureStatus,
        summary:
          failureStatus === "recovery_required"
            ? "تعذر تأكيد سلامة الاستمرارية؛ المهمة تتطلب الاستعادة."
            : deadlineExceeded
            ? "انتهت مهلة المهمة وأُرسلت إشارة إلغاء إلى العمل الجاري."
            : wasCancelled
            ? "أُلغيت المهمة قبل اكتمالها."
            : "فشل أثناء تنفيذ مهمة Nexus.",
        finalResponse: `تعذر إكمال المهمة: ${safeErrMsg}`,
        filesChanged: Array.from(filesChangedSet),
        totalDurationMs: Date.now() - startTime,
        stepsExecuted: currentStep,
        events,
        checkpointPersisted,
        lastCheckpointId,
      };
    } finally {
      clearExecutionTimers();
      cleanupActiveRun();
      request.signal?.removeEventListener("abort", onRequestAbort);
    }
  }
}

export const nexusEngine = SoufAINexusEngine;
