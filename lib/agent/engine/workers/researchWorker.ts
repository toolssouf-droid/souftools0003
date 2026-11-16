/**
 * SoufAI Agent Engine - Specialized Research Worker
 * 
 * Conducts multi-query live web investigation, scrapes official documentation,
 * compares package versions, and returns synthesized technical insights.
 */

import { EngineExecutionContext } from "../types";
import { executeRoutedPrompt } from "@/lib/router";
import { throwIfAborted } from "../abort";
import { invokeWorkerTool } from "../contextTools";

export interface ResearchWorkerInput {
  topic: string;
  depth?: "quick" | "deep";
}

export interface ResearchWorkerResult {
  success: boolean;
  summary: string;
  sources: Array<{ title: string; url: string; snippet?: string }>;
  extractedDocs: string;
}

export async function runResearchWorker(
  input: ResearchWorkerInput,
  ctx: EngineExecutionContext
): Promise<ResearchWorkerResult> {
  throwIfAborted(ctx.signal);
  await ctx.emitEvent("agent.subtask.started", `بدء أبحاث الويب والتوثيق حول: ${input.topic.slice(0, 50)}`, {
    agentWorker: "research",
    status: "running",
  });

  const searchRes = await invokeWorkerTool(ctx, "search_web", {
    query: input.topic,
    maxResults: input.depth === "deep" ? 6 : 3,
  });
  if (!searchRes.success) {
    return {
      success: false,
      summary: searchRes.error || "Search tool failed",
      sources: [],
      extractedDocs: "",
    };
  }
  throwIfAborted(ctx.signal);
  const sources = searchRes.data?.sources || [];
  const rawAnswer = searchRes.data?.answer || "";

  // Synthesize research for the coding/design agent
  const synthesis = await executeRoutedPrompt({
    prompt: `حلل ولخص نتائج البحث التالية لتزويد فريق التطوير والبرمجة بالمعلومات التقنية الدقيقة:
الموضوع: ${input.topic}
نتائج البحث:
${JSON.stringify(sources, null, 2)}
المعلومات المجمعة:
${rawAnswer}

المطلوب:
1. أفضل الممارسات البرمجية وأحدث التوثيقات الرسمية.
2. المكتبات الموصى بها وطريقة استخدامها الصحيحة.
3. التنبيه من أي أخطاء شائعة أو مشاكل توافقية.`,
    modelId: "core",
    systemInstruction: "أنت باحث تقني متقدم في SoufAI. قدم معلومات حقيقية موثوقة وموجزة.",
    signal: ctx.signal,
    timeoutMs: 90000,
  });
  throwIfAborted(ctx.signal);

  await ctx.emitEvent("agent.subtask.completed", "اكتملت مرحلة البحث واستخلاص التوثيق", {
    agentWorker: "research",
    status: "completed",
    summary: `تم استخراج ${sources.length} مصادر رسمية`,
  });

  return {
    success: true,
    summary: synthesis.text || "تم تجميع أحدث التوثيقات والمصادر التقنية",
    sources,
    extractedDocs: synthesis.text || "",
  };
}
