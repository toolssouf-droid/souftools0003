// lib/i18n/config.ts

export type SupportedLocale = 
  | "en"
  | "zh-CN"
  | "hi"
  | "es"
  | "ar"
  | "fr"
  | "bn"
  | "pt"
  | "ru"
  | "id"
  | "ur"
  | "de";

export const SUPPORTED_LOCALES: SupportedLocale[] = [
  "en",
  "zh-CN",
  "hi",
  "es",
  "ar",
  "fr",
  "bn",
  "pt",
  "ru",
  "id",
  "ur",
  "de",
];

export const DEFAULT_LOCALE: SupportedLocale = "ar";
export const FALLBACK_LOCALE: SupportedLocale = "en";

export const RTL_LOCALES: SupportedLocale[] = ["ar", "ur"];

export type TranslationNamespace =
  | "common"
  | "navigation"
  | "auth"
  | "home"
  | "chat"
  | "agent"
  | "tools"
  | "search"
  | "sources"
  | "files"
  | "images"
  | "coding"
  | "preview"
  | "settings"
  | "profile"
  | "admin"
  | "errors"
  | "billing"
  | "notifications"
  | "seo";

export const TRANSLATION_NAMESPACES: TranslationNamespace[] = [
  "common",
  "navigation",
  "auth",
  "home",
  "chat",
  "agent",
  "tools",
  "search",
  "sources",
  "files",
  "images",
  "coding",
  "preview",
  "settings",
  "profile",
  "admin",
  "errors",
  "billing",
  "notifications",
  "seo",
];

export interface LocaleMetadata {
  code: SupportedLocale;
  nativeName: string;
  englishName: string;
  direction: "rtl" | "ltr";
  flagSymbol: string;
  enabled: boolean;
  dateFormat: string;
  numberFormat: string;
}

export const LOCALE_METADATA_MAP: Record<SupportedLocale, LocaleMetadata> = {
  ar: {
    code: "ar",
    nativeName: "العربية",
    englishName: "Arabic",
    direction: "rtl",
    flagSymbol: "🇸🇦",
    enabled: true,
    dateFormat: "YYYY/MM/DD",
    numberFormat: "ar-SA",
  },
  en: {
    code: "en",
    nativeName: "English",
    englishName: "English",
    direction: "ltr",
    flagSymbol: "🇺🇸",
    enabled: true,
    dateFormat: "MM/DD/YYYY",
    numberFormat: "en-US",
  },
  "zh-CN": {
    code: "zh-CN",
    nativeName: "中文",
    englishName: "Chinese (Simplified)",
    direction: "ltr",
    flagSymbol: "🇨🇳",
    enabled: true,
    dateFormat: "YYYY/MM/DD",
    numberFormat: "zh-CN",
  },
  hi: {
    code: "hi",
    nativeName: "हिन्दी",
    englishName: "Hindi",
    direction: "ltr",
    flagSymbol: "🇮🇳",
    enabled: true,
    dateFormat: "DD/MM/YYYY",
    numberFormat: "hi-IN",
  },
  es: {
    code: "es",
    nativeName: "Español",
    englishName: "Spanish",
    direction: "ltr",
    flagSymbol: "🇪🇸",
    enabled: true,
    dateFormat: "DD/MM/YYYY",
    numberFormat: "es-ES",
  },
  fr: {
    code: "fr",
    nativeName: "Français",
    englishName: "French",
    direction: "ltr",
    flagSymbol: "🇫🇷",
    enabled: true,
    dateFormat: "DD/MM/YYYY",
    numberFormat: "fr-FR",
  },
  bn: {
    code: "bn",
    nativeName: "বাংলা",
    englishName: "Bengali",
    direction: "ltr",
    flagSymbol: "🇧🇩",
    enabled: true,
    dateFormat: "DD/MM/YYYY",
    numberFormat: "bn-BD",
  },
  pt: {
    code: "pt",
    nativeName: "Português",
    englishName: "Portuguese",
    direction: "ltr",
    flagSymbol: "🇧🇷",
    enabled: true,
    dateFormat: "DD/MM/YYYY",
    numberFormat: "pt-BR",
  },
  ru: {
    code: "ru",
    nativeName: "Русский",
    englishName: "Russian",
    direction: "ltr",
    flagSymbol: "🇷🇺",
    enabled: true,
    dateFormat: "DD.MM.YYYY",
    numberFormat: "ru-RU",
  },
  id: {
    code: "id",
    nativeName: "Bahasa Indonesia",
    englishName: "Indonesian",
    direction: "ltr",
    flagSymbol: "🇮🇩",
    enabled: true,
    dateFormat: "DD/MM/YYYY",
    numberFormat: "id-ID",
  },
  ur: {
    code: "ur",
    nativeName: "اردو",
    englishName: "Urdu",
    direction: "rtl",
    flagSymbol: "🇵🇰",
    enabled: true,
    dateFormat: "DD/MM/YYYY",
    numberFormat: "ur-PK",
  },
  de: {
    code: "de",
    nativeName: "Deutsch",
    englishName: "German",
    direction: "ltr",
    flagSymbol: "🇩🇪",
    enabled: true,
    dateFormat: "DD.MM.YYYY",
    numberFormat: "de-DE",
  },
};

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.includes(locale as SupportedLocale);
}

export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

export const isSupportedLocale = isValidLocale;
