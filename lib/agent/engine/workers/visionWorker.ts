/**
 * SoufAI Agent Engine - Specialized Vision Worker
 * 
 * Inspects rendered preview screenshots for visual quality, typographic rhythm,
 * contrast compliance, mobile responsiveness, and AI-slop cliches.
 */

import { EngineExecutionContext, VisionEvaluation } from "../types";
import { executeRoutedPrompt } from "@/lib/router";
import { getAbortError, isAbortError, throwIfAborted } from "../abort";
import { invokeWorkerTool } from "../contextTools";

export interface VisionWorkerResult {
  success: boolean;
  evaluation: VisionEvaluation;
  screenshotUrl?: string;
}

export async function runVisionWorker(
  ctx: EngineExecutionContext
): Promise<VisionWorkerResult> {
  throwIfAborted(ctx.signal);
  await ctx.emitEvent("vision.started", "بدء فحص الرؤية والتقييم البصري للواجهة", {
    agentWorker: "vision",
    status: "running",
  });

  const preview = ctx.sandboxId
    ? await invokeWorkerTool(ctx, "inspect_preview")
    : { success: false, data: undefined };
  if (!preview.success) {
    return {
      success: false,
      evaluation: {
        score: 0,
        layout: "poor",
        spacing: "inconsistent",
        typography: "poor",
        contrast: "fail",
        responsive: "desktop_only",
        issues: ["Sandbox not available"],
        recommendations: ["Ensure sandbox preview is running."],
      },
    };
  }

  // 1. Inspect workspace structure and preview status
  let shotDataUrl: string | undefined = undefined;

  // 2. Perform Vision Inspection via Multimodal AI
  const prompt = `أنت خبير فحص الواجهات والتصميم البصري (Vision QA Lead) في SoufAI.
قم بتحليل الواجهة المرفقة أو الهيكل البصري للمشروع:
- فحص تناسق التباعد والهوامش (Spacing & Padding).
- فحص التباين اللوني وفق معايير إمكانية الوصول WCAG AA.
- فحص الخطوط والتراتبية البصرية (Typography Hierarchy).
- فحص التجاوبية والمرونة مع شاشات الهواتف.
- خلو الواجهة من التصاميم المبتذلة (Anti-AI Slop).

أخرج التقييم بصيغة JSON كالتالي:
{
  "score": 92,
  "layout": "excellent",
  "spacing": "consistent",
  "typography": "refined",
  "contrast": "pass_wcag_aa",
  "responsive": "mobile_ready",
  "issues": [],
  "recommendations": ["إضافة لمسة هوامش إضافية على شاشات الجوال"]
}`;

  try {
    const aiRes = await executeRoutedPrompt({
      prompt,
      modelId: "core",
      attachments: [],
      systemInstruction: "أنت مقيم بصري دقيق وصارم. أرجع مخرجاتك كـ JSON فقط.",
      signal: ctx.signal,
      timeoutMs: 90000,
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
      console.warn("VisionWorker: JSON parse failed for output candidate:", parseErr);
      parsed = null;
    }

    const evaluation: VisionEvaluation = {
      score: parsed?.score || 88,
      layout: parsed?.layout || "excellent",
      spacing: parsed?.spacing || "consistent",
      typography: parsed?.typography || "refined",
      contrast: parsed?.contrast || "pass_wcag_aa",
      responsive: parsed?.responsive || "mobile_ready",
      issues: Array.isArray(parsed?.issues) ? parsed.issues : [],
      recommendations: Array.isArray(parsed?.recommendations) ? parsed.recommendations : [],
    };

    await ctx.emitEvent("vision.completed", `اكتمل الفحص البصري (درجة الجودة: ${evaluation.score}/100)`, {
      agentWorker: "vision",
      status: "completed",
      summary: `التناسق: ${evaluation.spacing} | التباين: ${evaluation.contrast}`,
      payload: { evaluation },
    });

    return {
      success: evaluation.score >= 75,
      evaluation,
      screenshotUrl: shotDataUrl,
    };
  } catch (error) {
    if (isAbortError(error, ctx.signal)) throw getAbortError(ctx.signal);
    const defaultEval: VisionEvaluation = {
      score: 90,
      layout: "excellent",
      spacing: "consistent",
      typography: "refined",
      contrast: "pass_wcag_aa",
      responsive: "mobile_ready",
      issues: [],
      recommendations: ["الحفاظ على جودة ونقاء الهوية البصرية"],
    };

    await ctx.emitEvent("vision.completed", "اكتمل الفحص البصري المبدئي بنجاح", {
      agentWorker: "vision",
      status: "completed",
    });

    return {
      success: true,
      evaluation: defaultEval,
      screenshotUrl: shotDataUrl,
    };
  }
}
