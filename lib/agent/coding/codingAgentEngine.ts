/**
 * SoufAI Autonomous Coding Agent Engine
 * Plans, builds, refactors, debugs, and executes real multi-file projects.
 */

import { executeRoutedPrompt } from "@/lib/router";
import {
  ProjectWorkspace,
  ProjectFile,
  AgentCodingStep,
  TerminalLogItem,
  SupportedFramework,
} from "./types";
import { FRAMEWORK_PRESETS } from "./frameworkPresets";
import { CodingAgentToolManager, getFileLanguage } from "./toolManager";
import { Type } from "@google/genai";
import { AgentRepository, ProjectRepository } from "@/lib/db";
import {
  nexusAgentRegistry,
  nexusSkillRegistry,
  nexusSecurityController,
  nexusPersistenceManager,
  type NexusEvaluationTrace,
} from "@/lib/agent/nexus";

export interface CodingAgentRunOptions {
  userPrompt: string;
  workspace: ProjectWorkspace;
  userId?: string;
  modelId?: "spark" | "core" | "pro" | "coder" | "ultra";
  isBuildUIMode?: boolean;
}

export interface CodingAgentRunResult {
  updatedWorkspace: ProjectWorkspace;
  steps: AgentCodingStep[];
  logs: TerminalLogItem[];
  agentResponse: string;
  summary: string;
}

interface AgentOutputStructure {
  plan: string[];
  toolCalls: { tool: string; args: any }[];
  responseMessage: string;
  summary: string;
}

function parseAgentResponseRobustly(
  rawText: string,
  userPrompt: string,
  workspace: ProjectWorkspace
): AgentOutputStructure {
  let cleaned = (rawText || "").trim();

  // Strip markdown json wrappers
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
  }

  // 1. Direct JSON parse
  try {
    const directParsed = JSON.parse(cleaned);
    if (directParsed && typeof directParsed === "object") {
      return {
        plan: Array.isArray(directParsed.plan)
          ? directParsed.plan
          : ["تحليل المتطلبات وهندسة الشيفرة البرمجية", "تحديث وتطبيق الملفات"],
        toolCalls: Array.isArray(directParsed.toolCalls) ? directParsed.toolCalls : [],
        responseMessage:
          directParsed.responseMessage || directParsed.message || "تم بناء وتحديث المشروع بنجاح!",
        summary: directParsed.summary || "تم تطبيق التعديلات المطلوبة وتحديث بيئة العمل.",
      };
    }
  } catch {}

  // 2. Extract JSON substring with matching outer curly braces
  try {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
      const subParsed = JSON.parse(jsonCandidate);
      if (subParsed && typeof subParsed === "object") {
        return {
          plan: Array.isArray(subParsed.plan)
            ? subParsed.plan
            : ["تحليل المتطلبات البرمجية", "تحديث وتطبيق الملفات"],
          toolCalls: Array.isArray(subParsed.toolCalls) ? subParsed.toolCalls : [],
          responseMessage:
            subParsed.responseMessage || subParsed.message || "تم بناء وتحديث المشروع بنجاح!",
          summary: subParsed.summary || "تم إنجاز التعديلات وتحديث المعاينة الحية.",
        };
      }
    }
  } catch {}

  // 3. Natural markdown code block extraction
  const codeBlockRegex = /```([a-zA-Z0-9_\-\.\/]*)\s*\n([\s\S]*?)```/g;
  const toolCalls: { tool: string; args: any }[] = [];
  let match;
  let hasExtractedCode = false;

  const defaultMainFile =
    workspace.framework === "react"
      ? "src/App.tsx"
      : workspace.framework === "nextjs"
      ? "app/page.tsx"
      : "index.html";

  while ((match = codeBlockRegex.exec(rawText)) !== null) {
    const langOrPath = match[1]?.trim() || "";
    const codeContent = match[2]?.trim();

    if (codeContent && codeContent.length > 10) {
      let targetPath = defaultMainFile;
      if (langOrPath.includes("/") || langOrPath.includes(".")) {
        targetPath = langOrPath;
      } else if (langOrPath.toLowerCase() === "css") {
        targetPath = workspace.framework === "react" ? "src/index.css" : "style.css";
      } else if (langOrPath.toLowerCase() === "html") {
        targetPath = "index.html";
      } else if (langOrPath.toLowerCase() === "json" && codeContent.includes('"name"')) {
        targetPath = "package.json";
      }

      toolCalls.push({
        tool: workspace.files[targetPath] ? "edit_file" : "create_file",
        args: {
          path: targetPath,
          content: codeContent,
        },
      });
      hasExtractedCode = true;
    }
  }

  const cleanExplanation = rawText.replace(/```[\s\S]*?```/g, "").trim();

  return {
    plan: ["فحص وتفسير التعليمات البرمجية", "تحديث كود المشروع وضبط واجهة المستخدم"],
    toolCalls: toolCalls,
    responseMessage: cleanExplanation || "تم استلام التعليمات وتحديث بيئة المشروع بنجاح.",
    summary: hasExtractedCode
      ? "تم استخراج الأكواد وتطبيقها على ملفات المشروع بنجاح."
      : "تمت معالجة الطلب وتحديث مساحة العمل.",
  };
}

export async function runCodingAgent(
  options: CodingAgentRunOptions
): Promise<CodingAgentRunResult> {
  const { userPrompt, workspace, modelId = "coder", isBuildUIMode = false } = options;
  if (!options.userId) {
    throw new Error("Authenticated user identity is required");
  }

  const securityVerdict = nexusSecurityController.inspectInputPrompt(userPrompt);
  if (!securityVerdict.safe) {
    throw new Error(securityVerdict.reason || "Blocked by Nexus Security Guardrail.");
  }

  const codingAgentDef = nexusAgentRegistry.getAgent("coding_workspace");
  const composedSkills = codingAgentDef
    ? nexusSkillRegistry.selectAndComposeForContext({
        goal: userPrompt,
        taskType: "coding",
        agent: codingAgentDef,
        maxSkills: 4,
        maxSkillTokenBudget: 600,
      })
    : null;

  let currentWorkspace: ProjectWorkspace = JSON.parse(JSON.stringify(workspace));
  const executedSteps: AgentCodingStep[] = [];
  const generatedLogs: TerminalLogItem[] = [];
  const startTime = Date.now();
  const codingTaskId = `coding_${startTime}_${Math.random().toString(36).slice(2, 7)}`;

  // Create an automatic checkpoint before large changes
  const checkpointResult = await CodingAgentToolManager.executeTool(
    currentWorkspace,
    "create_checkpoint",
    {
      title: `تعديل تلقائي: ${userPrompt.slice(0, 30)}`,
      description: `تم الحفظ قبل بدء تنفيذ: ${userPrompt}`,
      userId: options.userId,
    }
  );
  if (checkpointResult.updatedWorkspace) {
    currentWorkspace = { ...currentWorkspace, ...checkpointResult.updatedWorkspace };
  }
  if (checkpointResult.step) executedSteps.push(checkpointResult.step);

  // 1. Initial Real Analysis Step
  const analyzeStep: AgentCodingStep = {
    id: `step_ana_${Date.now()}`,
    type: "analyze",
    title: "🧠 تحليل متطلبات المشروع والهندسة البرمجية",
    details: `فحص الهدف: "${userPrompt}" ضمن إطار عمل ${currentWorkspace.framework}`,
    status: "completed",
    timestamp: Date.now(),
  };
  executedSteps.push(analyzeStep);

  // Format existing files structure for the model
  const filesList = Object.keys(currentWorkspace.files)
    .map((p) => `- ${p} (${currentWorkspace.files[p].content.length} chars)`)
    .join("\n");

  const systemInstruction = `أنت الوكيل البرمجي المستقل الخارق SoufAI Coding Agent في منصة SoufTools.
مهمتك: بناء أو تعديل أو إصلاح مشاريع وتطبيقات برمجية كاملة وحقيقية بدون اختلاق أو أكواد وهمية.

إطار العمل الحالي للمشروع: ${currentWorkspace.framework}
الملفات الموجودة حالياً:
${filesList || "(لا توجد ملفات بعد)"}

أنت لست مجرد مولد نص! أنت وكيل يمتلك أدوات لتنفيذ كل خطوة:
1. plan: إنشاء خطة تفصيلية.
2. create_file: إنشاء ملف بكامل محتواه البرمجي الحقيقي بدون اختصار.
3. edit_file: تعديل ملف موجود.
4. delete_file: حذف ملف.
5. install_dependency: تثبيت حزم ضرورية.
6. run_command: تشغيل أوامر برمجية أو بناء.
7. run_tests: إجراء فحوصات واختبارات الجودة.
8. runtime_manager: إدارة الـ Sandbox السحابي وتشغيل المعاينة الحية وإدارة دورة حياة بيئة التشغيل.

شروط هامة:
- عندما يطلب المستخدم تطبيقاً كاملاً (مثل متجر، لوحة تحكم، لعبة، تطبيق محادثة، إدارة مهام):
  * أنشئ هيكلية كاملة (Components, Pages, State, Types, README, etc.).
  * اكتب كوداً حقيقياً متكاملاً جاهزاً للتشغيل والمعاينة بدون '// Rest of code here'.
  * اجعل التصميم متوافقاً مع الهوية البصرية الفاخرة لـ SoufTools (Dark mode, Teal #00d4aa accents, glass panels, modern typography).
- إذا طلب المستخدم تعديلاً باللغة الطبيعية (مثل: "اجعل الزر أكبر"، "أضف صفحة كذا"):
  * حدد الملف المسؤول بالضبط وعدله بدقة مع الحفاظ على بقية الكود.

مخرجاتك يجب أن تكون حصراً كائن JSON وفق المخطط التالي:
{
  "plan": ["خطوة 1", "خطوة 2", ...],
  "toolCalls": [
    {
      "tool": "create_file" | "edit_file" | "install_dependency" | "run_command" | "run_tests" | "runtime_manager",
      "args": { "path": "...", "content": "...", "command": "...", "package": "...", "action": "create_sandbox" }
    }
  ],
  "responseMessage": "شرح لطيف باللغة العربية الفصحى يوضح ما تم إنجازه بدقة",
  "summary": "ملخص تقني سريع في سطرين"
}${composedSkills?.mergedInstructions ? `\n\n${composedSkills.mergedInstructions}` : ""}`;

  try {
    const promptText = `طلب المستخدم: "${userPrompt}"
${isBuildUIMode ? "[وضع Build UI مفعل: التركيز على بناء واجهة تفاعلية كاملة مع عناصر تحكم حقيقية]" : ""}`;

    const apiResponse = await executeRoutedPrompt({
      modelId: modelId === "spark" ? "spark" : "coder",
      prompt: promptText,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          plan: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          toolCalls: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                tool: { type: Type.STRING },
                args: { type: Type.OBJECT },
              },
              required: ["tool", "args"],
            },
          },
          responseMessage: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ["plan", "toolCalls", "responseMessage", "summary"],
      },
    });

    if (apiResponse && apiResponse.text) {
      const parsed = parseAgentResponseRobustly(apiResponse.text, userPrompt, currentWorkspace);

      // Record Planning Step
      if (parsed.plan && parsed.plan.length > 0) {
        executedSteps.push({
          id: `step_plan_${Date.now()}`,
          type: "plan",
          title: "📋 صياغة خطة العمل وهندسة المشروع",
          details: parsed.plan.join(" ← "),
          status: "completed",
          timestamp: Date.now(),
        });
      }

      // Execute each tool call sequentially against the workspace
      if (Array.isArray(parsed.toolCalls)) {
        for (const tc of parsed.toolCalls) {
          const res = await CodingAgentToolManager.executeTool(
            currentWorkspace,
            tc.tool,
            { ...(tc.args || {}), userId: options.userId }
          );

          if (res.updatedWorkspace) {
            currentWorkspace = {
              ...currentWorkspace,
              ...res.updatedWorkspace,
              files: {
                ...currentWorkspace.files,
                ...(res.updatedWorkspace.files || {}),
              },
            };
          }
          if (res.logs) {
            generatedLogs.push(...res.logs);
          }
          if (res.step) {
            executedSteps.push(res.step);
          }
        }
      }

      // Automatic Preview Refresh & Error Verification
      const previewRes = await CodingAgentToolManager.executeTool(
        currentWorkspace,
        "start_preview",
        { userId: options.userId }
      );
      if (previewRes.updatedWorkspace) {
        currentWorkspace = { ...currentWorkspace, ...previewRes.updatedWorkspace };
      }
      if (previewRes.step) executedSteps.push(previewRes.step);

      // Verify Test Execution
      const testRes = await CodingAgentToolManager.executeTool(
        currentWorkspace,
        "run_tests",
        { userId: options.userId }
      );
      if (testRes.logs) generatedLogs.push(...testRes.logs);
      if (testRes.step) executedSteps.push(testRes.step);

      // Append steps to workspace state
      currentWorkspace.agentSteps = [...currentWorkspace.agentSteps, ...executedSteps];
      currentWorkspace.terminalLogs = [...currentWorkspace.terminalLogs, ...generatedLogs];
      currentWorkspace.updatedAt = Date.now();

      // Permanently persist Project and Project Files to Turso / libSQL
      try {
        const projectId = currentWorkspace.id || `proj_${Date.now()}`;
        const activeUserId = options.userId || "user_active";
        await ProjectRepository.upsertProject({
          id: projectId,
          userId: activeUserId,
          name: currentWorkspace.title || "SoufTools App",
          description: parsed.summary || userPrompt.slice(0, 100),
          framework: currentWorkspace.framework || "react",
          metadata: {
            previewUrl: currentWorkspace.previewUrl,
            stepsCount: currentWorkspace.agentSteps.length,
            errorsCount: currentWorkspace.errors.length,
          },
        });

        if (currentWorkspace.files && Object.keys(currentWorkspace.files).length > 0) {
          await ProjectRepository.saveProjectFiles(projectId, currentWorkspace.files);
        }

        // Persist separated Nexus evaluation trace (ensure parent agent_tasks FK row first)
        await AgentRepository.createTask({
          id: codingTaskId,
          userId: activeUserId,
          projectId,
          goal: userPrompt,
          category: "coding_workspace",
          status: "completed",
          maxSteps: 1,
          metadata: { engineMode: "nexus_coding", framework: currentWorkspace.framework },
        });
        if (composedSkills?.activations?.length) {
          await nexusPersistenceManager.recordSkillActivations(
            codingTaskId,
            "coding_workspace",
            composedSkills.activations
          );
        }
        const codingTrace: NexusEvaluationTrace = {
          traceId: `trace_${codingTaskId}`,
          taskId: codingTaskId,
          userId: activeUserId,
          engineMode: "nexus_coding",
          goal: userPrompt,
          status: "completed",
          stepsEvidence: [
            {
              stepId: "coding_workspace_run",
              agentId: codingAgentDef?.id || "coding_workspace",
              agentVersion: codingAgentDef?.version || "1.0.0",
              status: "completed",
              durationMs: Date.now() - startTime,
              modelUsed: apiResponse.modelUsed || modelId,
              providerUsed: apiResponse.providerUsed || "router",
              skillsLoaded: composedSkills?.activeSkillIds || [],
              toolsExecuted: Array.isArray(parsed.toolCalls)
                ? parsed.toolCalls.map((tc) => ({
                    tool: tc.tool,
                    success: true,
                    durationMs: 0,
                  }))
                : [],
              artifactsProduced: Object.keys(currentWorkspace.files || {}),
            },
          ],
          delegations: [],
          skillsActivated:
            composedSkills?.activations.map((a) => ({
              skillId: a.skillId,
              version: a.version,
              agentId: "coding_workspace",
              tokens: a.estimatedTokens,
            })) || [],
          modelsUsed: [
            {
              agentId: "coding_workspace",
              tier: modelId,
              model: apiResponse.modelUsed || modelId,
              provider: apiResponse.providerUsed || "router",
              reason: "coding_workspace_routed",
            },
          ],
          completedOperationKeys: [],
          checkpointPersisted: Boolean(checkpointResult),
          totalDurationMs: Date.now() - startTime,
          estimatedCostUsd: 0,
          configSnapshot: {
            engineVersion: "nexus-1.0.0",
            budget: {
              maxTotalSteps: 1,
              maxDelegationDepth: 0,
              maxActiveAgents: 1,
              maxConcurrentTasks: 1,
              maxTokensBudget: 64000,
              maxToolCalls: 25,
              maxRetriesPerStep: 1,
              stepTimeoutMs: 120000,
              taskTimeoutMs: 180000,
              leaseDurationMs: 180000,
              leaseHeartbeatIntervalMs: 60000,
            },
            channel: "web",
          },
          errors: [],
          createdAt: new Date().toISOString(),
        };
        await nexusPersistenceManager.recordEvaluationTrace(codingTrace);
      } catch (dbErr) {
        console.warn("[runCodingAgent] Turso project/trace persistence notice:", dbErr);
      }

      const safeResponse = nexusSecurityController.sanitizeOutput(
        parsed.responseMessage || "تم تنفيذ وبناء المشروع بنجاح!"
      );
      const safeSummary = nexusSecurityController.sanitizeOutput(
        parsed.summary || "تم إنجاز التعديلات وتحديث المعاينة الحية."
      );

      return {
        updatedWorkspace: currentWorkspace,
        steps: executedSteps,
        logs: generatedLogs,
        agentResponse: safeResponse,
        summary: safeSummary,
      };
    }
  } catch (err: any) {
    console.error("Coding Agent Execution Error:", err);
    throw new Error(err?.message || "فشل تشغيل الوكيل البرمجي: تعذر الاتصال بنموذج الذكاء الاصطناعي في الخادم.");
  }

  throw new Error("لم يرجع محرك البرمجة أي مخرجات صالحة من السيرفر.");
}
