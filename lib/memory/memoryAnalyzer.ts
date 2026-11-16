import { SoufAIMemory, MemoryCandidate, MemoryType } from "./types";

/**
 * Checks if a string contains sensitive patterns like API keys, secrets, credit cards, or passwords.
 * Ensures privacy and safety before saving memories.
 */
export function containsSensitiveData(text: string): boolean {
  if (!text) return false;

  const patterns = [
    /AIzaSy[A-Za-z0-9_-]{33}/, // Gemini / Google API Key
    /sk-[A-Za-z0-9]{32,}/, // OpenAI key
    /ghp_[A-Za-z0-9]{36}/, // GitHub PAT
    /sq0atp-[A-Za-z0-9_-]{22}/, // Square token
    /xox[baprs]-[A-Za-z0-9_-]{10,}/, // Slack token
    /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}/, // JWT token
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/, // Credit Card
    /\b(password|كلمة المرور|السر|secret|private_key|token|api_key|apikey)\s*[:=]\s*[^\s]+/i,
  ];

  return patterns.some((pattern) => pattern.test(text));
}

/**
 * Keywords and patterns in Arabic & English that signal explicit memory request or facts
 */
const MEMORY_EXPLICIT_PATTERNS = [
  /تذكر أ?ن/i,
  /احفظ ه?ذا/i,
  /سجل ع?ندك/i,
  /من الآن فصاعدا/i,
  /في هذا المشروع/i,
  /مشروعي اسمه/i,
  /مشروعي هو/i,
  /اسمي\s*[:=]?\s*([^\n.,;!]+)/i,
  /أنا\s+([^\n.,;!]+)/i,
  /remember that/i,
  /save this/i,
  /store in memory/i,
  /for this project/i,
  /my project is/i,
  /always use/i,
  /دائما استخدم/i,
  /أنا أعمل على/i,
  /أنا أفضل/i,
  /أنا أفضّل/i,
];

/**
 * Analyzes a user prompt to discover potential new long-term memories
 */
export function analyzePromptForNewMemory(
  prompt: string,
  projectName?: string
): MemoryCandidate | null {
  if (!prompt || prompt.trim().length < 4) return null;
  if (containsSensitiveData(prompt)) return null;

  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();

  // 1. Name detection
  const nameMatch = trimmed.match(/(?:اسمي|اسم المستخدم هو|نادني بـ|my name is|i am called)\s*[:=]?\s*([^\n.,;!]+)/i);
  if (nameMatch && nameMatch[1]) {
    const extractedName = nameMatch[1].trim();
    if (extractedName.length >= 2 && extractedName.length <= 40) {
      return {
        type: "user",
        userName: extractedName,
        content: `اسم المستخدم المعتمد هو: ${extractedName}`,
        importance: 1.0,
        confidence: 0.99,
        isExplicitRequest: true,
        sensitive: false,
      };
    }
  }

  // Check explicit trigger
  const isExplicit = MEMORY_EXPLICIT_PATTERNS.some((pat) => pat.test(lower));

  // Project, Preference, or Search context discovery
  if (
    lower.includes("مشروع") ||
    lower.includes("project") ||
    lower.includes("نظام") ||
    lower.includes("تطبيق") ||
    lower.includes("app") ||
    lower.includes("اسمي") ||
    lower.includes("أفضل") ||
    lower.includes("أفضّل") ||
    lower.includes("دائما") ||
    lower.includes("لا تستخدم") ||
    isExplicit
  ) {
    let type: MemoryType = "knowledge";
    let extractedContent = trimmed;

    // Clean prefix keywords for concise content
    extractedContent = extractedContent
      .replace(/^(تذكر أن|احفظ هذا|سجل عندك|من الآن فصاعداً|remember that|save this)\s*[:،,-]?\s*/i, "")
      .trim();

    if (
      lower.includes("أفضّل") ||
      lower.includes("أفضل") ||
      lower.includes("استخدم دائما") ||
      lower.includes("لا تستخدم") ||
      lower.includes("i prefer") ||
      lower.includes("always use")
    ) {
      type = "preference";
    } else if (
      lower.includes("مشروع") ||
      lower.includes("project") ||
      lower.includes("تطبيق") ||
      lower.includes("أعمل على")
    ) {
      type = "project";
    } else if (
      lower.includes("اسمي") ||
      lower.includes("عمري") ||
      lower.includes("عملي") ||
      lower.includes("أنا مطور") ||
      lower.includes("أنا مهندس")
    ) {
      type = "user";
    }

    if (extractedContent.length > 5 && extractedContent.length < 400) {
      return {
        type,
        content: extractedContent,
        projectId: projectName ? projectName.toLowerCase().replace(/\s+/g, "_") : undefined,
        projectName: projectName,
        importance: isExplicit ? 1.0 : 0.85,
        confidence: isExplicit ? 0.95 : 0.8,
        isExplicitRequest: isExplicit,
        sensitive: false,
      };
    }
  }

  return null;
}

/**
 * Ranks and retrieves the most relevant memories for a given prompt
 */
export function retrieveRelevantMemories(
  prompt: string,
  memories: SoufAIMemory[],
  maxCount: number = 8,
  activeProjectId?: string
): SoufAIMemory[] {
  if (!memories || memories.length === 0) return [];

  const enabledMemories = memories.filter((m) => m.enabled);
  if (enabledMemories.length === 0) return [];

  const lowerPrompt = prompt.toLowerCase();
  const isIdentityOrMemoryQuery =
    lowerPrompt.includes("من أنا") ||
    lowerPrompt.includes("من اكون") ||
    lowerPrompt.includes("ما اسمي") ||
    lowerPrompt.includes("اسمي") ||
    lowerPrompt.includes("بياناتي") ||
    lowerPrompt.includes("معلوماتي") ||
    lowerPrompt.includes("تفضيلاتي") ||
    lowerPrompt.includes("ذاكرتي") ||
    lowerPrompt.includes("داكرتي") ||
    lowerPrompt.includes("الذاكرة") ||
    lowerPrompt.includes("الداكرة") ||
    lowerPrompt.includes("ماذا تعرف عني") ||
    lowerPrompt.includes("تذكرني") ||
    lowerPrompt.includes("مشروعي") ||
    lowerPrompt.includes("who am i") ||
    lowerPrompt.includes("what is my name") ||
    lowerPrompt.includes("my name") ||
    lowerPrompt.includes("what do you know about me") ||
    lowerPrompt.includes("my memory") ||
    lowerPrompt.includes("my preferences") ||
    lowerPrompt.includes("recall");

  const promptTokens = new Set(
    lowerPrompt
      .replace(/[^\w\s\u0600-\u06FF]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );

  const scored = enabledMemories.map((mem) => {
    let score = mem.importance * 2; // base score from importance

    // Massive boost if user is inquiring about their identity, profile, memory, or preferences
    if (isIdentityOrMemoryQuery) {
      if (mem.type === "user") score += 12;
      if (mem.type === "preference") score += 10;
      if (mem.type === "project") score += 8;
      if (mem.type === "knowledge") score += 6;
      if (mem.userName) score += 10;
    }

    // Project alignment bonus
    if (activeProjectId && mem.projectId && mem.projectId === activeProjectId) {
      score += 5;
    }

    // Direct content keyword match
    const memTokens = mem.content
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    let matches = 0;
    for (const token of memTokens) {
      if (promptTokens.has(token)) matches++;
    }

    if (memTokens.length > 0) {
      score += (matches / memTokens.length) * 6;
    }

    // High importance / user explicitly saved items get baseline weight
    if (mem.source === "user") score += 2;
    if (mem.type === "project") score += 1.5;

    return { mem, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Return top items meeting threshold (or all if identity query)
  const threshold = isIdentityOrMemoryQuery ? 0.5 : 1.2;
  const filtered = scored
    .filter((item) => item.score > threshold)
    .slice(0, maxCount)
    .map((item) => item.mem);

  // If identity query and no items passed, fallback to all enabled memories up to maxCount
  if (isIdentityOrMemoryQuery && filtered.length === 0) {
    return enabledMemories.slice(0, maxCount);
  }

  return filtered;
}
