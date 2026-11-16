/**
 * SoufAI Nexus Engine — Security & Execution Control Layer
 *
 * Enforces:
 * - Least-privilege capability & tool authorization per agent & channel
 * - Zero privilege escalation during agent-to-agent delegation
 * - Dangerous shell, path-traversal, SSRF, and secret-exposure inspection
 * - User approval gating for elevated risk levels
 * - <untrusted_tool_data> boundary wrapping & secret sanitization
 */

import {
  inspectPromptGuardrails,
  sanitizeModelResponse,
  wrapUntrustedContent,
} from "@/lib/security/modelArmorGuardrail";
import { isSafePublicUrl } from "@/lib/security/ssrfGuard";
import type { ToolRiskLevel } from "../engine/types";
import type {
  NexusAgentDefinition,
  NexusChannel,
  NexusPermission,
  NexusSecurityPolicy,
  NexusToolAuthorizationResult,
} from "./types";

const DANGEROUS_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\/+/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /:(){ :\|:& };:/,
  /\bchmod\s+777\s+\/+/i,
  /\bchown\s+root\b/i,
  /\bcurl.*\|\s*bash/i,
  /\bwget.*\|\s*sh/i,
  /\/etc\/shadow/i,
  /\/etc\/passwd/i,
  /\bDROP\s+(TABLE|DATABASE)\b/i,
  /\bTRUNCATE\s+TABLE\b/i,
];

const SECRET_EXPOSURE_PATTERNS: RegExp[] = [
  /AIzaSy[A-Za-z0-9_-]{33}/,
  /sk-(proj-)?[A-Za-z0-9-_]{32,}/,
  /ghp_[A-Za-z0-9]{36}/,
  /libsql:\/\/[^@]+:[^@]+@/,
  /postgres(ql)?:\/\/[^@]+@/,
];

const DEFAULT_CHANNEL_PERMISSIONS: Record<NexusChannel, NexusPermission[]> = {
  web: [
    "read:workspace",
    "write:workspace",
    "delete:workspace",
    "sandbox:create",
    "sandbox:read",
    "sandbox:exec",
    "sandbox:delete",
    "web:search",
    "web:fetch",
    "db:read",
    "db:mutate",
    "memory:read",
    "memory:write",
    "schedule:read",
    "schedule:write",
    "queue:enqueue",
    "comms:gmail_read",
    "comms:gmail_write",
    "comms:whatsapp_send",
    "media:generate",
    "media:analyze",
    "media:control",
    "agent:delegate",
    "security:audit",
  ],
  api: [
    "read:workspace",
    "write:workspace",
    "delete:workspace",
    "sandbox:create",
    "sandbox:read",
    "sandbox:exec",
    "sandbox:delete",
    "web:search",
    "web:fetch",
    "db:read",
    "memory:read",
    "memory:write",
    "schedule:read",
    "schedule:write",
    "queue:enqueue",
    "agent:delegate",
    "security:audit",
  ],
  telegram: [
    "web:search",
    "web:fetch",
    "memory:read",
    "memory:write",
    "schedule:read",
    "schedule:write",
    "comms:gmail_read",
    "comms:gmail_write",
    "media:generate",
    "media:analyze",
  ],
  whatsapp: [
    "web:search",
    "web:fetch",
    "memory:read",
    "memory:write",
    "schedule:read",
    "schedule:write",
    "media:generate",
    "media:analyze",
  ],
};

export class NexusSecurityController {
  public buildDefaultPolicy(
    userId: string,
    channel: NexusChannel = "web",
    overrides?: Partial<NexusSecurityPolicy>
  ): NexusSecurityPolicy {
    const channelPerms = DEFAULT_CHANNEL_PERMISSIONS[channel] || DEFAULT_CHANNEL_PERMISSIONS.web;
    return {
      channel,
      userId,
      grantedPermissions: overrides?.grantedPermissions
        ? overrides.grantedPermissions.filter((p) => channelPerms.includes(p))
        : [...channelPerms],
      requireApprovalForRiskLevels: overrides?.requireApprovalForRiskLevels || ["critical"],
      blockDangerousShellPatterns: overrides?.blockDangerousShellPatterns ?? true,
      enforceSsrfGuard: overrides?.enforceSsrfGuard ?? true,
      enforcePathContainment: overrides?.enforcePathContainment ?? true,
      wrapUntrustedToolOutputs: overrides?.wrapUntrustedToolOutputs ?? true,
      redactSecretsInOutput: overrides?.redactSecretsInOutput ?? true,
      approvalHandler: overrides?.approvalHandler,
    };
  }

  /**
   * Computes non-escalating permissions during agent-to-agent delegation:
   * intersection(parentPermissions, targetAgent.permissionBoundaries, policy.grantedPermissions).
   */
  public computeDelegatedPermissions(params: {
    parentPermissions: NexusPermission[];
    targetAgent: NexusAgentDefinition;
    policy: NexusSecurityPolicy;
  }): NexusPermission[] {
    const parentSet = new Set(params.parentPermissions);
    const policySet = new Set(params.policy.grantedPermissions);
    return params.targetAgent.permissionBoundaries.filter(
      (p) => parentSet.has(p) && policySet.has(p)
    );
  }

  public inspectInputPrompt(
    prompt: string,
    messages: Array<{ role?: string; content?: string }> = []
  ) {
    return inspectPromptGuardrails(prompt, messages);
  }

  public authorizeToolExecution(params: {
    agent: NexusAgentDefinition;
    effectivePermissions: NexusPermission[];
    toolName: string;
    toolPermissions: string[];
    riskLevel: ToolRiskLevel;
    args: Record<string, any>;
    policy: NexusSecurityPolicy;
  }): NexusToolAuthorizationResult {
    const {
      agent,
      effectivePermissions,
      toolName,
      toolPermissions,
      riskLevel,
      args,
      policy,
    } = params;

    // 1. Agent allowlist check
    const allowlist = new Set(agent.allowedTools.map((t) => t.toLowerCase()));
    if (!allowlist.has("*") && !allowlist.has(toolName.toLowerCase())) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Agent '${agent.id}' is not authorized to invoke tool '${toolName}'.`,
        riskLevel,
        missingPermissions: [],
      };
    }

    // 2. Effective permission check (agent boundaries ∩ policy ∩ parent delegation)
    const effectiveSet = new Set<string>(effectivePermissions);
    const missing = toolPermissions.filter((p) => !effectiveSet.has(p)) as NexusPermission[];
    if (missing.length > 0) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Permission denied for tool '${toolName}' on channel '${policy.channel}': missing [${missing.join(", ")}].`,
        riskLevel,
        missingPermissions: missing,
      };
    }

    // 3. Dangerous shell command check
    if (policy.blockDangerousShellPatterns && typeof args?.command === "string") {
      for (const pat of DANGEROUS_COMMAND_PATTERNS) {
        if (pat.test(args.command)) {
          return {
            allowed: false,
            requiresApproval: false,
            reason: `Blocked dangerous shell command matching security rule.`,
            riskLevel: "critical",
            missingPermissions: [],
          };
        }
      }
    }

    // 4. Path traversal containment check
    if (policy.enforcePathContainment) {
      const pathKeys = ["filePath", "path", "oldPath", "newPath", "sourcePath", "destinationPath"];
      for (const pk of pathKeys) {
        const val = args?.[pk];
        if (typeof val === "string" && val.length > 0) {
          if (val.includes("..") || val.startsWith("/") || /^[a-zA-Z]:/.test(val) || val.includes("\0")) {
            return {
              allowed: false,
              requiresApproval: false,
              reason: `Blocked unsafe workspace path in '${pk}': ${val}`,
              riskLevel: "high",
              missingPermissions: [],
            };
          }
        }
      }
    }

    // 5. SSRF URL guard check
    if (policy.enforceSsrfGuard && typeof args?.url === "string" && args.url.trim().length > 0) {
      const urlCheck = isSafePublicUrl(args.url.trim());
      if (!urlCheck.safe) {
        return {
          allowed: false,
          requiresApproval: false,
          reason: `Blocked SSRF-unsafe URL: ${urlCheck.error}`,
          riskLevel: "high",
          missingPermissions: [],
        };
      }
    }

    // 6. Secret leak check in written content
    const contentKeys = ["content", "codeContent"];
    for (const ck of contentKeys) {
      const content = args?.[ck];
      if (typeof content === "string") {
        for (const secPat of SECRET_EXPOSURE_PATTERNS) {
          if (secPat.test(content)) {
            return {
              allowed: false,
              requiresApproval: true,
              reason: "Potential hardcoded secret or credential detected in payload.",
              riskLevel: "high",
              missingPermissions: [],
            };
          }
        }
      }
    }

    // 7. Risk approval gate
    const needsApproval = policy.requireApprovalForRiskLevels.includes(riskLevel);
    return {
      allowed: !needsApproval,
      requiresApproval: needsApproval,
      reason: needsApproval
        ? `Tool '${toolName}' has risk level '${riskLevel}' and requires explicit user approval.`
        : undefined,
      riskLevel,
      missingPermissions: [],
    };
  }

  public quarantineExternalData(content: string, source: string, toolName?: string): string {
    if (!content) return "";
    const wrapped = wrapUntrustedContent(content, source);
    return toolName
      ? `<untrusted_tool_data tool="${toolName}">\n${wrapped}\n</untrusted_tool_data>`
      : wrapped;
  }

  public sanitizeOutput(text: string): string {
    return sanitizeModelResponse(text);
  }
}

export const nexusSecurityController = new NexusSecurityController();
