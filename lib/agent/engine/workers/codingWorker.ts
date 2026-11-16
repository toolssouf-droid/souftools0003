/**
 * SoufAI Agent Engine - Specialized Coding Worker
 * 
 * Specializes in multi-file software engineering, framework scaffolding,
 * architectural planning, and precise code implementation.
 */

import { EngineExecutionContext } from "../types";
import { executeRoutedPrompt } from "@/lib/router";
import { getAbortError, isAbortError, throwIfAborted } from "../abort";
import { invokeWorkerTool } from "../contextTools";

export interface CodingWorkerInput {
  taskGoal: string;
  framework?: string;
  designGuidance?: string;
  researchContext?: string;
  filesToUpdate?: string[];
}

export interface CodingWorkerResult {
  success: boolean;
  filesCreated: string[];
  filesModified: string[];
  summary: string;
  error?: string;
}

export async function runCodingWorker(
  input: CodingWorkerInput,
  ctx: EngineExecutionContext
): Promise<CodingWorkerResult> {
  throwIfAborted(ctx.signal);
  await ctx.emitEvent("agent.subtask.started", "بدء عمل Coding Agent في هندسة وكتابة الكود", {
    agentWorker: "coding",
    status: "running",
  });

  const fileListResult = ctx.sandboxId
    ? await invokeWorkerTool(ctx, "search_files")
    : { success: true, data: { files: [] } };
  if (!fileListResult.success) {
    throw new Error(fileListResult.error || "Could not inspect the sandbox workspace.");
  }
  const existingFileList = fileListResult.data?.files || [];

  const prompt = `أنت مهندس برمجيات محترف (Senior Principal Software Engineer) ضمن محرك SoufAI.
المهمة البرمجية: "${input.taskGoal}"
إطار العمل المعتمد: ${input.framework || "react_nextjs"}
${input.designGuidance ? `إرشادات التصميم والهوية البصرية:\n${input.designGuidance}` : ""}
${input.researchContext ? `نتائج البحث والتوثيق:\n${input.researchContext}` : ""}

الملفات الحالية في المشروع:
${existingFileList.length > 0 ? existingFileList.join(", ") : "(مشروع جديد فارغ)"}

المطلوب:
1. اكتب الملفات البرمجية الأساسية كاملة وبأعلى جودة برمجية وتصميمية (Clean Architecture, TypeScript, Tailwind CSS, Lucide icons, Responsive).
2. يجب توفير كود كامل غير منقوص (بدون "// TODO" أو استبدال الكود بتعليقات).
3. أخرج النتيجة بتنسيق JSON حصرياً كالتالي:
{
  "summary": "ملخص ما تم برمجته",
  "files": [
    {
      "path": "src/App.tsx",
      "action": "create", // "create" أو "edit"
      "content": "الكود البرمجي الكامل"
    }
  ]
}`;

  try {
    const aiResponse = await executeRoutedPrompt({
      prompt,
      modelId: "coder",
      systemInstruction: "أنت مهندس برمجيات عالي الدقة في SoufAI. أرجع كوداً حقيقياً كاملاً بتنسيق JSON فقط.",
      signal: ctx.signal,
      timeoutMs: 120000,
    });
    throwIfAborted(ctx.signal);

    let cleaned = (aiResponse.text || "").trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
    }

    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    let parsed: any = null;
    try {
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } else if (cleaned) {
        parsed = JSON.parse(cleaned);
      }
    } catch (parseErr) {
      console.warn("CodingWorker: JSON parse failed for output candidate:", parseErr);
      parsed = null;
    }

    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    const toolErrors: string[] = [];

    if (parsed && Array.isArray(parsed.files)) {
      for (const f of parsed.files) {
        throwIfAborted(ctx.signal);
        if (!f.path || !f.content) continue;
        const toolName = f.action === "edit" || existingFileList.includes(f.path) ? "edit_file" : "create_file";
        const res = await invokeWorkerTool(ctx, toolName, {
          filePath: f.path,
          content: f.content,
        }, {
          idempotencyKey: `${ctx.subtaskId || ctx.taskId}:coding:${f.path}`,
          timeoutMs: 30000,
        });
        if (res.success) {
          if (toolName === "create_file") filesCreated.push(f.path);
          else filesModified.push(f.path);
        } else {
          toolErrors.push(`${f.path}: ${res.error || "Tool execution failed."}`);
        }
      }
    }
    throwIfAborted(ctx.signal);

    await ctx.emitEvent(
      "agent.subtask.completed",
      `تمت كتابة وتطبيق ${filesCreated.length + filesModified.length} ملفات برمجية`,
      {
        agentWorker: "coding",
        status: "completed",
        summary: parsed?.summary || "تم إنجاز الهيكل البرمجي بنجاح",
      }
    );

    return {
      success: toolErrors.length === 0,
      filesCreated,
      filesModified,
      summary: parsed?.summary || "تم تنفيذ الأكواد البرمجية المطلوبة بنجاح",
      error: toolErrors.length ? toolErrors.join("; ") : undefined,
    };
  } catch (err: any) {
    if (isAbortError(err, ctx.signal)) throw getAbortError(ctx.signal);
    await ctx.emitEvent("agent.subtask.failed", `فشل في كتابة الأكواد: ${err.message}`, {
      agentWorker: "coding",
      status: "failed",
    });
    return {
      success: false,
      filesCreated: [],
      filesModified: [],
      summary: "فشل أثناء كتابة وتطبيق الملفات البرمجية",
      error: err.message,
    };
  }
}
