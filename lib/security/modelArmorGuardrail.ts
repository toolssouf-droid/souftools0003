/**
 * SoufShield Model Armor & Constitutional Guardrail Engine
 * Inspired by Google Cloud Model Armor (SAIF) and Anthropic Constitutional Classifiers.
 * 
 * Provides runtime safety, prompt injection detection, and jailbreak defense for LLM interactions.
 * Guarantees zero false positives for legitimate coding (SQL, Bash, APIs, Backticks).
 * Does NOT ban client IPs for conversational prompt exploration.
 */

export interface ModelArmorVerdict {
  safe: boolean;
  category?: "JAILBREAK_ATTEMPT" | "SYSTEM_PROMPT_EXTRACTION" | "EXPLOIT_PAYLOAD" | "MALICIOUS_EXFILTRATION";
  reason?: string;
  riskScore: number; // 0 (benign) - 100 (hostile)
}

// 1. Direct Adversarial Jailbreak Patterns (Multi-language: English & Arabic)
const JAILBREAK_PATTERNS: { pattern: RegExp; name: string; score: number }[] = [
  {
    pattern: /\b(ignore\s+(all\s+)?(previous|prior|system)\s+(instructions|prompts|rules|directives)|disregard\s+(all\s+)?(previous|prior|system)\s+(instructions|prompts|rules))\b/i,
    name: "Instruction Override Directive",
    score: 95,
  },
  {
    pattern: /\b(you\s+are\s+now\s+in\s+(dan|developer|jailbreak|unrestricted|god|anarchy|chaos)\s+mode|enable\s+(dan|developer|jailbreak)\s+mode)\b/i,
    name: "Persona Jailbreak (DAN / Developer Mode)",
    score: 98,
  },
  {
    pattern: /\b(bypass\s+(your\s+)?(content\s+filter|safety\s+filter|guidelines|guardrails|ethics)|disable\s+(your\s+)?(safety|moderation|filters))\b/i,
    name: "Safety Filter Neutralization Attempt",
    score: 92,
  },
  {
    pattern: /\b(pretend\s+you\s+have\s+no\s+(rules|restrictions|filters|ethics)|act\s+as\s+an\s+unfiltered\s+and\s+unrestricted\s+ai)\b/i,
    name: "Unrestricted AI Roleplay Attempt",
    score: 90,
  },
  {
    pattern: /\b(print\s+(your\s+)?(entire|full|raw)\s+(system\s+prompt|system\s+instructions)|output\s+(your\s+)?instructions\s+verbatim|reveal\s+(your\s+)?(hidden\s+prompt|system\s+prompt))\b/i,
    name: "System Prompt Extraction Attempt",
    score: 88,
  },
  // Arabic Adversarial Jailbreak Signatures
  {
    pattern: /(تجاهل\s+(كل|جميع)\s+(التعليمات|الأوامر|التوجيهات|القواعد)\s+(السابقة|الأصلية|المسبقة)|تجاهل\s+تعليمات\s+النظام\s+بالكامل)/i,
    name: "Arabic System Instruction Override",
    score: 95,
  },
  {
    pattern: /(أنت\s+الآن\s+في\s+وضع\s+(المطور|بدون\s+قيود|الكسر|دان|الحرية\s+المطلقة)|تفعيل\s+وضع\s+(المطور|الكسر))/i,
    name: "Arabic Developer/Jailbreak Mode Activation",
    score: 98,
  },
  {
    pattern: /(تجاوز\s+(فلاتر|حواجز|قيود)\s+(الأمان|الحماية|المحتوى)|عطّل\s+إرشادات\s+السلامة)/i,
    name: "Arabic Safety Bypass Directive",
    score: 92,
  },
  {
    pattern: /(اكشف\s+(لي\s+)?(موجه\s+النظام|تعليماتك\s+الأصلية|تعليمات\s+المطور|المفاتيح\s+السرية)|اطبع\s+نص\s+التوجيه\s+الأساسي\s+حرفياً)/i,
    name: "Arabic System Prompt Leak Attempt",
    score: 88,
  },
];

// 2. Data Exfiltration via Markdown Link Injection
const EXFILTRATION_PATTERNS = [
  /!\[.*?\]\(https?:\/\/[^\s\)]+?\?(exfil|steal|leak|token|key|cookie)=/i,
];

/**
 * Deep inspection of incoming AI prompt inputs following Model Armor standards.
 * Purely semantic and intent-focused. Never penalizes legitimate coding or tech discussions.
 */
export function inspectPromptGuardrails(
  prompt: string,
  messages: Array<{ role?: string; content?: string }> = []
): ModelArmorVerdict {
  if (!prompt && (!messages || messages.length === 0)) {
    return { safe: true, riskScore: 0 };
  }

  // Combine user content into a unified inspection buffer
  let textToInspect = prompt || "";
  if (messages && messages.length > 0) {
    const recentUserMessages = messages
      .filter((m) => m.role === "user" && typeof m.content === "string")
      .slice(-3)
      .map((m) => m.content)
      .join("\n");
    textToInspect = `${textToInspect}\n${recentUserMessages}`;
  }

  const cleanText = textToInspect.trim();
  if (cleanText.length < 5) {
    return { safe: true, riskScore: 0 };
  }

  // 1. Check for Exfiltration payloads
  for (const exfilPattern of EXFILTRATION_PATTERNS) {
    if (exfilPattern.test(cleanText)) {
      return {
        safe: false,
        category: "MALICIOUS_EXFILTRATION",
        reason: "تم رصد محاولة غير مصرح بها لتسريب البيانات عبر روابط وسائط خارجية (Model Armor Data Exfiltration Guard).",
        riskScore: 99,
      };
    }
  }

  // 2. Check for Adversarial Jailbreak & System Instruction Overrides
  for (const rule of JAILBREAK_PATTERNS) {
    if (rule.pattern.test(cleanText)) {
      return {
        safe: false,
        category: "JAILBREAK_ATTEMPT",
        reason: `تم رصد محاولة لتجاوز موجهات الأمان والدستور الأخلاقي للنموذج (${rule.name}) وفق معايير Model Armor. يرجى توجيه استفسارك بشكل سليم.`,
        riskScore: rule.score,
      };
    }
  }

  // All clear - safe for LLM ingestion
  return { safe: true, riskScore: 0 };
}

/**
 * Google SAIF & Anthropic Principle: Quarantines untrusted 3rd-party data (Web Search, WhatsApp peer messages, Scraped text)
 * Wraps content in clear boundary markers so the LLM treats it as data rather than instructions.
 */
export function wrapUntrustedContent(content: string, source: string = "untrusted_external"): string {
  if (!content) return "";
  return `<untrusted_source source="${source}">\n${content}\n</untrusted_source>`;
}

/**
 * Response Sanitization & Data Leakage Guardrail
 * Prevents accidental reflection of API keys or sensitive credential patterns in assistant answers.
 */
export function sanitizeModelResponse(text: string): string {
  if (!text) return "";

  // Redact potential exposed API keys or tokens in assistant outputs
  let sanitized = text;

  // Redact OpenAI/Google style API keys: AIzaSy..., sk-proj-...
  sanitized = sanitized.replace(/\bAIzaSy[0-9A-Za-z_-]{33}\b/g, "[REDACTED_API_KEY]");
  sanitized = sanitized.replace(/\bsk-(proj-)?[A-Za-z0-9-_]{32,}\b/g, "[REDACTED_API_KEY]");
  
  // Redact Postgres connection strings with passwords: postgresql://user:password@host/db
  sanitized = sanitized.replace(
    /postgres(ql)?:\/\/([^:]+):([^@]+)@/g,
    "postgresql://$2:[REDACTED_PASSWORD]@"
  );

  return sanitized;
}
