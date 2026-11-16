/**
 * SoufAI Persistent Task Store & Lifecycle Manager (Turso + In-Memory Signal Cache)
 * Handles Task IDs, Cancellation, Lease-safe Checkpoints, and Cross-Restart Resumption via Turso.
 */

import { AgentState, AgentStatus } from "./agentState";
import { AgentRepository } from "@/lib/db";

function serializeAgentStateSnapshot(state: AgentState): Record<string, any> {
  return {
    taskId: state.taskId,
    status: state.status,
    userRequest: state.userRequest,
    goal: state.goal,
    plan: state.plan || [],
    currentStep: state.currentStep || "",
    completedSteps: state.completedSteps || [],
    observations: (state.observations || []).slice(-25),
    toolCalls: (state.toolCalls || []).slice(-50),
    toolResults: state.toolResults || {},
    errors: (state.errors || []).slice(-25),
    iteration: Number(state.iteration ?? state.completedSteps?.length ?? 0),
    maxSteps: state.maxSteps || 5,
    startedAt: state.startedAt || Date.now(),
    completedAt: state.completedAt ?? null,
    finalAnswer: state.finalAnswer,
    agentSteps: (state.agentSteps || []).slice(-60),
    activities: (state.activities || []).slice(-60),
    toolBudget: state.toolBudget || {},
    budgetUsed: state.budgetUsed || {},
    questionTitle: state.questionTitle,
    suggestions: state.suggestions,
    conversation: (state.conversation || []).slice(-30),
    reasoningSteps: state.reasoningSteps || [],
    innerMonologue: state.innerMonologue,
    reflectionSteps: state.reflectionSteps || [],
    hypotheses: state.hypotheses || [],
    confidenceScore: state.confidenceScore,
    metadata: state.metadata || {},
  };
}

class AgentTaskStore {
  private tasks: Map<string, AgentState> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  public createTask(taskId: string, initialState: AgentState): AgentState {
    this.tasks.set(taskId, initialState);
    if (!this.abortControllers.has(taskId)) {
      this.abortControllers.set(taskId, new AbortController());
    }
    void this.persistTaskAsync(taskId, initialState).catch((err) => {
      console.error("[AgentTaskStore.createTask] Turso persist failed:", err?.message || err);
    });
    return initialState;
  }

  public async createTaskAsync(taskId: string, initialState: AgentState): Promise<AgentState> {
    await this.persistTaskAsync(taskId, initialState);
    this.tasks.set(taskId, initialState);
    if (!this.abortControllers.has(taskId)) {
      this.abortControllers.set(taskId, new AbortController());
    }
    return initialState;
  }

  private async persistTaskAsync(taskId: string, initialState: AgentState): Promise<void> {
    const userId = String(initialState.metadata?.userId || "default_user");
    const projectId = initialState.metadata?.projectId ? String(initialState.metadata.projectId) : undefined;
    const goal = initialState.goal || initialState.userRequest || "SoufAI Agent Task";
    const currentStep = Number(initialState.iteration ?? initialState.completedSteps?.length ?? 0);

    const existing = await AgentRepository.getTask(taskId);
    if (existing) {
      await AgentRepository.updateTask(taskId, {
        status: initialState.status,
        currentStep,
        plan: initialState.plan || [],
        metadata: initialState.metadata || {},
      });
    } else {
      await AgentRepository.createTask({
        id: taskId,
        userId,
        projectId,
        goal,
        category: "agent_runtime",
        status: initialState.status || "planning",
        maxSteps: initialState.maxSteps || 5,
        plan: initialState.plan || [],
        metadata: initialState.metadata || {},
      });
    }
  }

  public getTask(taskId: string): AgentState | undefined {
    return this.tasks.get(taskId);
  }

  public async getTaskAsync(taskId: string, userId?: string): Promise<AgentState | undefined> {
    const inMemory = this.tasks.get(taskId);
    if (inMemory) {
      if (userId && inMemory.metadata?.userId && inMemory.metadata.userId !== userId && userId !== "super_admin") {
        return undefined;
      }
      return inMemory;
    }

    const row = await AgentRepository.getTask(taskId, userId === "super_admin" ? undefined : userId);
    if (!row) return undefined;

    const latestCheckpoint = await AgentRepository.getLatestCheckpoint(taskId);
    const snap = (latestCheckpoint?.state || row.checkpointData || {}) as Record<string, any>;

    const reconstructed: AgentState = {
      taskId: row.id,
      status: (row.status as AgentStatus) || (snap.status as AgentStatus) || "pending",
      userRequest: snap.userRequest || row.goal,
      goal: row.goal || snap.goal || "",
      plan: Array.isArray(snap.plan) ? snap.plan : Array.isArray(row.plan) ? row.plan : [],
      currentStep: snap.currentStep || "",
      completedSteps: Array.isArray(snap.completedSteps) ? snap.completedSteps : [],
      observations: Array.isArray(snap.observations) ? snap.observations : [],
      toolCalls: Array.isArray(snap.toolCalls) ? snap.toolCalls : [],
      toolResults: snap.toolResults || {},
      errors: Array.isArray(snap.errors) ? snap.errors : [],
      iteration: Number(snap.iteration ?? row.currentStep ?? 0),
      maxSteps: Number(snap.maxSteps ?? row.maxSteps ?? 5),
      startedAt: Number(snap.startedAt ?? (row.startedAt instanceof Date ? row.startedAt.getTime() : Date.now())),
      completedAt:
        snap.completedAt ??
        (row.completedAt instanceof Date ? row.completedAt.getTime() : null),
      finalAnswer: snap.finalAnswer ?? row.finalResponse ?? undefined,
      agentSteps: Array.isArray(snap.agentSteps) ? snap.agentSteps : [],
      activities: Array.isArray(snap.activities) ? snap.activities : [],
      toolBudget: snap.toolBudget || {},
      budgetUsed: snap.budgetUsed || {},
      questionTitle: snap.questionTitle,
      suggestions: snap.suggestions,
      conversation: Array.isArray(snap.conversation) ? snap.conversation : [],
      reasoningSteps: Array.isArray(snap.reasoningSteps) ? snap.reasoningSteps : [],
      innerMonologue: snap.innerMonologue,
      reflectionSteps: Array.isArray(snap.reflectionSteps) ? snap.reflectionSteps : [],
      hypotheses: Array.isArray(snap.hypotheses) ? snap.hypotheses : [],
      confidenceScore: snap.confidenceScore,
      metadata: {
        ...(row.metadata || {}),
        ...(snap.metadata || {}),
        userId: row.userId,
        projectId: row.projectId || undefined,
      },
    };

    this.tasks.set(taskId, reconstructed);
    return reconstructed;
  }

  public updateTask(taskId: string, updates: Partial<AgentState>): AgentState | undefined {
    const existing = this.tasks.get(taskId);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.tasks.set(taskId, updated);

    const currentStep = Number(updated.iteration ?? updated.completedSteps?.length ?? 0);
    void AgentRepository.updateTask(taskId, {
      status: updated.status,
      currentStep,
      plan: updated.plan || [],
      finalResponse: updated.finalAnswer,
      metadata: updated.metadata || {},
      completedAt: updated.completedAt ? new Date(updated.completedAt) : null,
    }).catch((err) => {
      console.error("[AgentTaskStore.updateTask] Turso update failed:", err?.message || err);
    });

    return updated;
  }

  public async updateTaskAsync(
    taskId: string,
    updates: Partial<AgentState>
  ): Promise<AgentState | undefined> {
    const existing = this.tasks.get(taskId);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    const currentStep = Number(updated.iteration ?? updated.completedSteps?.length ?? 0);
    await AgentRepository.updateTask(taskId, {
      status: updated.status,
      currentStep,
      plan: updated.plan || [],
      finalResponse: updated.finalAnswer,
      metadata: updated.metadata || {},
      completedAt: updated.completedAt ? new Date(updated.completedAt) : null,
    });
    this.tasks.set(taskId, updated);
    return updated;
  }

  public async saveCheckpointAsync(
    taskId: string,
    stepNumber: number,
    stepName: string,
    state: AgentState
  ): Promise<void> {
    const snapshot = serializeAgentStateSnapshot(state);
    await AgentRepository.saveCheckpoint(taskId, stepNumber, stepName, snapshot);
    await AgentRepository.updateTask(taskId, {
      status: state.status,
      currentStep: stepNumber,
      plan: state.plan || [],
      finalResponse: state.finalAnswer,
      metadata: state.metadata || {},
      completedAt: state.completedAt ? new Date(state.completedAt) : null,
    });
    this.tasks.set(taskId, state);
  }

  public getAbortSignal(taskId: string): AbortSignal | undefined {
    return this.abortControllers.get(taskId)?.signal;
  }

  public cancelTask(taskId: string): boolean {
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
    }
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "cancelled";
      task.completedAt = Date.now();
    }
    void AgentRepository.updateTask(taskId, {
      status: "cancelled",
      summary: "تم إيقاف المهمة بواسطة المستخدم",
      leaseOwner: null,
      leaseExpiresAt: null,
      completedAt: new Date(),
    }).catch((error) => {
      console.error("[AgentTaskStore.cancelTask] Turso update failed:", error);
    });
    return Boolean(task || controller);
  }

  public async cancelTaskAsync(taskId: string, userId?: string): Promise<boolean> {
    if (userId) {
      const existing = await this.getTaskAsync(taskId, userId);
      if (!existing) return false;
    }
    const controller = this.abortControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(taskId);
    }
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "cancelled";
      task.completedAt = Date.now();
    }
    const dbRow = await AgentRepository.getTask(taskId, userId);
    if (!dbRow && !task) return false;
    await AgentRepository.updateTask(taskId, {
      status: "cancelled",
      summary: "تم إيقاف المهمة بواسطة المستخدم",
      leaseOwner: null,
      leaseExpiresAt: null,
      completedAt: new Date(),
    });
    return true;
  }

  public deleteTask(taskId: string): void {
    this.tasks.delete(taskId);
    this.abortControllers.delete(taskId);
  }

  public cleanupOldTasks(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.completedAt && now - task.completedAt > maxAgeMs) {
        this.deleteTask(taskId);
      }
    }
  }
}

export const globalAgentTaskStore = new AgentTaskStore();
