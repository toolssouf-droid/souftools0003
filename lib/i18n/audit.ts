// lib/i18n/audit.ts

import { SUPPORTED_LOCALES, TRANSLATION_NAMESPACES, SupportedLocale, LOCALE_METADATA_MAP } from "./config";
import { getLoadedDictionaries } from "./loader";

export interface AuditIssue {
  locale: SupportedLocale;
  namespace: string;
  key: string;
  issueType: "missing_key" | "empty_value" | "placeholder_mismatch" | "untranslated_fallback";
  details: string;
}

export interface LocaleCoverageReport {
  locale: SupportedLocale;
  nativeName: string;
  englishName: string;
  flagSymbol: string;
  direction: "rtl" | "ltr";
  enabled: boolean;
  totalKeys: number;
  translatedKeys: number;
  missingKeys: number;
  coveragePercentage: number;
  status: "complete" | "partial" | "low";
}

export interface TranslationAuditResult {
  overallCoverage: number;
  totalKeysCatalog: number;
  localeReports: LocaleCoverageReport[];
  issues: AuditIssue[];
  auditedAt: string;
}

function extractAllKeys(obj: Record<string, any>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
        keys = keys.concat(extractAllKeys(obj[key], fullPath));
      } else {
        keys.push(fullPath);
      }
    }
  }
  return keys;
}

export function runTranslationAudit(): TranslationAuditResult {
  const dicts = getLoadedDictionaries();
  const baseDict = dicts["en"] || dicts["ar"] || {};
  const baseKeys = extractAllKeys(baseDict);
  const totalBaseCount = Math.max(baseKeys.length, 1);

  const issues: AuditIssue[] = [];
  const reports: LocaleCoverageReport[] = [];

  let totalCoverageSum = 0;

  SUPPORTED_LOCALES.forEach((loc) => {
    const meta = LOCALE_METADATA_MAP[loc];
    const locDict = dicts[loc] || {};
    const locKeys = extractAllKeys(locDict);

    let translatedCount = 0;
    let missingCount = 0;

    baseKeys.forEach((key) => {
      let current: any = locDict;
      const parts = key.split(".");
      let found = true;

      for (const p of parts) {
        if (current && typeof current === "object" && p in current) {
          current = current[p];
        } else {
          found = false;
          break;
        }
      }

      if (found && typeof current === "string" && current.trim().length > 0) {
        translatedCount++;
      } else {
        missingCount++;
        issues.push({
          locale: loc,
          namespace: key.split(".")[0] || "common",
          key: key,
          issueType: "missing_key",
          details: `Missing translation key "${key}" for locale "${loc}"`,
        });
      }
    });

    const percentage = Math.round((translatedCount / totalBaseCount) * 100);
    totalCoverageSum += percentage;

    let status: "complete" | "partial" | "low" = "low";
    if (percentage >= 90) status = "complete";
    else if (percentage >= 60) status = "partial";

    reports.push({
      locale: loc,
      nativeName: meta.nativeName,
      englishName: meta.englishName,
      flagSymbol: meta.flagSymbol,
      direction: meta.direction,
      enabled: meta.enabled,
      totalKeys: totalBaseCount,
      translatedKeys: translatedCount,
      missingKeys: missingCount,
      coveragePercentage: percentage,
      status: status,
    });
  });

  const overall = Math.round(totalCoverageSum / SUPPORTED_LOCALES.length);

  return {
    overallCoverage: overall,
    totalKeysCatalog: totalBaseCount,
    localeReports: reports,
    issues: issues.slice(0, 100), // Limit top 100 issues for performance
    auditedAt: new Date().toISOString(),
  };
}
