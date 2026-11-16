/**
 * SoufAI Agent Engine - Specialized UI/Design Worker
 * 
 * Generates tailored visual systems, color tokens, typography scales,
 * responsive layouts, and prevents generic AI clichés (POL-VIS-01, POL-VIS-02).
 */

import { EngineExecutionContext } from "../types";
import { executeRoutedPrompt } from "@/lib/router";
import { getAbortError, isAbortError, throwIfAborted } from "../abort";

export type VisualThemeArchetype =
  | "luxury_dark"
  | "modern_saas"
  | "editorial"
  | "minimal_clean"
  | "brutalist"
  | "futuristic_cyber"
  | "creative_vibrant"
  | "enterprise_dense";

export interface DesignWorkerInput {
  projectGoal: string;
  preferredTheme?: VisualThemeArchetype;
}

export interface DesignWorkerResult {
  success: boolean;
  theme: VisualThemeArchetype;
  colorTokens: Record<string, string>;
  typography: { heading: string; body: string; mono: string };
  guidancePrompt: string;
}

export async function runDesignWorker(
  input: DesignWorkerInput,
  ctx: EngineExecutionContext
): Promise<DesignWorkerResult> {
  throwIfAborted(ctx.signal);
  await ctx.emitEvent("agent.subtask.started", "بدء عمل UI/Design Agent لهندسة النظام البصري", {
    agentWorker: "design",
    status: "running",
  });

  const prompt = `أنت مدير التصميم والواجهات (Principal Design Director) في SoufAI.
المشروع المطلوب: "${input.projectGoal}"

المطلوب هندسة نظام تصميم فريد (Design System) مخصص بالكامل لهذا المشروع مع الالتزام الصارم بقواعد مكافحة التصاميم الذكاء الاصطناعي المبتذلة (Anti-AI Slop):
- لا تستخدم التدرجات الأرجوانية/الوردية الافتراضية.
- حدد لوحة ألوان دقيقة (Tokens) بنغمات متناسقة ونسب تباين تحقق معايير WCAG AA.
- حدد مقياس طباعي (Typography Scale) متناسق مع دعم كامل للغة العربية والإنجليزية.
- حدد نمط الواجهة (Theme Archetype) الأنسب من بين: luxury_dark, modern_saas, editorial, minimal_clean, brutalist, futuristic_cyber, creative_vibrant, enterprise_dense.

أخرج النتيجة كـ JSON كالتالي:
{
  "theme": "luxury_dark",
  "colorTokens": {
    "bgPrimary": "#0c1414",
    "bgSurface": "#142222",
    "border": "#1e2e2e",
    "accent": "#00d4aa",
    "accentHover": "#00ff88",
    "textPrimary": "#e8f5f5",
    "textSecondary": "#88b0b0"
  },
  "typography": {
    "heading": "Cairo / Inter",
    "body": "Tajawal / Plus Jakarta Sans",
    "mono": "Fira Code"
  },
  "guidance": "توجيهات تفصيلية للـ Coding Agent لتنفيذ الواجهة..."
}`;

  try {
    const aiRes = await executeRoutedPrompt({
      prompt,
      modelId: "core",
      systemInstruction: "أنت مصمم واجهات فائق الاحترافية. أرجع مخرجاتك بتنسيق JSON حصرياً.",
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
      console.warn("DesignWorker: JSON parse failed for output candidate:", parseErr);
      parsed = null;
    }

    await ctx.emitEvent("agent.subtask.completed", `تم اعتماد النظام البصري: ${parsed?.theme || "luxury_dark"}`, {
      agentWorker: "design",
      status: "completed",
      summary: `لوحة الألوان الأساسية: Accent ${parsed?.colorTokens?.accent || "#00d4aa"}`,
    });

    return {
      success: true,
      theme: parsed?.theme || "luxury_dark",
      colorTokens: parsed?.colorTokens || {
        bgPrimary: "#0c1414",
        bgSurface: "#142222",
        border: "#1e2e2e",
        accent: "#00d4aa",
        textPrimary: "#e8f5f5",
      },
      typography: parsed?.typography || {
        heading: "Cairo",
        body: "Tajawal",
        mono: "Fira Code",
      },
      guidancePrompt: parsed?.guidance || "استخدم هوية لونية فاخرة مريحة للعين مع تباعد متناسق وحركات انسيابية.",
    };
  } catch (error) {
    if (isAbortError(error, ctx.signal)) throw getAbortError(ctx.signal);
    return {
      success: true,
      theme: "luxury_dark",
      colorTokens: {
        bgPrimary: "#0c1414",
        bgSurface: "#142222",
        border: "#1e2e2e",
        accent: "#00d4aa",
        textPrimary: "#e8f5f5",
      },
      typography: { heading: "Cairo", body: "Tajawal", mono: "Fira Code" },
      guidancePrompt: "تصميم فخم بنظام ألوان داكن مع دعم كامل للغة العربية والاتجاه RTL.",
    };
  }
}
