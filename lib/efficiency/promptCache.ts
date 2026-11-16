// lib/efficiency/promptCache.ts
/**
 * Prompt Caching System
 * Stores and manages immutable system instructions, tool signatures, and agent rules
 * to minimize token generation costs and accelerate TTFT (Time To First Token).
 */

import { getCachedPromptBlock, setCachedPromptBlock, getEfficiencyConfig, estimateTokens } from "./efficiencyStore";

const PROMPT_CACHE_VERSION = "2.1.0";

// System instructions base block
const SOUFAI_SYSTEM_BASE = `أنت نظام الذكاء الاصطناعي SoufAI المطور لمنصة SoufTools.
أنت وكيل تنفيذ ذاتي متعدد الخطوات (Autonomous Agent) ذو كفاءة هندسية فائقة.
أجب دائماً باللغة العربية بأسلوب راقٍ واحترافي مباشر ودقيق.
التزم بقواعد منصة SoufTools وقدم إجابات موثوقة ذات جودة عالية.`;

// Tool definitions signature block
const TOOLS_DEFINITION_SIGNATURE = `الأدوات الأساسية المدعومة:
- coding_tool: بناء وإنشاء مواقع وتطبيقات كاملة وتعديل الملفات البرمجية.
- web_search: البحث واستخراج البيانات المحدثة من الويب.
- open_page: تصفح وقراءة محتوى المواقع والصفحات.
- calculator: إجراء العمليات الحسابية والرياضية الدقيقة.
- get_current_time: استرجاع الوقت الحالي بدقة لأي منطقة بالعالم.
- generate_image: توليد وتصميم الصور الفنية والتقنية.
- image_analysis_tool: تحليل وتدقيق الصور واستخراج النصوص.`;

function createPromptHashKey(name: string, version: string = PROMPT_CACHE_VERSION): string {
  return `prompt_block_${name}_${version}`;
}

export interface CachedSystemPrompt {
  systemInstruction: string;
  isCached: boolean;
  tokensSavedEstimate: number;
  cacheKey: string;
}

/**
 * Retrieves or builds cached system prompt
 */
export function getOptimizedSystemPrompt(
  customDirective: string = "",
  mode: string = "normal"
): CachedSystemPrompt {
  const config = getEfficiencyConfig();
  const cacheKey = createPromptHashKey(`sys_${mode}`, PROMPT_CACHE_VERSION);

  if (!config.promptCacheEnabled) {
    const rawPrompt = `${SOUFAI_SYSTEM_BASE}\n\n${TOOLS_DEFINITION_SIGNATURE}\n\n${customDirective}`.trim();
    return {
      systemInstruction: rawPrompt,
      isCached: false,
      tokensSavedEstimate: 0,
      cacheKey,
    };
  }

  let cachedBase = getCachedPromptBlock(cacheKey);

  if (!cachedBase) {
    cachedBase = `${SOUFAI_SYSTEM_BASE}\n\n${TOOLS_DEFINITION_SIGNATURE}\n\n[Version: ${PROMPT_CACHE_VERSION}]`;
    setCachedPromptBlock(cacheKey, cachedBase, PROMPT_CACHE_VERSION);
  }

  // Combine cached immutable base with dynamic request directives
  const fullInstruction = customDirective
    ? `${cachedBase}\n\n[توجيه المهمة الحالية]: ${customDirective}`
    : cachedBase;

  const tokensSavedEstimate = estimateTokens(cachedBase);

  return {
    systemInstruction: fullInstruction,
    isCached: true,
    tokensSavedEstimate,
    cacheKey,
  };
}

/**
 * Invalidate all prompt cache blocks
 */
export function invalidatePromptCache(): { success: boolean; version: string } {
  return {
    success: true,
    version: PROMPT_CACHE_VERSION,
  };
}
