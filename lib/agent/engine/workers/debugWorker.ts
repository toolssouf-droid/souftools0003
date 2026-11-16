/**
 * SoufAI Agent Engine - Specialized Debug Worker
 * 
 * Automatically diagnoses build errors, TypeScript failures, syntax errors,
 * imports mismatches, and applies surgical code corrections.
 */

import { EngineExecutionContext } from "../types";
import { executeRoutedPrompt } from "@/lib/router";
import { getAbortError, isAbortError, throwIfAborted } from "../abort";
import { invokeWorkerTool } from "../contextTools";

export interface DebugWorkerInput {
  errorLog: string;
  failedCommand?: string;
  maxAttempts?: number;
}

export interface DebugWorkerResult {
  success: boolean;
  fixedFiles: string[];
  diagnosis: string;
  recoveryApplied: boolean;
}

export async function runDebugWorker(
  input: DebugWorkerInput,
  ctx: EngineExecutionContext
): Promise<DebugWorkerResult> {
  throwIfAborted(ctx.signal);
  await ctx.emitEvent("debug.started", "بدء تشخيص الأخطاء البرمجية عبر Debug Agent", {
    agentWorker: "debug",
    status: "running",
    summary: input.errorLog.slice(0, 120),
  });

  const fileListResult = ctx.sandboxId
    ? await invokeWorkerTool(ctx, "search_files")
    : { success: true, data: { files: [] } };
  if (!fileListResult.success) {
    throw new Error(fileListResult.error || "Could not inspect the sandbox workspace.");
  }
  const currentFilesList = fileListResult.data?.files || [];

  const prompt = `أنت خبير إصلاح وتصحيح الأخطاء البرمجية (Staff Debug Engineer) في SoufAI.
حدث خطأ أثناء بناء أو تشغيل المشروع:
سجل الخطأ (Error Logs):
${input.errorLog.slice(0, 3000)}

الملفات المتاحة في المشروع:
${currentFilesList.join(", ")}

المطلوب:
1. حدد بدقة الملف والسطر المسبب للخطأ وسبب الفشل الجذري (Root Cause).
2. قدم التعديل البرمجي السليم لإصلاح الخطأ تماماً وبأقل تعديل جراحي ممكن.
3. أخرج النتيجة بتنسيق JSON حصرياً كالتالي:
{
  "diagnosis": "شرح سبب الخطأ",
  "fixedFiles": [
    {
      "path": "src/components/Hero.tsx",
      "content": "الكود المصحح الكامل للملف"
    }
  ]
}`;

  try {
    const aiRes = await executeRoutedPrompt({
      prompt,
      modelId: "coder",
      systemInstruction: "أنت مهندس تصحيح أخطاء فائق الدقة. أخرج كود الإصلاح الكامل كـ JSON فقط.",
      signal: ctx.signal,
      timeoutMs: 120000,
    });
    throwIfAborted(ctx.signal);

    let cleaned = (aiRes.text || "").trim();
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
      console.warn("DebugWorker: JSON parse failed for output candidate:", parseErr);
      parsed = null;
    }

    const fixedFiles: string[] = [];
    if (parsed && Array.isArray(parsed.fixedFiles)) {
      for (const f of parsed.fixedFiles) {
        throwIfAborted(ctx.signal);
        if (!f.path || !f.content) continue;
        const res = await invokeWorkerTool(ctx, "edit_file", {
          filePath: f.path,
          content: f.content,
        }, { idempotencyKey: `${ctx.subtaskId || ctx.taskId}:debug:${f.path}` });
        if (!res.success) {
          throw new Error(res.error || `Could not edit '${f.path}'.`);
        }
        fixedFiles.push(f.path);
      }
    }
    throwIfAborted(ctx.signal);

    await ctx.emitEvent("debug.completed", `تم تصحيح وتحديث ${fixedFiles.length} ملفات برمجية`, {
      agentWorker: "debug",
      status: "completed",
      summary: parsed?.diagnosis || "تم تطبيق الإصلاحات الجراحية",
    });

    return {
      success: fixedFiles.length > 0,
      fixedFiles,
      diagnosis: parsed?.diagnosis || "تم تصحيح الأخطاء المكتشفة بنجاح",
      recoveryApplied: fixedFiles.length > 0,
    };
  } catch (err: any) {
    if (isAbortError(err, ctx.signal)) throw getAbortError(ctx.signal);
    await ctx.emitEvent("debug.completed", `فشل تشخيص الخطأ: ${err.message}`, {
      agentWorker: "debug",
      status: "failed",
    });
    return {
      success: false,
      fixedFiles: [],
      diagnosis: "فشل أثناء تحليل سجلات الخطأ",
      recoveryApplied: false,
    };
  }
}
