/**
 * SoufAI Nexus Engine — Dynamic Multi-Agent Central Planner
 *
 * Analyzes user goals, extracts completion criteria, selects relevant capabilities
 * and skills, dynamically assigns specialized agents from NexusAgentRegistry,
 * constructs parallel/sequential DAG execution waves, and validates acyclic plans
 * against configured execution budgets.
 */

import { nexusAgentRegistry } from "./agentRegistry";
import { nexusSkillRegistry } from "./skillsRegistry";
import { nexusModelRouter } from "./modelRouter";
import type {
  NexusExecutionBudget,
  NexusExecutionPlan,
  NexusModelRoutingCriteria,
  NexusPlanNode,
} from "./types";

function defaultRoutingForAgent(agentId: string): NexusModelRoutingCriteria {
  const agent = nexusAgentRegistry.getAgent(agentId);
  const tier = agent?.preferredModels?.[0] || "core";
  return {
    taskComplexity:
      tier === "pro" || tier === "ultra" ? "high" : tier === "spark" ? "low" : "medium",
    requiresReasoning: agentId === "architecture_analyst" || agentId === "orchestrator" || agentId === "database_engineer",
    requiresCoding: agentId === "coding" || agentId === "debug" || agentId === "database_engineer",
    requiresVision: agentId === "vision",
    requiresStructuredOutput: true,
    minContextTokens: agent?.contextRequirements.minContextTokens || 16000,
    latencyPreference: tier === "spark" ? "instant" : "balanced",
    costSensitivity: "standard",
    preferredTiers: agent?.preferredModels,
    fallbackTiers: agent?.fallbackModels,
  };
}

export function validatePlanDag(nodes: NexusPlanNode[]): { valid: boolean; error?: string } {
  const nodeMap = new Map<string, NexusPlanNode>();
  for (const n of nodes) {
    if (!n.id) return { valid: false, error: "Plan node missing id." };
    if (nodeMap.has(n.id)) return { valid: false, error: `Duplicate plan node id '${n.id}'.` };
    const agent = nexusAgentRegistry.getAgent(n.assignedAgentId);
    if (!agent || !agent.enabled) {
      return { valid: false, error: `Assigned agent '${n.assignedAgentId}' is missing or disabled.` };
    }
    nodeMap.set(n.id, n);
  }

  for (const n of nodes) {
    for (const dep of n.dependencies) {
      if (!nodeMap.has(dep)) {
        return { valid: false, error: `Node '${n.id}' references missing dependency '${dep}'.` };
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const node = nodeMap.get(id)!;
    for (const dep of node.dependencies) {
      if (hasCycle(dep)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };

  for (const n of nodes) {
    if (hasCycle(n.id)) {
      return { valid: false, error: `Cycle detected in DAG near node '${n.id}'.` };
    }
  }

  return { valid: true };
}

export class NexusPlanner {
  public async createPlan(params: {
    taskId: string;
    goal: string;
    taskType?: string;
    projectMemorySummary?: string;
    budget: NexusExecutionBudget;
    signal?: AbortSignal;
    explicitAgents?: string[];
    explicitSkills?: string[];
  }): Promise<{
    plan: NexusExecutionPlan;
    routingDecision?: { model: string; provider: string; reason: string };
  }> {
    const {
      taskId,
      goal,
      taskType = "full_engineering",
      projectMemorySummary = "",
      budget,
      explicitAgents = [],
    } = params;

    const lower = goal.toLowerCase();
    const orchestrator = nexusAgentRegistry.getAgent("orchestrator")!;

    // On-demand skill selection for planning
    const plannerSkills = nexusSkillRegistry.selectAndComposeForContext({
      goal,
      taskType,
      agent: orchestrator,
      explicitSkillIds: params.explicitSkills,
      maxSkills: 4,
      maxSkillTokenBudget: 700,
    });

    const availableWorkers = nexusAgentRegistry
      .listAgents({ enabledOnly: true })
      .filter((a) => a.id !== "orchestrator" && a.id !== "conversational_runtime" && a.id !== "coding_workspace");

    const workerSummary = availableWorkers
      .map(
        (w) =>
          `- "${w.id}": ${w.specialization} (requiresSandbox: ${w.contextRequirements.requiresSandbox}, types: [${w.supportedTaskTypes.join(",")}])`
      )
      .join("\n");

    let aiPlan: any = null;
    let routingInfo: { model: string; provider: string; reason: string } | undefined;

    try {
      const { result, decision } = await nexusModelRouter.executeWithRouting(
        {
          taskComplexity: "medium",
          requiresReasoning: true,
          requiresCoding: false,
          requiresVision: false,
          requiresStructuredOutput: true,
          minContextTokens: 32000,
          latencyPreference: "balanced",
          costSensitivity: "standard",
          preferredTiers: ["core", "pro"],
        },
        {
          prompt: `Analyze the user objective and construct a dynamic DAG execution plan using the registered SoufAI Nexus agents.
Goal: "${goal}"
Requested Task Type: "${taskType}"
${projectMemorySummary ? `Project Memory Context:\n${projectMemorySummary}\n` : ""}
Registered Agents:
${workerSummary}

Constraints:
- Max nodes: ${Math.min(budget.maxActiveAgents, 8)}
- Parallelize independent agents (same parallelGroup, empty or satisfied dependencies).
- Include "sandbox" first only if workspace/sandbox execution or full_engineering build is required.
- Include "security" audit when commands/code/DB mutations are involved.
- Include "verification" before completion for engineering builds.

Output strictly valid JSON:
{
  "taskCategory": "full_engineering|architecture_review|database_design|workflow_automation|documentation|research|debugging",
  "needsSandbox": true,
  "framework": "react_nextjs",
  "themeArchetype": "luxury_dark",
  "completionCriteria": ["criterion 1", "criterion 2"],
  "subtasks": [
    {
      "id": "step_sandbox",
      "title": "Boot isolated sandbox workspace",
      "assignedAgentId": "sandbox",
      "dependencies": [],
      "parallelGroup": 0,
      "inputArgs": {}
    }
  ]
}`,
          systemInstruction: `${orchestrator.systemInstructions}\n\n${plannerSkills.mergedInstructions}`,
          responseMimeType: "application/json",
          signal: params.signal,
          timeoutMs: budget.stepTimeoutMs,
        }
      );

      routingInfo = {
        model: result.modelUsed || decision.selectedModel,
        provider: result.providerUsed || decision.selectedProvider,
        reason: decision.reason,
      };

      const raw = (result.text || "").trim();
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");
      if (first !== -1 && last > first) {
        aiPlan = JSON.parse(raw.slice(first, last + 1));
      }
    } catch (planningError) {
      if (params.signal?.aborted) {
        throw params.signal.reason instanceof Error ? params.signal.reason : planningError;
      }
      console.error("[NexusPlanner.createPlan] model-based planning failed; using deterministic plan:", planningError);
      aiPlan = null;
    }

    // Build deterministic capability-matched plan if AI planning failed or returned invalid nodes
    const nodes: NexusPlanNode[] = [];

    if (aiPlan && Array.isArray(aiPlan.subtasks) && aiPlan.subtasks.length > 0) {
      for (let i = 0; i < Math.min(aiPlan.subtasks.length, budget.maxActiveAgents); i++) {
        const rawNode = aiPlan.subtasks[i];
        const candidateId = String(rawNode?.assignedAgentId || "").trim();
        const agent = nexusAgentRegistry.getAgent(candidateId);
        if (!agent || !agent.enabled) continue;
        const nodeId = String(rawNode.id || `sub_${i + 1}_${agent.id}`);
        nodes.push({
          id: nodeId,
          title: String(rawNode.title || agent.name),
          description: String(rawNode.description || agent.specialization),
          required: rawNode.required !== false,
          assignedAgentId: agent.id,
          workerType: agent.workerType,
          dependencies: Array.isArray(rawNode.dependencies) ? rawNode.dependencies.map(String) : [],
          parallelGroup: Number(rawNode.parallelGroup ?? 0),
          requiredSkills: agent.requiredSkills,
          routingCriteria: defaultRoutingForAgent(agent.id),
          inputArgs: typeof rawNode.inputArgs === "object" && rawNode.inputArgs ? rawNode.inputArgs : {},
          idempotencyKey: `${taskId}:${nodeId}:${agent.id}`,
          maxRetries: Math.min(agent.errorPolicy.maxRetries, budget.maxRetriesPerStep),
          timeoutMs: Math.min(agent.executionLimits.timeoutMs, budget.stepTimeoutMs),
          status: "pending",
        });
      }
    }

    // Clean invalid dependency references from AI output
    const validIds = new Set(nodes.map((n) => n.id));
    for (const n of nodes) {
      n.dependencies = n.dependencies.filter((d) => validIds.has(d) && d !== n.id);
    }

    const dagValidation = nodes.length > 0 ? validatePlanDag(nodes) : { valid: false };
    if (!dagValidation.valid || nodes.length === 0) {
      nodes.length = 0;
      const fallbackNodes = this.buildDeterministicCapabilityPlan({
        taskId,
        goal,
        taskType,
        lower,
        explicitAgents,
        budget,
      });
      nodes.push(...fallbackNodes);
    }

    const selectedSkillsSet = new Set<string>(plannerSkills.activeSkillIds);
    const requiredCapabilities = new Set<string>();
    for (const n of nodes) {
      requiredCapabilities.add(n.assignedAgentId);
      for (const s of n.requiredSkills) selectedSkillsSet.add(s);
    }

    const needsSandbox =
      typeof aiPlan?.needsSandbox === "boolean"
        ? aiPlan.needsSandbox
        : nodes.some((n) => nexusAgentRegistry.getAgent(n.assignedAgentId)?.contextRequirements.requiresSandbox);

    const plan: NexusExecutionPlan = {
      planId: `plan_${taskId}_${Date.now()}`,
      goal,
      taskCategory: String(aiPlan?.taskCategory || taskType),
      completionCriteria:
        Array.isArray(aiPlan?.completionCriteria) && aiPlan.completionCriteria.length > 0
          ? aiPlan.completionCriteria.map(String)
          : [
              `Complete all DAG stages for goal: ${goal.slice(0, 80)}`,
              "Pass security audit and final pre-delivery verification",
            ],
      requiredCapabilities: Array.from(requiredCapabilities),
      selectedSkills: Array.from(selectedSkillsSet),
      framework: String(aiPlan?.framework || "react_nextjs"),
      themeArchetype: String(aiPlan?.themeArchetype || "luxury_dark"),
      needsSandbox,
      nodes,
      estimatedBudget: budget,
      createdAt: new Date().toISOString(),
    };

    return { plan, routingDecision: routingInfo };
  }

  private buildDeterministicCapabilityPlan(params: {
    taskId: string;
    goal: string;
    taskType: string;
    lower: string;
    explicitAgents: string[];
    budget: NexusExecutionBudget;
  }): NexusPlanNode[] {
    const { taskId, goal, taskType, lower, explicitAgents, budget } = params;
    const nodes: NexusPlanNode[] = [];
    const addNode = (
      id: string,
      agentId: string,
      title: string,
      dependencies: string[],
      parallelGroup: number,
      inputArgs: Record<string, any> = {}
    ) => {
      if (nodes.length >= budget.maxActiveAgents) return;
      const agent = nexusAgentRegistry.getAgent(agentId);
      if (!agent || !agent.enabled) return;
      nodes.push({
        id,
        title,
        description: agent.specialization,
        required: true,
        assignedAgentId: agent.id,
        workerType: agent.workerType,
        dependencies,
        parallelGroup,
        requiredSkills: agent.requiredSkills,
        routingCriteria: defaultRoutingForAgent(agent.id),
        inputArgs,
        idempotencyKey: `${taskId}:${id}:${agent.id}`,
        maxRetries: Math.min(agent.errorPolicy.maxRetries, budget.maxRetriesPerStep),
        timeoutMs: Math.min(agent.executionLimits.timeoutMs, budget.stepTimeoutMs),
        status: "pending",
      });
    };

    const isWorkflowOnly =
      taskType === "workflow_automation" ||
      taskType === "scheduling" ||
      /(?:schedule|cron|remind|تذكير|جدولة|طابور)/i.test(lower);
    const isDocsOnly =
      taskType === "documentation" ||
      /(?:documentation|openapi|readme|توثيق|دليل استخدام)/i.test(lower);
    const isDbFocus =
      taskType === "database_design" ||
      /(?:database|schema|turso|drizzle|sqlite|جدول|قاعدة بيانات)/i.test(lower);
    const isArchFocus =
      taskType === "architecture_review" ||
      /(?:architecture|blueprint|refactor|معمارية|هيكلة)/i.test(lower);

    if (explicitAgents.length > 0) {
      for (let i = 0; i < explicitAgents.length; i++) {
        const aid = explicitAgents[i];
        addNode(`node_${aid}_${i}`, aid, `Execute ${aid}`, i === 0 ? [] : [`node_${explicitAgents[i - 1]}_${i - 1}`], i, { taskGoal: goal });
      }
      return nodes;
    }

    if (isWorkflowOnly && taskType !== "full_engineering") {
      addNode("node_workflow", "workflow_automation", "Schedule or enqueue workflow automation", [], 0, {
        taskGoal: goal,
      });
      return nodes;
    }

    // Full multi-agent engineering / specialized pipeline
    addNode("node_sandbox", "sandbox", "Boot isolated sandbox environment", [], 0, {
      action: "create",
      projectName: "SoufAI Project",
    });

    const wave1Deps = ["node_sandbox"];
    const codingDeps: string[] = ["node_sandbox"];

    addNode("node_design", "design", "Design visual tokens and accessible UI architecture", wave1Deps, 1, {
      projectGoal: goal,
    });
    codingDeps.push("node_design");

    if (isArchFocus || goal.length > 90) {
      addNode("node_architecture", "architecture_analyst", "Analyze architecture and module boundaries", wave1Deps, 1, {
        taskGoal: goal,
      });
      codingDeps.push("node_architecture");
    }

    if (isDbFocus) {
      addNode("node_database", "database_engineer", "Design Turso Drizzle SQLite schema & persistence", wave1Deps, 1, {
        taskGoal: goal,
      });
      codingDeps.push("node_database");
    }

    if (/(?:latest|docs|research|api|library|ابحث|توثيق|مكتبة)/i.test(lower)) {
      addNode("node_research", "research", "Gather live technical documentation", wave1Deps, 1, {
        topic: goal,
      });
      codingDeps.push("node_research");
    }

    addNode("node_coding", "coding", "Implement multi-file project code", codingDeps, 2, {
      taskGoal: goal,
    });

    addNode("node_security", "security", "Audit generated files and commands for security", ["node_coding"], 3, {});
    addNode("node_testing", "testing", "Run build, tests, and preview validation", ["node_coding"], 3, {});

    const finalWaveDeps = ["node_security", "node_testing"];
    addNode("node_vision", "vision", "Evaluate preview visual quality and WCAG AA contrast", finalWaveDeps, 4, {});

    if (isDocsOnly) {
      addNode("node_docs", "documentation_engineer", "Generate code-verified technical documentation", ["node_coding"], 4, {
        taskGoal: goal,
      });
    }

    addNode("node_verification", "verification", "Run final pre-delivery completeness gate", ["node_vision"], 5, {
      taskGoal: goal,
      qualityThreshold: 65,
    });

    return nodes;
  }
}

export const nexusPlanner = new NexusPlanner();
