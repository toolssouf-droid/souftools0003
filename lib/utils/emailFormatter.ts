/**
 * SoufAI Intelligent Email Formatter and Domain Auto-Completion Engine
 * Handles automatic completion of missing domain (@gmail.com), fixes typos,
 * and validates modern email formats.
 */

// Common domain typo corrections
const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmeil.com": "gmail.com",
  "gmaio.com": "gmail.com",
  "googlemail.co": "googlemail.com",
  "googlemail.con": "googlemail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.co": "outlook.com",
  "outlook.con": "outlook.com",
  "hotmial.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "iclou.com": "icloud.com",
  "iclud.com": "icloud.com",
  "icloud.co": "icloud.com",
};

/**
 * Normalizes, auto-completes and fixes an email address
 * Examples:
 * - "lrsoufyane2007" -> "lrsoufyane2007@gmail.com"
 * - "lrsoufyane2007@" -> "lrsoufyane2007@gmail.com"
 * - "lrsoufyane2007@g" -> "lrsoufyane2007@gmail.com"
 * - "lrsoufyane2007@gm" -> "lrsoufyane2007@gmail.com"
 * - "lrsoufyane2007@gmail" -> "lrsoufyane2007@gmail.com"
 * - "lrsoufyane2007@gmail." -> "lrsoufyane2007@gmail.com"
 * - "user@gmai.com" -> "user@gmail.com"
 * - "support@souftools.com" -> "support@souftools.com" (preserves valid domains)
 */
export function normalizeAndFixEmailAddress(rawInput: string, defaultDomain: string = "gmail.com"): string {
  if (!rawInput) return "";
  let clean = rawInput.trim().toLowerCase();

  // Remove any surrounding angle brackets, quotes, or whitespace
  clean = clean.replace(/^[<"'\s]+|[>"'\s]+$/g, "");

  // If no '@' is present at all, append @gmail.com
  if (!clean.includes("@")) {
    return `${clean}@${defaultDomain}`;
  }

  const parts = clean.split("@");
  const localPart = parts[0].trim();
  let domainPart = parts.slice(1).join("@").trim();

  // If domain is empty (e.g. "user@")
  if (!domainPart || domainPart === "") {
    return `${localPart}@${defaultDomain}`;
  }

  // If domain is partial like "g", "gm", "gma", "gmai", "gmail", "gmail."
  if (
    domainPart === "g" ||
    domainPart === "gm" ||
    domainPart === "gma" ||
    domainPart === "gmai" ||
    domainPart === "gmail" ||
    domainPart === "gmail."
  ) {
    return `${localPart}@gmail.com`;
  }

  // If domain is partial for googlemail
  if (
    domainPart === "google" ||
    domainPart === "googlem" ||
    domainPart === "googlemail" ||
    domainPart === "googlemail."
  ) {
    return `${localPart}@googlemail.com`;
  }

  // If domain is partial for outlook
  if (
    domainPart === "o" ||
    domainPart === "out" ||
    domainPart === "outl" ||
    domainPart === "outlo" ||
    domainPart === "outloo" ||
    domainPart === "outlook" ||
    domainPart === "outlook."
  ) {
    return `${localPart}@outlook.com`;
  }

  // If domain is partial for yahoo
  if (
    domainPart === "y" ||
    domainPart === "yah" ||
    domainPart === "yaho" ||
    domainPart === "yahoo" ||
    domainPart === "yahoo."
  ) {
    return `${localPart}@yahoo.com`;
  }

  // If domain is partial for hotmail
  if (
    domainPart === "h" ||
    domainPart === "hot" ||
    domainPart === "hotm" ||
    domainPart === "hotma" ||
    domainPart === "hotmai" ||
    domainPart === "hotmail" ||
    domainPart === "hotmail."
  ) {
    return `${localPart}@hotmail.com`;
  }

  // Check against known domain typos
  if (COMMON_DOMAIN_TYPOS[domainPart]) {
    domainPart = COMMON_DOMAIN_TYPOS[domainPart];
  }

  // If domain does not contain a dot (e.g. "user@company"), append .com if standard
  if (!domainPart.includes(".")) {
    if (domainPart === "gmail") domainPart = "gmail.com";
    else if (domainPart === "outlook") domainPart = "outlook.com";
    else if (domainPart === "yahoo") domainPart = "yahoo.com";
    else if (domainPart === "hotmail") domainPart = "hotmail.com";
    else if (domainPart === "icloud") domainPart = "icloud.com";
    else domainPart = `${domainPart}.com`;
  }

  return `${localPart}@${domainPart}`;
}

/**
 * Provides auto-complete suggestions for email input
 */
export function getEmailDomainSuggestions(input: string): string[] {
  if (!input) return [];
  const clean = input.trim();
  if (!clean.includes("@")) {
    return [
      `${clean}@gmail.com`,
      `${clean}@outlook.com`,
      `${clean}@yahoo.com`,
      `${clean}@hotmail.com`,
    ];
  }

  const [local, domain] = clean.split("@");
  if (!domain) {
    return [
      `${local}@gmail.com`,
      `${local}@outlook.com`,
      `${local}@yahoo.com`,
      `${local}@icloud.com`,
    ];
  }

  const commonDomains = [
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "yahoo.com",
    "hotmail.com",
    "icloud.com",
  ];

  return commonDomains
    .filter((d) => d.startsWith(domain.toLowerCase()))
    .map((d) => `${local}@${d}`);
}
