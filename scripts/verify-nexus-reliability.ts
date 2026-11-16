import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  AgentRepository,
  NexusRepository,
  closeDb,
  ensureMigrationsRun,
  getReadyDb,
} from "../lib/db";
import * as schema from "../lib/db/schema";
import { createClient } from "@libsql/client";
import { MIGRATION_STATEMENTS } from "../lib/db/migrate";
import { NexusPersistenceManager } from "../lib/agent/nexus/persistenceManager";
import { NexusModelRouter } from "../lib/agent/nexus/modelRouter";
import type { NexusModelRoutingCriteria } from "../lib/agent/nexus/types";
import { getInMemoryAdminConfig } from "../lib/adminConfigStore";
import { decideNexusTaskCompletion } from "../lib/agent/nexus/taskLifecycle";
import {
  ActiveNexusRunRegistry,
  activeNexusRunRegistry,
  activeRunOwnsLease,
} from "../lib/agent/nexus/activeRunRegistry";
import { nexusAgentRegistry } from "../lib/agent/nexus/agentRegistry";
import { nexusSecurityController } from "../lib/agent/nexus/securityController";
import { SoufAINexusEngine } from "../lib/agent/nexus/nexusEngine";
import { nexusToolBridge } from "../lib/agent/nexus/toolBridge";
import { GlobalToolRegistry } from "../lib/agent/engine/toolRegistry";
import type { EngineExecutionContext, ToolDefinition } from "../lib/agent/engine/types";
import type { NexusExecutionBudget, NexusExecutionContext, NexusSecurityPolicy } from "../lib/agent/nexus/types";
import { executeRoutedPrompt } from "../lib/router";
import { isAbortError, throwIfAborted } from "../lib/agent/engine/abort";

async function verifyLeases(): Promise<void> {
  const taskId = `nexus_verify_${Date.now()}`;
  await AgentRepository.createTask({
    id: taskId,
    userId: "nexus-reliability-test",
    goal: "Verify lease fencing",
    status: "pending",
  });

  const claims = await Promise.all([
    AgentRepository.claimTask(taskId, "worker-a", "token-a", 30_000),
    AgentRepository.claimTask(taskId, "worker-b", "token-b", 30_000),
  ]);
  const winners = claims.filter(Boolean);
  assert.equal(winners.length, 1, "only one concurrent worker may claim a task");
  const firstClaim = winners[0]!;
  const firstLease = {
    workerId: firstClaim.leaseOwner!,
    token: firstClaim.leaseToken!,
    generation: firstClaim.leaseGeneration,
  };
  assert.equal(await AgentRepository.ownsTaskLease(taskId, firstLease), true);
  assert.equal(await AgentRepository.renewTaskLease(firstLease, taskId, 30_000), true);
  assert.equal(await AgentRepository.updateTaskOwned(taskId, firstLease, ["running"], {
    status: "executing",
  }), true);
  for (let heartbeat = 0; heartbeat < 3; heartbeat += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(
      await AgentRepository.renewTaskLease(firstLease, taskId, 30_000),
      true,
      "long-running work must keep renewing its lease"
    );
  }
  assert.equal(await AgentRepository.ownsTaskLease(taskId, firstLease), true);

  const subtaskId = `${taskId}_step`;
  await AgentRepository.createSubtask({
    id: subtaskId,
    taskId,
    title: "Test fencing",
    agentWorker: "verification",
  }, firstLease);
  await AgentRepository.updateSubtaskOwned(taskId, subtaskId, firstLease, {
    status: "running",
  });
  await AgentRepository.saveCheckpoint(taskId, 1, "before takeover", { safe: true }, firstLease);

  const database = await getReadyDb();
  await database
    .update(schema.agentTasks)
    .set({ leaseExpiresAt: new Date(Date.now() - 1) })
    .where(eq(schema.agentTasks.id, taskId));

  const secondClaim = await AgentRepository.claimTask(taskId, "worker-b", "token-b", 30_000);
  assert.ok(secondClaim, "a worker may take over an expired lease");
  const secondLease = {
    workerId: secondClaim.leaseOwner!,
    token: secondClaim.leaseToken!,
    generation: secondClaim.leaseGeneration,
  };
  assert.ok(secondLease.generation > firstLease.generation, "takeover must increment lease generation");
  assert.equal(await AgentRepository.ownsTaskLease(taskId, firstLease), false);
  assert.equal(await AgentRepository.ownsTaskLease(taskId, secondLease), true);

  const activation = {
    taskId,
    agentId: "verification",
    skillId: "test-skill",
    skillVersion: "1.0.0",
    reason: "lease fencing verification",
  };
  await assert.rejects(
    NexusRepository.recordSkillActivations([activation], firstLease),
    "stale workers must not persist skill activations"
  );
  await assert.rejects(
    NexusRepository.recordSkillActivations([activation]),
    "unfenced callers must not write while a task lease is active"
  );
  assert.equal(
    await database
      .select()
      .from(schema.nexusSkillActivations)
      .where(eq(schema.nexusSkillActivations.taskId, taskId))
      .then((rows) => rows.length),
    0,
    "rejected skill activation writes must not leave partial rows"
  );
  await NexusRepository.recordSkillActivations([activation], secondLease);

  assert.equal(
    await AgentRepository.updateTaskOwned(taskId, firstLease, ["executing"], { currentStep: 2 }),
    false,
    "stale task updates must not be acknowledged"
  );
  await assert.rejects(
    AgentRepository.updateSubtaskOwned(taskId, subtaskId, firstLease, { status: "completed" }),
    "stale subtask updates must be rejected"
  );
  await assert.rejects(
    AgentRepository.saveCheckpoint(taskId, 2, "stale checkpoint", {}, firstLease),
    "stale checkpoint writes must be rolled back"
  );
  await assert.rejects(
    AgentRepository.logEvent({
      taskId,
      lease: firstLease,
      eventType: "test.stale",
      title: "stale",
    }),
    "stale event writes must be rejected"
  );
  await assert.rejects(
    AgentRepository.logToolCall({
      taskId,
      lease: firstLease,
      toolName: "test",
      agentWorker: "verification",
    }),
    "stale tool-call writes must be rejected"
  );
  await assert.equal(await AgentRepository.getLatestCheckpoint(taskId).then((checkpoint) =>
    checkpoint?.stepNumber
  ), 1, "a rejected checkpoint transaction must not leave a partial row");

  const checkpointEnvelope = {
    version: "nexus_cp_v1" as const,
    taskId,
    stepNumber: 2,
    stepName: "recovery-test",
    completedOperationKeys: ["subtask:step"],
    sharedContext: {},
    delegations: [],
    activeAgents: ["verification"],
    skillsUsed: ["test-skill"],
    filesChanged: ["src/test.ts"],
    savedAt: new Date().toISOString(),
  };
  await AgentRepository.saveCheckpoint(taskId, 2, checkpointEnvelope.stepName, checkpointEnvelope, secondLease);
  const restored = await new NexusPersistenceManager().loadLatestCheckpoint(taskId);
  assert.deepEqual(restored?.completedOperationKeys, checkpointEnvelope.completedOperationKeys);
  assert.deepEqual(restored?.filesChanged, checkpointEnvelope.filesChanged);

  assert.equal(await AgentRepository.logEvent({
    taskId,
    lease: secondLease,
    eventType: "test.current",
    title: "current",
  }).then((event) => event.eventType), "test.current");
  await AgentRepository.logToolCall({
    taskId,
    lease: secondLease,
    toolName: "test",
    agentWorker: "verification",
    args: { keys: ["safe"] },
  });
  await AgentRepository.recordRun({
    taskId,
    userId: "nexus-reliability-test",
    lease: secondLease,
    modelUsed: "test-only",
    totalDurationMs: 1,
  });

  assert.equal(await AgentRepository.releaseTaskLease(taskId, secondLease, "paused"), true);
  assert.equal(await AgentRepository.ownsTaskLease(taskId, secondLease), false);
  assert.equal(
    await AgentRepository.updateTaskOwned(taskId, secondLease, ["paused"], { currentStep: 3 }),
    false,
    "released leases must no longer authorize writes"
  );

  const task = await AgentRepository.getTask(taskId);
  assert.equal(task?.status, "paused");
  assert.equal(task?.leaseToken, null);

  const legacySkillTaskId = `${taskId}_legacy_skills`;
  await AgentRepository.createTask({
    id: legacySkillTaskId,
    userId: "nexus-reliability-test",
    goal: "Verify legacy skill telemetry",
    status: "completed",
  });
  await NexusRepository.recordSkillActivations(
    [{ ...activation, taskId: legacySkillTaskId }]
  );
  assert.equal(
    await database
      .select()
      .from(schema.nexusSkillActivations)
      .where(eq(schema.nexusSkillActivations.taskId, legacySkillTaskId))
      .then((rows) => rows.length),
    1,
    "legacy unleased tasks must retain skill telemetry when no active lease exists"
  );

  const cancelledTaskId = `${taskId}_cancel`;
  await AgentRepository.createTask({
    id: cancelledTaskId,
    userId: "nexus-reliability-test",
    goal: "Verify cancellation fencing",
    status: "pending",
  });
  const cancellationClaim = await AgentRepository.claimTask(
    cancelledTaskId,
    "worker-cancel",
    "cancel-token",
    30_000
  );
  assert.ok(cancellationClaim);
  const cancellationLease = {
    workerId: cancellationClaim.leaseOwner!,
    token: cancellationClaim.leaseToken!,
    generation: cancellationClaim.leaseGeneration,
  };
  assert.equal(await AgentRepository.cancelTask(cancelledTaskId, "nexus-reliability-test"), true);
  assert.equal(await AgentRepository.ownsTaskLease(cancelledTaskId, cancellationLease), false);
  assert.equal(await AgentRepository.updateTaskOwned(
    cancelledTaskId,
    cancellationLease,
    ["running"],
    { currentStep: 1 }
  ), false, "cancellation must fence out the previous worker");
}

function verifyActiveRunOwnership(): void {
  const registry = new ActiveNexusRunRegistry();
  const controllerA = new AbortController();
  const leaseA = { workerId: "worker-a", token: "token-a", generation: 1 };
  const request = { taskId: "same-task", userId: "u", userPrompt: "test" };
  registry.register("same-task", {
    runId: "run-a",
    request,
    controller: controllerA,
    lease: leaseA,
  });
  assert.throws(
    () => registry.register("same-task", {
      runId: "failed-contender",
      request,
      controller: new AbortController(),
      lease: { workerId: "worker-contender", token: "token-contender", generation: 1 },
    }),
    "a competing run with the same lease generation must not replace the owner"
  );
  assert.equal(registry.get("same-task")?.controller, controllerA);

  assert.equal(
    registry.delete("same-task", "failed-run"),
    false,
    "a failed contender must not remove another run's registration"
  );
  assert.equal(registry.get("same-task")?.controller, controllerA);
  assert.equal(
    activeRunOwnsLease(registry.get("same-task"), {
      leaseOwner: leaseA.workerId,
      leaseToken: leaseA.token,
      leaseGeneration: leaseA.generation,
    }),
    true,
    "stopTask must target the run that owns the persisted lease"
  );
  assert.equal(
    activeRunOwnsLease(registry.get("same-task"), {
      leaseOwner: "other-worker",
      leaseToken: "other-token",
      leaseGeneration: 2,
    }),
    false,
    "stale run records must not own a replacement lease"
  );

  const controllerB = new AbortController();
  registry.register("same-task", {
    runId: "run-b",
    request,
    controller: controllerB,
    lease: { workerId: "worker-b", token: "token-b", generation: 2 },
  });
  registry.updateSandbox("same-task", "run-b", "sandbox-b");
  assert.equal(registry.delete("same-task", "run-a"), false);
  assert.equal(registry.get("same-task")?.controller, controllerB);
  assert.equal(registry.get("same-task")?.sandboxId, "sandbox-b");
  assert.equal(registry.get("other-task"), undefined, "independent tasks have separate active runs");
}

async function verifyStopTaskTargetsOwnedRun(): Promise<void> {
  const taskId = `nexus_stop_verify_${Date.now()}`;
  const otherTaskId = `${taskId}_other`;
  const userId = "nexus-reliability-test";
  await AgentRepository.createTask({
    id: taskId,
    userId,
    goal: "Verify stopTask targets the lease owner",
    status: "pending",
  });
  await AgentRepository.createTask({
    id: otherTaskId,
    userId,
    goal: "Verify independent run isolation",
    status: "pending",
  });
  const claims = await Promise.all([
    AgentRepository.claimTask(taskId, "stop-worker", "stop-token", 30_000),
    AgentRepository.claimTask(otherTaskId, "other-worker", "other-token", 30_000),
  ]);
  const [claim, otherClaim] = claims;
  assert.ok(claim);
  assert.ok(otherClaim);
  const controller = new AbortController();
  const otherController = new AbortController();
  const runId = `run-${taskId}`;
  const otherRunId = `run-${otherTaskId}`;
  activeNexusRunRegistry.register(taskId, {
    runId,
    request: { taskId, userId, userPrompt: "stop this task" },
    controller,
    lease: {
      workerId: claim.leaseOwner!,
      token: claim.leaseToken!,
      generation: claim.leaseGeneration,
    },
  });
  activeNexusRunRegistry.register(otherTaskId, {
    runId: otherRunId,
    request: { taskId: otherTaskId, userId, userPrompt: "keep this task running" },
    controller: otherController,
    lease: {
      workerId: otherClaim.leaseOwner!,
      token: otherClaim.leaseToken!,
      generation: otherClaim.leaseGeneration,
    },
  });

  try {
    const stopped = await SoufAINexusEngine.stopTask(taskId, userId);
    assert.equal(stopped.success, true);
    assert.equal(controller.signal.aborted, true, "stopTask must abort the run owning the persisted lease");
    assert.equal(
      (controller.signal.reason as Error).message,
      "NEXUS_TASK_CANCELLED"
    );
    assert.equal(otherController.signal.aborted, false, "stopping one task must not abort an independent run");
    assert.equal((await AgentRepository.getTask(taskId, userId))?.status, "cancelled");
    assert.equal(await AgentRepository.ownsTaskLease(otherTaskId, {
      workerId: otherClaim.leaseOwner!,
      token: otherClaim.leaseToken!,
      generation: otherClaim.leaseGeneration,
    }), true);
  } finally {
    activeNexusRunRegistry.delete(taskId, runId);
    activeNexusRunRegistry.delete(otherTaskId, otherRunId);
    await AgentRepository.releaseTaskLease(otherTaskId, {
      workerId: otherClaim.leaseOwner!,
      token: otherClaim.leaseToken!,
      generation: otherClaim.leaseGeneration,
    }, "paused");
  }
}

function verifyWorkerToolBoundary(): void {
  const workerDirectory = path.join(process.cwd(), "lib", "agent", "engine", "workers");
  const workerFiles = fs.readdirSync(workerDirectory).filter((file) => file.endsWith(".ts"));
  assert.ok(workerFiles.length > 0);

  for (const file of workerFiles) {
    const source = fs.readFileSync(path.join(workerDirectory, file), "utf8");
    assert.doesNotMatch(source, /GlobalToolRegistry\.get\s*\(/, `${file} must not discover tools for direct execution`);
    assert.doesNotMatch(source, /\b(?:tool|searchTool|registered)\.execute\s*\(/, `${file} must not execute a registry tool directly`);
    assert.doesNotMatch(source, /\.executeCommand\s*\(|SandboxManager\.createSandbox\s*\(/, `${file} must use NexusToolBridge for execution`);
    if (/executeRoutedPrompt\s*\(/.test(source)) {
      assert.match(source, /signal:\s*ctx\.signal/, `${file} must pass the task AbortSignal to the model router`);
    }
  }

  const nexusWorkers = fs.readFileSync(path.join(process.cwd(), "lib", "agent", "nexus", "workers.ts"), "utf8");
  assert.doesNotMatch(nexusWorkers, /SandboxManager\.getSandbox|WorkerJobRepository\.enqueue|ScheduledTaskRepository\.(?:createTask|listTasksByUser)/);
  assert.match(nexusWorkers, /ctx\.invokeTool\(/, "Nexus dispatch work must route tools through the bridge");
}

async function verifyToolBridge(): Promise<void> {
  const taskId = `nexus_tool_verify_${Date.now()}`;
  await AgentRepository.createTask({
    id: taskId,
    userId: "nexus-reliability-test",
    goal: "Verify centralized tool execution",
    status: "pending",
  });
  const claim = await AgentRepository.claimTask(taskId, "tool-worker", "tool-token", 30_000);
  assert.ok(claim);
  const lease = {
    workerId: claim.leaseOwner!,
    token: claim.leaseToken!,
    generation: claim.leaseGeneration,
  };
  const toolName = "nexus_reliability_tool";
  let executions = 0;
  let toolStarted: (() => void) | undefined;

  const registerTool = (timeoutMs: number, execute: ToolDefinition["execute"]) => {
    GlobalToolRegistry.register({
      name: toolName,
      description: "Isolated reliability test tool",
      inputSchema: { value: { type: "string", required: true } },
      permissions: ["write:workspace"],
      riskLevel: "critical",
      timeoutMs,
      maxCallsPerTask: 10,
      supportedAgents: ["coding"],
      execute,
    });
  };

  registerTool(1000, async () => {
    executions += 1;
    return { success: true, data: { executed: true } };
  });
  const codingAgent = nexusAgentRegistry.getAgent("coding");
  assert.ok(codingAgent);

  const budget: NexusExecutionBudget = {
    maxTotalSteps: 1,
    maxDelegationDepth: 1,
    maxActiveAgents: 1,
    maxConcurrentTasks: 1,
    maxTokensBudget: 1,
    maxToolCalls: 10,
    maxRetriesPerStep: 1,
    stepTimeoutMs: 2000,
    taskTimeoutMs: 5000,
    leaseDurationMs: 30_000,
    leaseHeartbeatIntervalMs: 10_000,
  };
  const context = (options?: {
    controller?: AbortController;
    permissions?: NexusSecurityPolicy["grantedPermissions"];
    approvalHandler?: NexusSecurityPolicy["approvalHandler"];
  }): NexusExecutionContext => {
    const policy = nexusSecurityController.buildDefaultPolicy(
      "nexus-reliability-test",
      "web",
      {
        grantedPermissions: options?.permissions || ["write:workspace"],
        requireApprovalForRiskLevels: ["critical"],
        approvalHandler: options?.approvalHandler,
      }
    );
    const base: EngineExecutionContext = {
      taskId,
      userId: "nexus-reliability-test",
      signal: options?.controller?.signal,
      emitEvent: async () => undefined,
      logToolCall: async () => undefined,
    };
    return {
      ...base,
      lease,
      engineMode: "nexus_orchestrator",
      agentId: "coding",
      workerTypeCompat: "coding",
      channel: "web",
      delegationDepth: 0,
      callStack: ["coding"],
      effectivePermissions: options?.permissions || ["write:workspace"],
      budget,
      securityPolicy: policy,
      sharedContext: {},
      completedOperationKeys: new Set<string>(),
      invokeTool: async () => ({ success: false }),
      delegateToAgent: async () => ({ success: false }),
    };
  };
  const toolAgent = { ...codingAgent, allowedTools: [toolName] };
  const execute = (agent: typeof toolAgent, ctx: NexusExecutionContext) =>
    nexusToolBridge.executeTool({
      toolName,
      args: { value: "ok" },
      agent,
      ctx,
    });

  try {
    assert.equal((await execute({ ...toolAgent, allowedTools: [] }, context())).success, false);
    assert.equal(executions, 0, "unauthorized tool must not execute");
    assert.equal((await execute(toolAgent, context({ permissions: [] }))).success, false);
    assert.equal(executions, 0, "missing permissions must prevent execution");
    assert.equal(
      (await execute(toolAgent, context({ approvalHandler: async () => false }))).success,
      false,
      "a denied approval must block the tool"
    );
    assert.equal(executions, 0);
    assert.equal(
      (await execute(toolAgent, context({ approvalHandler: async () => true }))).success,
      true,
      "approved, authorized tools must execute through the bridge"
    );
    assert.equal(executions, 1);
    assert.equal(
      (await nexusToolBridge.executeTool({
        toolName,
        args: {},
        agent: toolAgent,
        ctx: context({ approvalHandler: async () => true }),
      })).success,
      false,
      "invalid tool inputs must be rejected before execution"
    );
    assert.equal(executions, 1);

    registerTool(15, async (_args, toolContext) => new Promise((resolve, reject) => {
      const onAbort = () => reject(toolContext.signal?.reason || new Error("tool aborted"));
      if (toolContext.signal?.aborted) onAbort();
      else toolContext.signal?.addEventListener("abort", onAbort, { once: true });
    }));
    const timeoutResult = await nexusToolBridge.executeTool({
      toolName,
      args: { value: "ok" },
      agent: toolAgent,
      ctx: context({ approvalHandler: async () => true }),
    });
    assert.equal(timeoutResult.success, false);
    assert.match(timeoutResult.error || "", /timed out/i);

    registerTool(2000, async (_args, toolContext) => new Promise((resolve, reject) => {
      toolStarted?.();
      const onAbort = () => reject(toolContext.signal?.reason || new Error("tool aborted"));
      if (toolContext.signal?.aborted) onAbort();
      else toolContext.signal?.addEventListener("abort", onAbort, { once: true });
    }));
    const controller = new AbortController();
    const started = new Promise<void>((resolve) => { toolStarted = resolve; });
    const pending = execute(toolAgent, context({
      controller,
      approvalHandler: async () => true,
    }));
    await started;
    const abortError = new DOMException("cancelled", "AbortError");
    controller.abort(abortError);
    await assert.rejects(pending, (error: unknown) => error === abortError);
  } finally {
    await AgentRepository.releaseTaskLease(taskId, lease, "paused");
  }
}

async function verifyRouting(): Promise<void> {
  const criteria: NexusModelRoutingCriteria = {
    taskComplexity: "medium",
    requiresReasoning: false,
    requiresCoding: false,
    requiresVision: false,
    requiresStructuredOutput: false,
    minContextTokens: 1_000,
    latencyPreference: "balanced",
    costSensitivity: "standard",
    preferredTiers: ["core"],
    fallbackTiers: [],
  };
  const model = "gemini-3.7-flash";
  const testConfig = () => ({
    ...getInMemoryAdminConfig(),
    activeModelTiers: ["core"],
    modelProviders: {
      core: [{
        providerId: "gemini",
        models: [model],
        activeModels: [model],
        keys: ["test-key-not-a-credential"],
        priority: 1,
      }],
    },
  });
  const router = new NexusModelRouter({
    loadConfig: async () => testConfig(),
    executePrompt: async (options) => {
      assert.equal(options.strictModelSelection, true);
      assert.equal(options.firestoreAssignments?.core?.[0]?.model, model);
      return {
        text: "deterministic test result",
        providerUsed: "gemini",
        modelUsed: model,
        keyUsedMasked: "test",
        attemptsCount: 1,
        fallbackOccurred: false,
      };
    },
    wait: async () => undefined,
    random: () => 0,
  });

  const result = await router.executeWithRouting(criteria, {
    prompt: "deterministic test only",
    explicitModelId: "core",
  });
  assert.equal(result.result.modelUsed, model);
  assert.equal(result.decision.selectedProvider, "gemini");

  const mismatchedRouter = new NexusModelRouter({
    loadConfig: async () => testConfig(),
    executePrompt: async () => ({
      text: "unexpected result",
      providerUsed: "other-provider",
      modelUsed: "other-model",
      keyUsedMasked: "test",
      attemptsCount: 1,
      fallbackOccurred: true,
    }),
    wait: async () => undefined,
    random: () => 0,
  });
  await assert.rejects(
    mismatchedRouter.executeWithRouting(criteria, {
      prompt: "deterministic mismatch test",
    }),
    "router must reject an executor result from an unassigned model/provider"
  );
}

async function verifyModelRouterFallbacks(): Promise<void> {
  const model = "gemini-3.7-flash";
  const config = () => ({
    ...getInMemoryAdminConfig(),
    activeModelTiers: ["core"],
    modelProviders: {
      core: [
        {
          providerId: "gemini",
          models: [model],
          activeModels: [model],
          keys: ["reliability-key-one"],
          priority: 1,
        },
        {
          providerId: "groq",
          models: [model],
          activeModels: [model],
          keys: ["reliability-key-two"],
          priority: 2,
        },
      ],
    },
  });
  const criteria: NexusModelRoutingCriteria = {
    taskComplexity: "medium",
    requiresReasoning: false,
    requiresCoding: false,
    requiresVision: false,
    requiresStructuredOutput: false,
    minContextTokens: 1_000,
    latencyPreference: "balanced",
    costSensitivity: "standard",
    preferredTiers: ["core"],
    fallbackTiers: [],
  };
  const fallbackController = new AbortController();
  const attempts: string[] = [];
  const fallbackRouter = new NexusModelRouter({
    loadConfig: async () => config(),
    executePrompt: async (options) => {
      const provider = options.firestoreAssignments?.core?.[0]?.providerId || "missing";
      attempts.push(provider);
      if (provider === "gemini") throw new Error("temporary provider server error 503");
      assert.equal(options.timeoutMs, 100);
      assert.ok(options.signal);
      return {
        text: "fallback result",
        providerUsed: provider,
        modelUsed: model,
        keyUsedMasked: "test",
        attemptsCount: 1,
        fallbackOccurred: false,
      };
    },
    wait: async () => undefined,
    random: () => 0,
  });
  const fallbackResult = await fallbackRouter.executeWithRouting(criteria, {
    prompt: "fallback test",
    timeoutMs: 100,
    signal: fallbackController.signal,
  });
  assert.deepEqual(attempts, ["gemini", "groq"]);
  assert.equal(fallbackResult.result.providerUsed, "groq");
  assert.equal(fallbackResult.decision.selectedProvider, "groq");

  let failureAttempts = 0;
  const failingRouter = new NexusModelRouter({
    loadConfig: async () => config(),
    executePrompt: async () => {
      failureAttempts += 1;
      throw new Error("temporary provider server error 503");
    },
    wait: async () => undefined,
    random: () => 0,
  });
  await assert.rejects(
    failingRouter.executeWithRouting(criteria, { prompt: "all providers fail", timeoutMs: 100 }),
    /No configured model completed/
  );
  assert.equal(failureAttempts, 2, "all configured candidates should be attempted before final failure");

  const abortController = new AbortController();
  let abortAttempts = 0;
  const abortRouter = new NexusModelRouter({
    loadConfig: async () => config(),
    executePrompt: async (options) => {
      abortAttempts += 1;
      assert.equal(options.signal, abortController.signal);
      assert.equal(options.timeoutMs, 100);
      abortController.abort(new DOMException("cancelled", "AbortError"));
      return {
        text: "must not be accepted",
        providerUsed: "gemini",
        modelUsed: model,
        keyUsedMasked: "test",
        attemptsCount: 1,
        fallbackOccurred: false,
      };
    },
    wait: async () => undefined,
    random: () => 0,
  });
  await assert.rejects(
    abortRouter.executeWithRouting(criteria, {
      prompt: "abort during provider request",
      timeoutMs: 100,
      signal: abortController.signal,
    }),
    (error: unknown) => isAbortError(error, abortController.signal)
  );
  assert.equal(abortAttempts, 1, "fallback must not start after cancellation");
}

async function verifyProviderAbortPropagation(): Promise<void> {
  const previousFetch = globalThis.fetch;
  const controller = new AbortController();
  let fetchCalls = 0;
  let providerSignal: AbortSignal | null | undefined;
  let notifyFetchStarted!: () => void;
  const fetchStarted = new Promise<void>((resolve) => { notifyFetchStarted = resolve; });

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls += 1;
    providerSignal = init?.signal;
    notifyFetchStarted();
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  }) as typeof fetch;

  try {
    const request = executeRoutedPrompt({
      modelId: "core",
      prompt: "abortable infrastructure test",
      signal: controller.signal,
      firestoreAssignments: {
        core: [{
          providerId: "openai",
          model: "gpt-4o-mini",
          models: ["gpt-4o-mini"],
          activeModels: ["gpt-4o-mini"],
          keys: ["unit-test-provider-key"],
          priority: 1,
        }],
        spark: [{
          providerId: "groq",
          model: "llama-3.3-70b-versatile",
          models: ["llama-3.3-70b-versatile"],
          activeModels: ["llama-3.3-70b-versatile"],
          keys: ["unit-test-fallback-key"],
          priority: 1,
        }],
      },
    });
    await fetchStarted;
    const abortError = new DOMException("cancelled", "AbortError");
    controller.abort(abortError);
    await assert.rejects(request, (error: unknown) => error === abortError);
    assert.equal(fetchCalls, 1, "cancelled provider requests must not trigger another fallback");
    assert.ok(providerSignal?.aborted, "the provider's fetch signal must be aborted with its parent task");
  } finally {
    globalThis.fetch = previousFetch;
  }
}

function verifyCompletionPolicy(): void {
  const base = {
    nodes: [],
    delegations: [],
    finalResponse: "",
    checkpointPersisted: true,
    persistenceFailed: false,
    leaseOwned: false,
    timedOut: false,
  };
  assert.equal(
    decideNexusTaskCompletion({ ...base, cancelled: false }).status,
    "recovery_required",
    "lease loss must not be reported as user cancellation"
  );
  assert.equal(
    decideNexusTaskCompletion({ ...base, cancelled: true }).status,
    "cancelled",
    "explicit cancellation must remain a cancelled terminal state"
  );
}

async function main(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "souftools-nexus-verify-"));
  const dbPath = path.join(tempDir, "nexus.db");
  const previousUrl = process.env.TURSO_DATABASE_URL;
  const previousToken = process.env.TURSO_AUTH_TOKEN;
  const previousAuthToken = process.env.TURSO_DATABASE_AUTH_TOKEN;
  process.env.TURSO_DATABASE_URL = `file:${dbPath}`;
  delete process.env.TURSO_AUTH_TOKEN;
  delete process.env.TURSO_DATABASE_AUTH_TOKEN;

  try {
    const agentTasksSchema = MIGRATION_STATEMENTS.find((statement) =>
      statement.includes('CREATE TABLE IF NOT EXISTS "agent_tasks"')
    );
    assert.ok(agentTasksSchema, "agent task schema statement must exist");
    const legacySchema = agentTasksSchema!
      .replace(/^\s*lease_token TEXT,\r?\n/m, "")
      .replace(/^\s*lease_generation INTEGER NOT NULL DEFAULT 0,\r?\n/m, "");
    assert.notEqual(legacySchema, agentTasksSchema, "legacy schema must omit v4 lease columns");
    const legacyClient = createClient({ url: `file:${dbPath}` });
    await legacyClient.execute(legacySchema);
    await legacyClient.execute({
      sql: `INSERT INTO "agent_tasks" (id, user_id, goal, status, lease_owner, lease_expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      args: ["legacy_task", "legacy_user", "preserve this row", "paused", "old-worker", Date.now() - 1],
    });
    legacyClient.close();

    await ensureMigrationsRun();
    const database = await getReadyDb();
    const columns = await database.all<{ name: string }>(
      `PRAGMA table_info('agent_tasks')`
    );
    const names = new Set(columns.map((column) => column.name));
    assert.ok(names.has("lease_token"), "lease token migration must be applied on a fresh DB");
    assert.ok(names.has("lease_generation"), "lease generation migration must be applied on a fresh DB");
    const migratedTask = await AgentRepository.getTask("legacy_task", "legacy_user");
    assert.equal(migratedTask?.goal, "preserve this row", "legacy task data must survive migration");
    assert.equal(migratedTask?.leaseToken, null, "legacy tasks must receive an empty fencing token");
    assert.equal(migratedTask?.leaseGeneration, 0, "legacy tasks must receive the initial lease generation");
    const migrations = await database.all<{ id: string }>(
      `SELECT id FROM "_schema_migrations" WHERE id = 'turso_v4_agent_task_lease_fencing'`
    );
    assert.ok(migrations[0], "v4 migration must be recorded only after the lease columns exist");

    global._soufMigrationsComplete = undefined;
    global._soufMigrationPromise = undefined;
    await ensureMigrationsRun();
    assert.equal((await AgentRepository.getTask("legacy_task", "legacy_user"))?.goal, "preserve this row");

    await verifyLeases();
    verifyActiveRunOwnership();
    await verifyStopTaskTargetsOwnedRun();
    verifyWorkerToolBoundary();
    await verifyToolBridge();
    await verifyRouting();
    await verifyModelRouterFallbacks();
    await verifyProviderAbortPropagation();
    verifyCompletionPolicy();
    console.log("Nexus reliability verification passed (isolated libSQL; provider calls mocked).");
  } finally {
    await closeDb();
    if (previousUrl === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = previousUrl;
    if (previousToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = previousToken;
    if (previousAuthToken === undefined) delete process.env.TURSO_DATABASE_AUTH_TOKEN;
    else process.env.TURSO_DATABASE_AUTH_TOKEN = previousAuthToken;

    let cleanupError: unknown;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        cleanupError = null;
        break;
      } catch (error) {
        cleanupError = error;
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
    if (cleanupError) {
      console.warn(
        `Temporary libSQL files could not be removed (${String(cleanupError)}): ${tempDir}`
      );
    }
  }
}

void main().catch((error) => {
  console.error("Nexus reliability verification failed:", error);
  process.exitCode = 1;
});
