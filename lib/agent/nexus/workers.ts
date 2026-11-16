/**
 * SoufAI Nexus Engine — Unified Specialized Worker Dispatcher
 *
 * Connects all 11 preserved/upgraded existing workers (including previously unscheduled
 * fileWorker, dependencyWorker, and securityWorker) PLUS 4 genuine-gap specialized agents:
 * - architecture_analyst
 * - database_engineer
 * - workflow_automation
 * - documentation_engineer
 *
 * Each invocation loads only relevant on-demand skills via NexusSkillRegistry,
 * routes models intelligently via NexusModelRouter, and logs skill activations.
 */

import { runCodingWorker } from "../engine/workers/codingWorker";
import { runDebugWorker } from "../engine/workers/debugWorker";
import { runDependencyWorker } from "../engine/workers/dependencyWorker";
import { runDesignWorker } from "../engine/workers/designWorker";
import { runFileWorker } from "../engine/workers/fileWorker";
import { runResearchWorker } from "../engine/workers/researchWorker";
import { runSandboxWorker } from "../engine/workers/sandboxWorker";
import { runSecurityWorker } from "../engine/workers/securityWorker";
import { runTestingWorker } from "../engine/workers/testingWorker";
import { runVerificationWorker } from "../engine/workers/verificationWorker";
import { runVisionWorker } from "../engine/workers/visionWorker";
import { nexusAgentRegistry } from "./agentRegistry";
import { nexusSkillRegistry } from "./skillsRegistry";
import { nexusModelRouter } from "./modelRouter";
import { nexusPersistenceManager } from "./persistenceManager";
import { NexusPersistenceError } from "./taskLifecycle";
import { getAbortError, isAbortError, throwIfAborted } from "../engine/abort";
import type {
  NexusAgentDefinition,
  NexusExecutionContext,
  NexusPlanNode,
} from "./types";

export interface NexusWorkerDispatchOutcome {
  success: boolean;
  output: Record<string, any>;
  error?: string;
  modelUsed?: string;
  providerUsed?: string;
  routingReason?: string;
  skillsLoaded: string[];
  artifactsProduced: string[];
}

async function listWorkspaceFiles(ctx: NexusExecutionContext): Promise<string[]> {
  const result = await ctx.invokeTool("search_files", {});
  if (!result.success) {
    throw new Error(result.error || "Could not inspect workspace files through NexusToolBridge.");
  }
  return Array.isArray(result.data?.files) ? result.data.files : [];
}

export async function dispatchNexusAgent(params: {
  agent: NexusAgentDefinition;
  node: NexusPlanNode;
  ctx: NexusExecutionContext;
}): Promise<NexusWorkerDispatchOutcome> {
  const { agent, node, ctx } = params;
  throwIfAborted(ctx.signal);

  // 1. On-demand contextual skill loading
  const composedSkills = nexusSkillRegistry.selectAndComposeForContext({
    goal: node.description || node.title,
    taskType: node.routingCriteria.requiresCoding ? "coding" : "general",
    agent,
    explicitSkillIds: node.requiredSkills,
    effectivePermissions: ctx.effectivePermissions,
    maxSkills: 4,
    maxSkillTokenBudget: 750,
  });

  const missingRequiredSkills = agent.requiredSkills.filter(
    (skillId) => !composedSkills.activeSkillIds.includes(skillId)
  );
  if (missingRequiredSkills.length > 0) {
    throw new Error(
      `Required skills could not be activated for agent '${agent.id}': ${missingRequiredSkills.join(", ")}`
    );
  }

  if (composedSkills.activations.length > 0) {
    try {
      await nexusPersistenceManager.recordSkillActivations(
        ctx.taskId,
        agent.id,
        composedSkills.activations,
        ctx.lease,
        node.id
      );
      throwIfAborted(ctx.signal);
    } catch (error) {
      throw new NexusPersistenceError(
        `Could not persist skill activations for task '${ctx.taskId}' and agent '${agent.id}'.`,
        error
      );
    }
  }

  const skillsLoaded = composedSkills.activeSkillIds;
  const artifactsProduced: string[] = [];

  try {
    switch (agent.id) {
      case "sandbox": {
        const res = await runSandboxWorker(
          {
            action: (node.inputArgs.action as any) || (ctx.sandboxId ? "get_status" : "create"),
            projectName: node.inputArgs.projectName || "SoufAI Project",
            framework: node.inputArgs.framework || ctx.sharedContext.framework || "react_nextjs",
            command: node.inputArgs.command,
            timeoutMs: node.inputArgs.timeoutMs,
          },
          ctx
        );
        if (res.success && res.data?.sandboxId) {
          ctx.sandboxId = res.data.sandboxId;
          ctx.sharedContext.sandboxId = res.data.sandboxId;
        }
        return {
          success: res.success,
          output: res.data || {},
          error: res.error,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "design": {
        const res = await runDesignWorker(
          {
            projectGoal: node.inputArgs.projectGoal || ctx.sharedContext.goal || node.title,
            preferredTheme: node.inputArgs.preferredTheme || ctx.sharedContext.themeArchetype,
          },
          ctx
        );
        ctx.sharedContext.designOutput = res;
        return {
          success: res.success,
          output: res as any,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "research": {
        const res = await runResearchWorker(
          {
            topic: node.inputArgs.topic || ctx.sharedContext.goal || node.title,
            depth: node.inputArgs.depth || "quick",
          },
          ctx
        );
        ctx.sharedContext.researchOutput = res;
        return {
          success: res.success,
          output: res as any,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "architecture_analyst": {
        const files = ctx.sandboxId ? await listWorkspaceFiles(ctx) : [];
        const { result, decision } = await nexusModelRouter.executeWithRouting(
          node.routingCriteria,
          {
            prompt: `Analyze the architecture for goal: "${node.inputArgs.taskGoal || ctx.sharedContext.goal || node.title}"
Existing workspace files: ${files.length > 0 ? files.join(", ") : "(empty workspace)"}
${ctx.sharedContext.projectMemorySummary ? `Project Memory:\n${ctx.sharedContext.projectMemorySummary}\n` : ""}
Provide strictly valid JSON:
{
  "impactedModules": ["module1"],
  "recommendedLayers": ["data", "orchestration", "api"],
  "blueprintSummary": "Concise architectural blueprint",
  "risks": ["risk 1"]
}`,
            systemInstruction: `${agent.systemInstructions}\n\n${composedSkills.mergedInstructions}`,
            responseMimeType: "application/json",
            signal: ctx.signal,
            timeoutMs: Math.min(node.timeoutMs, ctx.budget.stepTimeoutMs),
          }
        );

        const blueprintText = (result.text || "").trim();
        const blueprintStart = blueprintText.indexOf("{");
        const blueprintEnd = blueprintText.lastIndexOf("}");
        if (blueprintStart < 0 || blueprintEnd <= blueprintStart) {
          throw new Error("Architecture worker returned no valid JSON object.");
        }
        const blueprint = JSON.parse(
          blueprintText.slice(blueprintStart, blueprintEnd + 1)
        ) as Record<string, any>;
        if (
          typeof blueprint.blueprintSummary !== "string" ||
          !Array.isArray(blueprint.impactedModules)
        ) {
          throw new Error("Architecture worker output does not satisfy its required result contract.");
        }

        ctx.sharedContext.architectureBlueprint = blueprint;
        return {
          success: true,
          output: { success: true, blueprint, impactedModules: blueprint.impactedModules || [] },
          modelUsed: result.modelUsed || decision.selectedModel,
          providerUsed: result.providerUsed || decision.selectedProvider,
          routingReason: decision.reason,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "database_engineer": {
        const files = ctx.sandboxId ? await listWorkspaceFiles(ctx) : [];
        const dbFiles = files.filter((f) => /schema|db|turso|drizzle|migrate/i.test(f));

        const { result, decision } = await nexusModelRouter.executeWithRouting(
          node.routingCriteria,
          {
            prompt: `Design or audit Turso / libSQL & Drizzle SQLite persistence for goal:
"${node.inputArgs.taskGoal || ctx.sharedContext.goal || node.title}"
Related workspace DB files: ${dbFiles.length > 0 ? dbFiles.join(", ") : "(none yet)"}
Rules: Use drizzle-orm/sqlite-core types only, explicit indexes, Claim/Lease atomicity where needed, no destructive prod DDL.
Return JSON:
{
  "tables": [{"name": "example_table", "purpose": "...", "indexes": ["idx_..."]}],
  "recommendations": ["recommendation 1"],
  "summary": "..."
}`,
            systemInstruction: `${agent.systemInstructions}\n\n${composedSkills.mergedInstructions}`,
            responseMimeType: "application/json",
            signal: ctx.signal,
            timeoutMs: Math.min(node.timeoutMs, ctx.budget.stepTimeoutMs),
          }
        );

        const schemaText = (result.text || "").trim();
        const schemaStart = schemaText.indexOf("{");
        const schemaEnd = schemaText.lastIndexOf("}");
        if (schemaStart < 0 || schemaEnd <= schemaStart) {
          throw new Error("Database worker returned no valid JSON object.");
        }
        const schemaDesign = JSON.parse(
          schemaText.slice(schemaStart, schemaEnd + 1)
        ) as Record<string, any>;
        if (
          !Array.isArray(schemaDesign.tables) ||
          !Array.isArray(schemaDesign.recommendations) ||
          typeof schemaDesign.summary !== "string"
        ) {
          throw new Error("Database worker output does not satisfy its required result contract.");
        }

        ctx.sharedContext.databaseDesign = schemaDesign;
        return {
          success: true,
          output: {
            success: true,
            schemaDesign,
            recommendations: schemaDesign.recommendations || [],
          },
          modelUsed: result.modelUsed || decision.selectedModel,
          providerUsed: result.providerUsed || decision.selectedProvider,
          routingReason: decision.reason,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "coding": {
        const designGuidanceParts: string[] = [];
        if (ctx.sharedContext.designOutput?.guidancePrompt) {
          designGuidanceParts.push(ctx.sharedContext.designOutput.guidancePrompt);
        }
        if (ctx.sharedContext.architectureBlueprint?.blueprintSummary) {
          designGuidanceParts.push(`Architecture Blueprint: ${ctx.sharedContext.architectureBlueprint.blueprintSummary}`);
        }
        if (ctx.sharedContext.databaseDesign?.summary) {
          designGuidanceParts.push(`Database Guidance: ${ctx.sharedContext.databaseDesign.summary}`);
        }
        if (composedSkills.mergedInstructions) {
          designGuidanceParts.push(composedSkills.mergedInstructions);
        }

        const res = await runCodingWorker(
          {
            taskGoal: node.inputArgs.taskGoal || ctx.sharedContext.goal || node.title,
            framework: node.inputArgs.framework || ctx.sharedContext.framework,
            designGuidance: designGuidanceParts.join("\n\n"),
            researchContext: ctx.sharedContext.researchOutput?.extractedDocs,
            filesToUpdate: node.inputArgs.filesToUpdate,
          },
          ctx
        );
        const created = res.filesCreated || [];
        const modified = res.filesModified || [];
        artifactsProduced.push(...created, ...modified);
        ctx.sharedContext.codingRes = {
          filesCreated: [...(ctx.sharedContext.codingRes?.filesCreated || []), ...created],
          filesModified: [...(ctx.sharedContext.codingRes?.filesModified || []), ...modified],
        };
        return {
          success: res.success,
          output: res as any,
          error: res.error,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "file": {
        const res = await runFileWorker(
          {
            action: (node.inputArgs.action as any) || "search",
            filePath: node.inputArgs.filePath,
            content: node.inputArgs.content,
            pattern: node.inputArgs.pattern,
          },
          ctx
        );
        if (res.success && node.inputArgs.filePath && (node.inputArgs.action === "create" || node.inputArgs.action === "edit")) {
          artifactsProduced.push(node.inputArgs.filePath);
        }
        return {
          success: res.success,
          output: res as any,
          error: res.error,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "dependency": {
        const res = await runDependencyWorker(
          {
            action: (node.inputArgs.action as any) || "verify",
            packages: Array.isArray(node.inputArgs.packages) ? node.inputArgs.packages : [],
            isDev: Boolean(node.inputArgs.isDev),
          },
          ctx
        );
        return {
          success: res.success,
          output: res as any,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "security": {
        const files = ctx.sandboxId ? await listWorkspaceFiles(ctx) : [];
        const allViolations: string[] = [];

        // Audit explicit input if provided
        if (node.inputArgs.command || node.inputArgs.filePath || node.inputArgs.codeContent) {
          const res = await runSecurityWorker(node.inputArgs, ctx);
          if (!res.isSafe) allViolations.push(...res.violations);
        }

        // Audit workspace files for path or secret exposure
        if (ctx.sandboxId) {
          for (const fp of files.slice(0, 40)) {
            const fileResult = await ctx.invokeTool("read_file", { filePath: fp });
            if (!fileResult.success) {
              throw new Error(fileResult.error || `Could not read '${fp}' through NexusToolBridge.`);
            }
            const content = fileResult.data?.content || "";
            const res = await runSecurityWorker({ filePath: fp, codeContent: content }, ctx);
            if (!res.isSafe) {
              allViolations.push(...res.violations.map((v) => `${fp}: ${v}`));
            }
          }
        }

        return {
          success: allViolations.length === 0,
          output: { isSafe: allViolations.length === 0, violations: allViolations, filesAudited: files.length },
          error: allViolations.length > 0 ? allViolations.join(" | ") : undefined,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "testing": {
        let testRes = await runTestingWorker(ctx);
        ctx.sharedContext.qualityReport = testRes.qualityReport;

        // Bounded self-healing delegation to Debug Agent on test/build failure
        if (!testRes.success && testRes.errorLog && ctx.delegationDepth < ctx.budget.maxDelegationDepth) {
          const debugDelegation = await ctx.delegateToAgent(
            "debug",
            "Auto-diagnose and repair build/test errors reported by Testing Agent",
            { errorLog: testRes.errorLog }
          );
          if (debugDelegation.success && debugDelegation.output?.recoveryApplied) {
            const fixed: string[] = debugDelegation.output.fixedFiles || [];
            artifactsProduced.push(...fixed);
            testRes = await runTestingWorker(ctx);
            ctx.sharedContext.qualityReport = testRes.qualityReport;
          }
        }

        return {
          success: testRes.success,
          output: testRes as any,
          error: testRes.errorLog,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "debug": {
        const res = await runDebugWorker(
          {
            errorLog: node.inputArgs.errorLog || "Inspect workspace logs and fix errors",
            failedCommand: node.inputArgs.failedCommand,
          },
          ctx
        );
        artifactsProduced.push(...(res.fixedFiles || []));
        return {
          success: res.success,
          output: res as any,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "vision": {
        const res = await runVisionWorker(ctx);
        ctx.sharedContext.visionEvaluation = res.evaluation;
        return {
          success: res.success,
          output: res as any,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "workflow_automation": {
        const action = String(node.inputArgs.action || "list_scheduled");
        if (action === "enqueue_job" && node.inputArgs.jobType) {
          const result = await ctx.invokeTool("enqueue_worker_job", {
            type: String(node.inputArgs.jobType),
            payload: node.inputArgs.payload || {},
          }, { idempotencyKey: node.idempotencyKey });
          if (!result.success) throw new Error(result.error || "Could not enqueue the worker job.");
          return {
            success: true,
            output: {
              success: true,
              scheduledItems: [result.data?.job],
              summary: `Queued worker job ${result.data?.job?.id || ""}`,
            },
            skillsLoaded,
            artifactsProduced,
          };
        }
        if (action === "create_schedule" && node.inputArgs.title && node.inputArgs.targetTimestamp) {
          const ts = Number(node.inputArgs.targetTimestamp);
          const result = await ctx.invokeTool("task_create", {
            title: String(node.inputArgs.title),
            prompt: String(node.inputArgs.prompt || node.inputArgs.title),
            type: (node.inputArgs.type as any) || "general_task",
            dueDate: new Date(ts).toISOString(),
            recurrence: (node.inputArgs.recurrence as any) || "once",
          });
          if (!result.success) throw new Error(result.error || "Could not create the scheduled task.");
          return {
            success: true,
            output: {
              success: true,
              scheduledItems: [result.data?.task],
              summary: `Scheduled task ${result.data?.task?.id || ""}`,
            },
            skillsLoaded,
            artifactsProduced,
          };
        }

        const result = await ctx.invokeTool("task_list", { filter: "all" });
        if (!result.success) throw new Error(result.error || "Could not list scheduled tasks.");
        const existing = result.data?.tasks || [];
        return {
          success: true,
          output: {
            success: true,
            scheduledItems: existing,
            summary: `Retrieved ${existing.length} scheduled workflow items for user.`,
          },
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "documentation_engineer": {
        const files = ctx.sandboxId ? await listWorkspaceFiles(ctx) : [];
        const { result, decision } = await nexusModelRouter.executeWithRouting(
          node.routingCriteria,
          {
            prompt: `Generate concise, code-verified technical documentation for:
Goal: "${node.inputArgs.taskGoal || ctx.sharedContext.goal || node.title}"
Verified files present in workspace: ${files.length > 0 ? files.join(", ") : "(none)"}
Architecture notes: ${ctx.sharedContext.architectureBlueprint?.blueprintSummary || "N/A"}
Quality report: ${JSON.stringify(ctx.sharedContext.qualityReport || {})}

Rules: Document only verified files/behaviors actually observed above. Do not fabricate endpoints or tests.`,
            systemInstruction: `${agent.systemInstructions}\n\n${composedSkills.mergedInstructions}`,
            signal: ctx.signal,
            timeoutMs: Math.min(node.timeoutMs, ctx.budget.stepTimeoutMs),
          }
        );

        ctx.sharedContext.documentationOutput = result.text;
        return {
          success: true,
          output: {
            success: true,
            documentContent: result.text || "",
            verifiedFiles: files,
          },
          modelUsed: result.modelUsed || decision.selectedModel,
          providerUsed: result.providerUsed || decision.selectedProvider,
          routingReason: decision.reason,
          skillsLoaded,
          artifactsProduced,
        };
      }

      case "verification": {
        const res = await runVerificationWorker(
          {
            taskGoal: node.inputArgs.taskGoal || ctx.sharedContext.goal || node.title,
            expectedFiles: node.inputArgs.expectedFiles,
            qualityThreshold: node.inputArgs.qualityThreshold ?? 65,
          },
          ctx
        );
        return {
          success: res.isVerified,
          output: res as any,
          error: res.unresolvedIssues.length > 0 ? res.unresolvedIssues.join(" | ") : undefined,
          skillsLoaded,
          artifactsProduced,
        };
      }

      default: {
        const fallbackAgent = nexusAgentRegistry.getAgent(agent.id);
        return {
          success: false,
          output: {},
          error: `No executable worker handler mapped for agent '${fallbackAgent?.id || agent.id}'.`,
          skillsLoaded,
          artifactsProduced,
        };
      }
    }
  } catch (err: any) {
    if (err instanceof NexusPersistenceError) {
      throw err;
    }
    if (isAbortError(err, ctx.signal)) throw getAbortError(ctx.signal);
    return {
      success: false,
      output: {},
      error: err?.message || String(err),
      skillsLoaded,
      artifactsProduced,
    };
  }
}
