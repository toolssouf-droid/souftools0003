// lib/i18n/loader.ts

import { SupportedLocale, DEFAULT_LOCALE, FALLBACK_LOCALE, TranslationNamespace, TRANSLATION_NAMESPACES } from "./config";
import { pseudoLocalize } from "./pseudo";

import arDict from "../../messages/ar.json";
import enDict from "../../messages/en.json";
import frDict from "../../messages/fr.json";
import esDict from "../../messages/es.json";
import deDict from "../../messages/de.json";
import zhCNDict from "../../messages/zh-CN.json";
import hiDict from "../../messages/hi.json";
import bnDict from "../../messages/bn.json";
import ptDict from "../../messages/pt.json";
import ruDict from "../../messages/ru.json";
import idDict from "../../messages/id.json";
import urDict from "../../messages/ur.json";

export const STATIC_DICTIONARIES: Record<string, Record<string, any>> = {
  ar: arDict,
  en: enDict,
  fr: frDict,
  es: esDict,
  de: deDict,
  "zh-CN": zhCNDict,
  hi: hiDict,
  bn: bnDict,
  pt: ptDict,
  ru: ruDict,
  id: idDict,
  ur: urDict,
};

// In-memory translation cache per locale
const translationCache: Map<string, Record<string, any>> = new Map();

// Global runtime memory store for dynamically loaded locale dictionaries
const loadedDictionaries: Record<string, Record<string, any>> = {
  ...STATIC_DICTIONARIES,
};

/**
 * Register a locale dictionary synchronously or dynamically
 */
export function registerLocaleDictionary(locale: string, dictionary: Record<string, any>): void {
  loadedDictionaries[locale] = {
    ...loadedDictionaries[locale],
    ...dictionary,
  };
}

/**
 * Synchronous key lookup with nested namespace dot notation (e.g., "chat.start")
 */
export function getNestedTranslation(
  dict: Record<string, any> | undefined,
  path: string
): string | undefined {
  if (!dict || !path) return undefined;
  const keys = path.split(".");
  let current: any = dict;

  for (const k of keys) {
    if (current && typeof current === "object" && k in current) {
      current = current[k];
    } else {
      return undefined;
    }
  }

  if (typeof current === "string") return current;
  return undefined;
}

/**
 * Primary translation resolver with fallback mechanism:
 * Active Locale -> Fallback Locale ('en') -> English Key -> Raw Path
 */
export function translateKey(
  locale: string,
  key: string,
  params?: Record<string, any>,
  fallbackText?: string,
  enablePseudoMode: boolean = false
): string {
  const activeDict = loadedDictionaries[locale] || loadedDictionaries[DEFAULT_LOCALE];
  let rawText = getNestedTranslation(activeDict, key);

  // Fallback 1: Fallback locale ('en')
  if (!rawText && locale !== FALLBACK_LOCALE) {
    const fallbackDict = loadedDictionaries[FALLBACK_LOCALE];
    rawText = getNestedTranslation(fallbackDict, key);
  }

  // Fallback 2: Default locale ('ar')
  if (!rawText && locale !== DEFAULT_LOCALE) {
    const defaultDict = loadedDictionaries[DEFAULT_LOCALE];
    rawText = getNestedTranslation(defaultDict, key);
  }

  // Fallback 3: Explicit fallback string or key itself
  let finalResult = rawText || fallbackText || key.split(".").pop() || key;

  // Replace parameters if present (e.g. {count}, {name})
  if (params && typeof params === "object") {
    Object.keys(params).forEach((paramKey) => {
      const val = params[paramKey];
      finalResult = finalResult.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(val));
    });
  }

  if (enablePseudoMode) {
    return pseudoLocalize(finalResult);
  }

  return finalResult;
}

/**
 * Gets loaded dictionaries status
 */
export function getLoadedDictionaries() {
  return loadedDictionaries;
}
