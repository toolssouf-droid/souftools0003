// lib/efficiency/requestOptimizer.ts
/**
 * AI Request Optimizer
 * Pre-evaluates incoming prompts, prunes redundant data, and selects optimal execution path
 */

import { RequestOptimizationDecision, MaxStepsMode } from "./types";
import { getEfficiencyConfig } from "./efficiencyStore";

/**
 * Optimizes prompt and determines whether tools / heavy models are required
 */
export function optimizeRequest(
  prompt: string,
  attachments: any[] = [],
  webSearchEnabled: boolean = false
): RequestOptimizationDecision {
  const config = getEfficiencyConfig();
  const rawPrompt = prompt || "";
  const trimmed = rawPrompt.trim();

  // 1. Remove redundant polite phrases / repeated spaces to save tokens
  let cleaned = trimmed
    .replace(/^(لو سمحت|من فضلك|أرجوك|مرحبا|أهلا|سلام عليكم|السلام عليكم|يا طيب|شكرا لك|تحياتي|hello|hi|please|could you please)\s*[,:\-]?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) cleaned = trimmed;

  const redundancyRemovedChars = Math.max(0, rawPrompt.length - cleaned.length);

  // 2. Identify Attachments
  const hasImageAttachment = attachments.some((a) => a.type === "image" || (a.mimeType && a.mimeType.startsWith("image/")));

  // 3. Match Intent & Tool Requirements
  let taskType: RequestOptimizationDecision["taskType"] = "direct_answer";
  let recommendedModelTier: RequestOptimizationDecision["recommendedModelTier"] = "core";
  let recommendedTools: string[] = [];
  let requiresModel = true;
  let isCacheable = true;
  let reasoning = "إجابة مباشرة بدون أدوات خارجية لتوفير استهلاك الـ Tokens";

  // Check Math
  const isMath = /^(احسب|كم يساوي|ما ناتج|حساب|calculate|what is|calc)\s*[\d\s\+\-\*\/\^\(\)\.\%]+$/i.test(cleaned) ||
                 /^[\d\s\+\-\*\/\^\(\)\.\%]{4,}$/.test(cleaned);

  // Check Coding / App building
  const isCoding =
    /^(أنشئ|اصنع|برمج|ابنِ|طور|صمم|اكتب كود|create|build|develop|code|make)\s*(تطبيق|موقع|لعبة|صفحة|لوحة تحكم|واجهة|app|website|game|dashboard|component|script)/i.test(cleaned) ||
    /كود|برمجة|دالة|خوارزمية|function|component|react|typescript|python|html|css|bug|refactor/i.test(cleaned);

  // Check Web Search Needed (news, recent facts, live queries, price, weather, latest)
  const isSearchNeeded =
    webSearchEnabled ||
    /أحدث|آخر أخبار|سعر|اليوم|طقس|مباريات|نتائج|latest|news|price today|current|weather|who won|search/i.test(cleaned) ||
    /ابحث عن|بحث في الويب|search for/i.test(cleaned);

  // Check Vision
  const isVision = hasImageAttachment || /حلل الصورة|ماذا ترى في الصورة|اشرح الصورة|analyze image|what is in this picture/i.test(cleaned);

  if (isVision) {
    taskType = "vision_analysis";
    recommendedModelTier = "vision";
    recommendedTools = ["image_analysis_tool"];
    isCacheable = false;
    reasoning = "تم توجيه الطلب إلى نموذج الرؤية البصرية Multimodal Vision";
  } else if (isMath) {
    taskType = "math_calc";
    recommendedModelTier = "spark";
    recommendedTools = ["calculator"];
    isCacheable = true;
    reasoning = "عملية حسابية - استخدام نموذج فائق السرعة وأداة الحاسبة المباشرة";
  } else if (isCoding) {
    taskType = "coding_tool";
    recommendedModelTier = "coder";
    recommendedTools = ["coding_tool", "code_tool"];
    isCacheable = false;
    reasoning = "مهمة برمجية - توجيه لأداة بناء وتطوير التطبيقات Coding Tool";
  } else if (isSearchNeeded) {
    taskType = "web_search";
    recommendedModelTier = "core";
    recommendedTools = ["web_search", "open_page"];
    isCacheable = false;
    reasoning = "طلب معلومات حية - تفعيل البحث في الويب وتلخيص المصادر";
  } else {
    // Simple direct knowledge or conversational query
    taskType = "direct_answer";
    // Check if simple definition (e.g., "ما هو React؟")
    if (cleaned.length < 50 && /^(ما هو|ما هي|عرف|اشرح باختصار|what is|define)\s+/i.test(cleaned)) {
      recommendedModelTier = "spark";
      reasoning = "سؤال تعريفي مباشر - إجابة فورية سريعة بنموذج خفيف وبدون استدعاء أدوات";
    } else {
      recommendedModelTier = "core";
      reasoning = "استفسار معرفي - إجابة مباشرة مركزة";
    }
  }

  // 4. Calculate Max Steps based on Mode
  const modeStepsMap: Record<MaxStepsMode, number> = {
    quick: 3,
    balanced: 7,
    deep: 15,
  };

  const baseSteps = modeStepsMap[config.maxStepsMode] || 7;
  const maxStepsAllowed = taskType === "direct_answer" ? 2 : baseSteps;

  return {
    requiresModel,
    taskType,
    recommendedModelTier,
    recommendedTools,
    isCacheable,
    maxStepsAllowed,
    cleanedPrompt: cleaned,
    redundancyRemovedChars,
    reasoning,
  };
}
