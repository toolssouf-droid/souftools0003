type AgentDecisionRecord = Record<string, any>;

const ACTION_TYPES = new Set(["CALL_TOOLS", "FINAL_ANSWER", "ASK_USER"]);
const INTERNAL_DECISION_FIELDS =
  /"(?:thoughtSummary|reasoningPhase|hypotheses|selfReflection|isGoalComplete)"\s*:/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractFirstJsonObject(text: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (start < 0) {
      if (char === "{") {
        start = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

export function parseAgentDecisionResponse(text?: string | null): AgentDecisionRecord | null {
  if (!text?.trim()) return null;

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const extracted = extractFirstJsonObject(cleaned);
  const candidates = Array.from(new Set([cleaned, extracted].filter((value): value is string => Boolean(value))));

  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }

    if (!isRecord(parsed) || !isRecord(parsed.action)) continue;
    if (typeof parsed.action.type !== "string" || !ACTION_TYPES.has(parsed.action.type)) continue;
    return parsed as AgentDecisionRecord;
  }

  return null;
}

export function isAgentDecisionPayload(text: string): boolean {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, "");
  if (!normalized.startsWith("{")) return false;

  return (
    INTERNAL_DECISION_FIELDS.test(normalized) ||
    (/"action"\s*:\s*\{/i.test(normalized) && /"(?:toolsToCall|finalResponse|tool)"\s*:/i.test(normalized))
  );
}

export function createSafeAnswerTokenSink(onToken?: (token: string) => void): (token: string) => void {
  let mode: "pending" | "stream" | "buffer" = "pending";
  let initialText = "";

  return (token) => {
    if (!onToken || !token) return;
    if (mode === "stream") {
      onToken(token);
      return;
    }
    if (mode === "buffer") return;

    initialText += token;
    const firstCharacter = initialText.trimStart()[0];
    if (!firstCharacter) return;

    if (firstCharacter === "{" || firstCharacter === "`") {
      mode = "buffer";
      initialText = "";
      return;
    }

    mode = "stream";
    onToken(initialText);
    initialText = "";
  };
}
