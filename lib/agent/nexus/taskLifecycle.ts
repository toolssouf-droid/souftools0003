import type { TaskStatus } from "../engine/types";

export class NexusPersistenceError extends Error {
  public readonly code = "NEXUS_PERSISTENCE_FAILURE";
  public readonly persistenceCause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NexusPersistenceError";
    this.persistenceCause = cause;
  }
}

export type NexusTaskLifecycleState = TaskStatus;

const TERMINAL_STATES = new Set<NexusTaskLifecycleState>([
  "completed",
  "partial",
  "failed",
  "cancelled",
]);

const ALLOWED_TRANSITIONS: Record<NexusTaskLifecycleState, readonly NexusTaskLifecycleState[]> = {
  pending: ["planning", "running", "cancelled", "failed"],
  running: [
    "planning",
    "executing",
    "waiting_for_dependencies",
    "retrying",
    "verifying",
    "completed",
    "partial",
    "failed",
    "cancelled",
    "suspended",
    "recovery_required",
  ],
  planning: ["executing", "running", "failed", "cancelled", "suspended", "recovery_required"],
  executing: [
    "waiting_for_dependencies",
    "retrying",
    "verifying",
    "completed",
    "partial",
    "failed",
    "cancelled",
    "suspended",
    "recovery_required",
  ],
  waiting_for_dependencies: ["executing", "failed", "cancelled", "suspended", "recovery_required"],
  retrying: ["executing", "failed", "cancelled", "suspended", "recovery_required"],
  evaluating: ["verifying", "completed", "partial", "failed", "cancelled", "recovery_required"],
  verifying: ["completed", "partial", "failed", "cancelled", "suspended", "recovery_required"],
  suspended: ["running", "planning", "executing", "cancelled", "recovery_required", "failed"],
  recovery_required: ["running", "planning", "executing", "cancelled", "failed"],
  completed: [],
  partial: [],
  failed: [],
  cancelled: [],
};

export function isTerminalTaskState(state: NexusTaskLifecycleState): boolean {
  return TERMINAL_STATES.has(state);
}

export function isValidTaskTransition(
  current: NexusTaskLifecycleState,
  next: NexusTaskLifecycleState
): boolean {
  return current === next || ALLOWED_TRANSITIONS[current].includes(next);
}

export function assertValidTaskTransition(
  current: NexusTaskLifecycleState,
  next: NexusTaskLifecycleState
): void {
  if (!isValidTaskTransition(current, next)) {
    throw new Error(`Invalid Nexus task state transition: ${current} -> ${next}`);
  }
}

export interface NexusCompletionNodeEvidence {
  id: string;
  agentId: string;
  dependencies: string[];
  required?: boolean;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  verificationPassed?: boolean;
  outputResult?: unknown;
}

export interface NexusCompletionDelegationEvidence {
  id: string;
  required?: boolean;
  status: "pending" | "running" | "completed" | "failed" | "blocked";
}

export interface NexusCompletionInput {
  nodes: NexusCompletionNodeEvidence[];
  delegations: NexusCompletionDelegationEvidence[];
  finalResponse: string;
  checkpointPersisted: boolean;
  persistenceFailed: boolean;
  leaseOwned: boolean;
  cancelled: boolean;
  timedOut: boolean;
}

export interface NexusCompletionDecision {
  status: "completed" | "partial" | "failed" | "cancelled" | "recovery_required";
  reasons: string[];
}

export function decideNexusTaskCompletion(input: NexusCompletionInput): NexusCompletionDecision {
  const reasons: string[] = [];

  if (input.cancelled) {
    return { status: "cancelled", reasons: ["Task cancellation was requested."] };
  }
  if (input.timedOut) {
    return { status: "failed", reasons: ["The task exceeded its configured timeout."] };
  }
  if (!input.leaseOwned) {
    return { status: "recovery_required", reasons: ["The worker no longer owns the task lease."] };
  }
  if (input.persistenceFailed || !input.checkpointPersisted) {
    return {
      status: "recovery_required",
      reasons: ["Required task state or checkpoint persistence was not confirmed."],
    };
  }
  if (!input.finalResponse.trim()) {
    reasons.push("No final response was produced.");
  }

  const nodesById = new Map(input.nodes.map((node) => [node.id, node]));
  for (const node of input.nodes) {
    if (node.required === false) continue;

    if (node.status !== "completed") {
      reasons.push(`Required task node '${node.id}' ended as '${node.status}'.`);
      continue;
    }

    const failedDependency = node.dependencies.find(
      (dependencyId) => nodesById.get(dependencyId)?.status !== "completed"
    );
    if (failedDependency) {
      reasons.push(`Required task node '${node.id}' has incomplete dependency '${failedDependency}'.`);
    }
    if (node.agentId === "verification" && node.verificationPassed !== true) {
      reasons.push(`Required verification node '${node.id}' did not pass.`);
    }
    if (node.outputResult === undefined || node.outputResult === null) {
      reasons.push(`Required task node '${node.id}' has no persisted result.`);
    }
  }

  for (const delegation of input.delegations) {
    if (delegation.required !== false && delegation.status !== "completed") {
      reasons.push(`Required delegation '${delegation.id}' ended as '${delegation.status}'.`);
    }
  }

  if (reasons.length > 0) {
    return { status: "failed", reasons };
  }

  const optionalFailures = [
    ...input.nodes.filter((node) => node.required === false && node.status !== "completed"),
    ...input.delegations.filter(
      (delegation) => delegation.required === false && delegation.status !== "completed"
    ),
  ];

  if (optionalFailures.length > 0) {
    return {
      status: "partial",
      reasons: optionalFailures.map((item) => `Optional work '${item.id}' did not complete.`),
    };
  }

  return { status: "completed", reasons: [] };
}
