// lib/i18n/pseudo.ts

/**
 * Pseudo-localization transforms text strings to test layout resilience,
 * overflow, long words, and special character rendering.
 * Example: "Start Chat" -> "[Šţáŕţ Ĉĥáţ ẅẋýž !!!]"
 */

const CHAR_MAP: Record<string, string> = {
  a: "á",
  b: "ḃ",
  c: "ć",
  d: "đ",
  e: "è",
  f: "ƒ",
  g: "ğ",
  h: "ĥ",
  i: "ī",
  j: "ĵ",
  k: "ķ",
  l: "ĺ",
  m: "ṁ",
  n: "ñ",
  o: "ò",
  p: "p",
  q: "q",
  r: "ŕ",
  s: "ś",
  t: "ť",
  u: "ū",
  v: "v",
  w: "ẅ",
  x: "ẋ",
  y: "ý",
  z: "ž",
  A: "Á",
  B: "Ḃ",
  C: "Ć",
  D: "Đ",
  E: "È",
  F: "Ƒ",
  G: "Ğ",
  H: "Ĥ",
  I: "Ī",
  J: "Ĵ",
  K: "Ķ",
  L: "Ĺ",
  M: "Ṁ",
  N: "Ñ",
  O: "Ò",
  P: "P",
  Q: "Q",
  R: "Ŕ",
  S: "Ś",
  T: "Ť",
  U: "Ū",
  V: "V",
  W: "Ẅ",
  X: "Ẍ",
  Y: "Ý",
  Z: "Ž",
};

export function pseudoLocalize(text: string): string {
  if (!text || typeof text !== "string") return text;
  
  // Keep code templates or placeholders untouched
  const parts = text.split(/(\{.*?\})/);
  
  const transformed = parts.map((part) => {
    if (part.startsWith("{") && part.endsWith("}")) return part;
    return part
      .split("")
      .map((ch) => CHAR_MAP[ch] || ch)
      .join("");
  }).join("");

  return `[${transformed} !!!]`;
}

let globalPseudoMode = false;

export function isPseudoLocalizationActive(): boolean {
  return globalPseudoMode;
}

export function togglePseudoLocalization(active?: boolean): boolean {
  if (typeof active === "boolean") {
    globalPseudoMode = active;
  } else {
    globalPseudoMode = !globalPseudoMode;
  }
  return globalPseudoMode;
}

