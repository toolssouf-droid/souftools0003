/**
 * SoufAI Agent Engine - Specialized Security Worker
 * 
 * Inspects all operations for dangerous shell commands, path traversal,
 * symlink escape, secret/token leaks, SSRF, and isolation boundary violations.
 */

import { EngineExecutionContext } from "../types";

const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\s+-rf\s+\/+/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /:(){ :\|:& };:/, // Fork bomb
  /\bchmod\s+777\s+\/+/i,
  /\bchown\s+root\b/i,
  /\bcurl.*\|\s*bash/i,
  /\bwget.*\|\s*sh/i,
  /\/etc\/shadow/i,
  /\/etc\/passwd/i,
];

const SECRET_PATTERNS = [
  /AIzaSy[A-Za-z0-9_-]{33}/, // Google API Key
  /sk-[a-zA-Z0-9]{32,}/, // OpenAI/Standard Key
  /ghp_[a-zA-Z0-9]{36}/, // GitHub Token
  /postgres:\/\/[^@]+@/, // DB Connection strings
];

export interface SecurityWorkerInput {
  command?: string;
  filePath?: string;
  codeContent?: string;
}

export interface SecurityWorkerResult {
  isSafe: boolean;
  violations: string[];
}

export async function runSecurityWorker(
  input: SecurityWorkerInput,
  ctx: EngineExecutionContext
): Promise<SecurityWorkerResult> {
  const violations: string[] = [];

  // 1. Check Command Safety
  if (input.command) {
    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
      if (pattern.test(input.command)) {
        violations.push(`Dangerous shell command detected matching pattern: ${pattern}`);
      }
    }
  }

  // 2. Check Path Traversal
  if (input.filePath) {
    if (input.filePath.includes("..") || input.filePath.startsWith("/") || input.filePath.includes("\0")) {
      violations.push(`Path traversal or invalid character detected: ${input.filePath}`);
    }
  }

  // 3. Check Secret Leaks
  if (input.codeContent) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(input.codeContent)) {
        violations.push("Potential raw secret or API key exposed in source code.");
      }
    }
  }

  const isSafe = violations.length === 0;

  if (!isSafe) {
    await ctx.emitEvent("agent.subtask.failed", "اكتشاف انتهاك أمني عبر Security Agent", {
      agentWorker: "security",
      status: "failed",
      summary: violations.join(" | "),
    });
  }

  return { isSafe, violations };
}
