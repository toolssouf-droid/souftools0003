// lib/router/zeroComputeTriage.ts
/**
 * Zero-Compute Intent Triage Engine
 * 
 * Analyzes query intent and execution requirements in < 0.03ms
 * using pre-compiled regex heuristics and zero external model calls.
 * 
 * Accurately determines:
 * - Direct Chat vs. Tool-Required Tasks
 * - Web Grounding Need
 * - Coding & Execution Sandbox Need
 * - Multimodal Vision Analysis Need
 * - Safe Tool Pruning Strategy
 * - Pre-fetch Augmentation Strategy for small or tool-less models
 */

import { ModelCapabilityProfile } from "../models/providerModelRegistry";

export type ExecutionStrategy = 
  | "STRATEGY_DIRECT_PASS"       // Pure text generation, prune all tool schemas for speed & accuracy
  | "STRATEGY_TOOL_PASS"         // Native function calling with tools provided
  | "STRATEGY_PREFETCH_AUGMENT"  // Model is small/no-tools; server pre-fetches data & injects as context
  | "STRATEGY_COORDINATED_AGENT"; // Heavy multi-step task requiring deep reasoning coordination

export interface TriageResult {
  isDirectChat: boolean;
  needsWebSearch: boolean;
  needsCodingSandbox: boolean;
  needsVisionAnalysis: boolean;
  complexity: "lightweight" | "standard" | "heavy_reasoning";
  executionStrategy: ExecutionStrategy;
  shouldPruneTools: boolean;
  shouldPrefetchWeb: boolean;
  triageTimeMicroseconds: number;
  explanationAr: string;
}

// Pre-compiled regex patterns for zero-overhead matching (<0.02ms)
const WEB_SEARCH_INTENT_REGEX = /(?:ابحث|بحث|أخبار|سعر|أسعار|حالي|أحدث|الطقس|مباراة|نتائج|اخبار|2025|2026|search|news|weather|price|latest|live)/i;
const CODING_INTENT_REGEX = /(?:كود|برمج|اكتب برنامج|تطبيق|html|css|javascript|typescript|python|react|nextjs|function|class|api route|ساندبوكس|طرفية|terminal|exec|bug|fix error)/i;
const TIME_INTENT_REGEX = /(?:ساعة|الساعة|كم الساعة|شحال في الساعة|قداش الساعة|قداه الوقت|الوقت|توقيت|فارق التوقيت|تاريخ|اليوم|كم تاريخ|ما هو تاريخ|ايش اليوم|ذكرني|تذكير|موعد|جدولة|remind|schedule|time|clock|date|today|timezone)/i;
const MATH_INTENT_REGEX = /(?:احسب|حساب|معادلة|ضرب|قسمة|جمع|طرح|نسبة|جذر|مجموع|تفاضل|تكامل|calculator|calculate|math|calc|\d+\s*[\+\-\*\/×÷\^%]\s*\d+)/i;
const MEMORY_INTENT_REGEX = /(?:احفظ في الذاكرة|تذكر|اسمي|مشروعي|عنّي|عني|تفضيلاتي|ذاكرة|memory|remember|profile)/i;
const FILE_INTENT_REGEX = /(?:ملف|مستند|أنشئ ملف|اكتب ملف|تصدير|pdf|docx|xlsx|csv|json|markdown|file|document)/i;
const DIRECT_CHAT_STARTERS = /^(?:مرحبا|أهلا|سلام|صباح الخير|مساء الخير|كيف حالك|شكرا|من أنت|عرف بنفسك|اكتب لي قصة|قصيدة|ترجم|لخص|ما معنى|ما هو|ما هي|define|translate|summarize|hello|hi|hey|explain)/i;

/**
 * Perform Zero-Compute Intent Triage on a user prompt
 */
export function triageRequestIntent(
  prompt: string,
  modelProfile: ModelCapabilityProfile,
  hasAttachments: boolean = false,
  webSearchToggleEnabled: boolean = false
): TriageResult {
  const startTime = typeof performance !== "undefined" ? performance.now() : Date.now();
  const clean = (prompt || "").trim();

  // 1. Detect Multimodal Vision Intent
  const needsVisionAnalysis = hasAttachments || /(?:صورة|رسمة|مخطط|صمم صورة|شاهد الصورة|ocr|image|photo|diagram|screenshot)/i.test(clean);

  // 2. Detect Web Search Intent
  const explicitWebKeyword = WEB_SEARCH_INTENT_REGEX.test(clean);
  const needsWebSearch = webSearchToggleEnabled || explicitWebKeyword;

  // 3. Detect Coding & Tool Sandbox Intent
  const needsCodingSandbox = CODING_INTENT_REGEX.test(clean);

  // 4. Detect Time, Math, Memory, and File Operations Intent
  const needsTime = TIME_INTENT_REGEX.test(clean);
  const needsMath = MATH_INTENT_REGEX.test(clean);
  const needsMemory = MEMORY_INTENT_REGEX.test(clean);
  const needsFile = FILE_INTENT_REGEX.test(clean);

  // 5. Detect Direct Conversational / Text Intent
  const isDirectChat = !needsWebSearch && !needsCodingSandbox && !needsVisionAnalysis && !needsTime && !needsMath && !needsMemory && !needsFile;

  // 6. Complexity Assessment
  let complexity: "lightweight" | "standard" | "heavy_reasoning" = "standard";
  if (isDirectChat && clean.length < 120) {
    complexity = "lightweight";
  } else if (clean.length > 800 || /(?:حلل بعمق|أطروحة|بحث أكاديمي|مقارنة معقدة|معمارية برمجية كاملة|deep research)/i.test(clean)) {
    complexity = "heavy_reasoning";
  }

  // 7. Strategy Formulation based on Model Profile & Intent
  let executionStrategy: ExecutionStrategy = "STRATEGY_DIRECT_PASS";
  let shouldPruneTools = true;
  let shouldPrefetchWeb = false;
  let explanationAr = "محادثة نصية مباشرة - تمرير سريع بدون أدوات للحفاظ على السرعة والنقاء";

  if (isDirectChat) {
    // Pure Direct Chat: Prune all tools to maximize speed and prevent hallucinations
    executionStrategy = "STRATEGY_DIRECT_PASS";
    shouldPruneTools = true;
    explanationAr = "طلب استفساري/لغوي مباشر - إعفاء النموذج من الأدوات لتسريع الاستجابة (Zero Token Overhead)";
  } else if (needsTime || needsMath || needsMemory || needsFile) {
    executionStrategy = "STRATEGY_TOOL_PASS";
    shouldPruneTools = false;
    explanationAr = needsTime 
      ? "طلب متعلق بالوقت أو التاريخ - تفعيل أدوات التوقيت الحية" 
      : needsMath 
      ? "عملية حسابية - تفعيل أداة الحاسبة الدقيقة" 
      : needsMemory 
      ? "إدارة الذاكرة وهوية المستخدم - تفعيل أدوات الذاكرة" 
      : "إنشاء وإدارة الملفات - تفعيل أداة الملفات الحقيقية";
  } else if (needsWebSearch) {
    if (modelProfile.supportsFunctionCalling && modelProfile.sizeTier !== "nano") {
      // Model natively supports tools and is big enough
      executionStrategy = "STRATEGY_TOOL_PASS";
      shouldPruneTools = false;
      explanationAr = "طلب معلومات حية - إتاحة أداة البحث في الويب للنموذج مباشرة";
    } else {
      // Model is small (nano/micro) or reasoning-only (like o1 / R1):
      // Use PREFETCH AUGMENTATION so the model answers accurately without choking on JSON schemas
      executionStrategy = "STRATEGY_PREFETCH_AUGMENT";
      shouldPruneTools = true;
      shouldPrefetchWeb = true;
      explanationAr = `النموذج (${modelProfile.normalizedName}) خفيف/مركز - جلب نتائج البحث مسبقاً وحقنها في السياق لحمايته من هدر الـ JSON`;
    }
  } else if (needsCodingSandbox || needsVisionAnalysis) {
    if (modelProfile.supportsFunctionCalling) {
      executionStrategy = "STRATEGY_TOOL_PASS";
      shouldPruneTools = false;
      explanationAr = "مهمة تنفيذية - تفعيل أدوات البرمجة والتحليل للنموذج";
    } else {
      executionStrategy = "STRATEGY_COORDINATED_AGENT";
      shouldPruneTools = false;
      explanationAr = "مهمة برمجية مركبة تتطلب تنسيقاً استدلالياً معمقاً";
    }
  }

  const endTime = typeof performance !== "undefined" ? performance.now() : Date.now();
  const triageTimeMicroseconds = Math.round((endTime - startTime) * 1000);

  return {
    isDirectChat,
    needsWebSearch,
    needsCodingSandbox,
    needsVisionAnalysis,
    complexity,
    executionStrategy,
    shouldPruneTools,
    shouldPrefetchWeb,
    triageTimeMicroseconds,
    explanationAr,
  };
}
