// lib/i18n/context.ts

import { SupportedLocale, isRtlLocale, LOCALE_METADATA_MAP } from "./config";

export interface LocaleContext {
  interfaceLanguage: string;
  responseLanguage: string;
  searchLanguage: "auto" | string;
  locale: SupportedLocale;
  direction: "rtl" | "ltr";
}

export function createLocaleContext(
  locale: string = "ar",
  overrideResponseLang?: string
): LocaleContext {
  const activeLocale: SupportedLocale = (LOCALE_METADATA_MAP[locale as SupportedLocale] ? locale : "ar") as SupportedLocale;
  const meta = LOCALE_METADATA_MAP[activeLocale];

  return {
    interfaceLanguage: activeLocale,
    responseLanguage: overrideResponseLang || meta.englishName,
    searchLanguage: "auto",
    locale: activeLocale,
    direction: meta.direction,
  };
}

/**
 * Builds system prompt instructions for SoufAI ensuring language awareness & zero translation of code/URLs
 */
export function buildMultilingualSystemPrompt(
  baseInstruction: string,
  ctx: LocaleContext
): string {
  const isArabic = ctx.locale === "ar";
  const directionText = ctx.direction.toUpperCase();

  return `${baseInstruction}

[SOUFAI MULTILINGUAL INTELLECT SYSTEM INSTRUCTION]
1. Primary Output Language: Respond fluently in ${ctx.responseLanguage} (${ctx.locale}).
2. Multilingual Search & Synthesis: Understand the user prompt regardless of language. Execute web grounding across global sources (English, Arabic, Chinese, etc.) when needed, but synthesize final answers cleanly in ${ctx.responseLanguage}.
3. Strict Code & Technical Preservation: DO NOT translate code syntax, programming languages, API endpoints, JSON attributes, shell commands, file paths, or domain URLs. Keep all code blocks strictly in English.
4. Interface Context: Interface direction is ${directionText}. Respect numerical formatting and technical accuracy.
`;
}
