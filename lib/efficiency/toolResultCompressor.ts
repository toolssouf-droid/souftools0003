// lib/efficiency/toolResultCompressor.ts
/**
 * Tool Result Compressor
 * Prunes and summarizes oversized tool outputs (web pages, huge JSON logs, search dumps)
 * before injecting into agent context, saving up to 70% of prompt tokens.
 */

import { getEfficiencyConfig, estimateTokens } from "./efficiencyStore";

export interface CompressionResult {
  compressedData: any;
  originalLength: number;
  compressedLength: number;
  tokensSaved: number;
  wasCompressed: boolean;
}

/**
 * Compresses tool result payloads
 */
export function compressToolOutput(toolName: string, data: any): CompressionResult {
  const config = getEfficiencyConfig();

  if (!config.compressToolOutputs || !data) {
    const rawLen = typeof data === "string" ? data.length : JSON.stringify(data).length;
    return {
      compressedData: data,
      originalLength: rawLen,
      compressedLength: rawLen,
      tokensSaved: 0,
      wasCompressed: false,
    };
  }

  // 1. Web Search Page Content Compression (HTML / Scraped Text)
  if (toolName === "open_page" || toolName === "web_search") {
    if (typeof data === "string") {
      const origLen = data.length;
      if (origLen > 2500) {
        const cleaned = data
          .replace(/\s{2,}/g, " ")
          .replace(/(\n\s*){2,}/g, "\n")
          .slice(0, 2200);

        const compLen = cleaned.length;
        const tokensSaved = estimateTokens(data.slice(2200));

        return {
          compressedData: `${cleaned}\n...[تم تقليص المحتوى للحفاظ على كفاءة الـ Tokens]`,
          originalLength: origLen,
          compressedLength: compLen,
          tokensSaved,
          wasCompressed: true,
        };
      }
    } else if (typeof data === "object") {
      if (data.content && typeof data.content === "string" && data.content.length > 2500) {
        const origLen = data.content.length;
        const compressedContent = data.content
          .replace(/\s{2,}/g, " ")
          .replace(/(\n\s*){2,}/g, "\n")
          .slice(0, 2200);

        return {
          compressedData: {
            ...data,
            content: `${compressedContent}\n...[محتوى مضغوط للكفاءة]`,
          },
          originalLength: origLen,
          compressedLength: compressedContent.length,
          tokensSaved: estimateTokens(data.content.slice(2200)),
          wasCompressed: true,
        };
      }
    }
  }

  // 2. Generic Large Objects / Dumps
  const rawString = typeof data === "string" ? data : JSON.stringify(data);
  const origLen = rawString.length;

  if (origLen > 4000) {
    const truncated = rawString.slice(0, 3000);
    return {
      compressedData: `${truncated}\n...[تم اختصار البيانات لتوفير الحصة]`,
      originalLength: origLen,
      compressedLength: 3000,
      tokensSaved: estimateTokens(rawString.slice(3000)),
      wasCompressed: true,
    };
  }

  return {
    compressedData: data,
    originalLength: origLen,
    compressedLength: origLen,
    tokensSaved: 0,
    wasCompressed: false,
  };
}
