/**
 * SoufShield WAF (Web Application Firewall) & Anti-Code-Injection Engine
 * Deep Request Inspection, Hostile Signature Matching, and Automatic Perimeter Defense.
 * Server & Edge Compatible. Zero dependencies.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  extractClientIP,
  lookupGeo,
  parseClientDevice,
  detectAttackerTool,
  recordIncident,
  banIP,
  isIPBanned,
  isWhitelistedOrLocalIP,
  AttackVectorType,
  HackerIncident,
} from "./threatEngine";
import {
  inspectPromptGuardrails,
  wrapUntrustedContent,
  sanitizeModelResponse,
  ModelArmorVerdict,
} from "./modelArmorGuardrail";

export { inspectPromptGuardrails, wrapUntrustedContent, sanitizeModelResponse };
export type { ModelArmorVerdict };

// ==========================================
// 1. Comprehensive Hostile Attack Patterns
// ==========================================

interface InjectionRule {
  id: string;
  name: string;
  vector: AttackVectorType;
  severity: "critical" | "high" | "medium";
  pattern: RegExp;
  description: string;
}

const INJECTION_RULES: InjectionRule[] = [
  // A) SQL Injection (SQLi)
  {
    id: "SQLI_UNION_SELECT",
    name: "SQL Injection (UNION / SELECT Extraction)",
    vector: "SQL_INJECTION",
    severity: "critical",
    pattern: /(\bUNION\s+(ALL\s+)?SELECT\b|\bSELECT\s+[\s\S]+?\s+FROM\b|\bINSERT\s+INTO\b|\bDROP\s+(TABLE|DATABASE)\b|\bDELETE\s+FROM\b)/i,
    description: "Detected unauthorized SQL data extraction or modification clauses",
  },
  {
    id: "SQLI_BOOLEAN_TAUTOLOGY",
    name: "SQL Injection (Boolean Tautology / Auth Bypass)",
    vector: "SQL_INJECTION",
    severity: "critical",
    pattern: /('|\"|\b)\s*(OR|AND)\s+('?\d+'?|true)\s*=\s*('?\d+'?|true)/i,
    description: "Detected SQL authentication bypass tautology pattern",
  },
  {
    id: "SQLI_TIME_BLIND",
    name: "SQL Injection (Time-based Blind Delay / Sleep)",
    vector: "SQL_INJECTION",
    severity: "critical",
    pattern: /(\bpg_sleep\s*\(|\bsleep\s*\(|\bwaitfor\s+delay\b|\bbenchmark\s*\()/i,
    description: "Detected database time delay probe injection",
  },
  {
    id: "SQLI_COMMENT_TRUNCATION",
    name: "SQL Injection (Comment Truncation Attack)",
    vector: "SQL_INJECTION",
    severity: "high",
    pattern: /(--|\/\*[\s\S]*?\*\/|;\s*--|#\s*$)/,
    description: "Detected SQL query termination and comment masking",
  },

  // B) Remote Code Execution (RCE) & Command Injection (Tightened to real shell payloads, avoiding Markdown backticks)
  {
    id: "RCE_BASH_EXEC",
    name: "Remote Command Execution (Shell Execution)",
    vector: "RCE_COMMAND_INJECTION",
    severity: "critical",
    pattern: /(;\s*(rm\s+-rf\b|cat\s+\/etc\/(passwd|shadow)|nc\s+-e\b|\/bin\/(sh|bash)\b|wget\s+https?:\/\/[\s\S]*?\|\s*(sh|bash)|curl\s+https?:\/\/[\s\S]*?\|\s*(sh|bash)|chmod\s+\+[xr]|\/dev\/tcp\/\d+)|`\s*(rm\s+-rf|nc\s+-e|\/bin\/bash|curl\s+https?:\/\/[\s\S]*?\|\s*bash)\s*`|\$\(\s*(rm\s+-rf|nc\s+-e|\/bin\/bash|cat\s+\/etc\/passwd)\s*\))/i,
    description: "Detected shell command piping or execution binary invocation",
  },
  {
    id: "RCE_POWERSHELL_CMD",
    name: "Remote Command Execution (Windows CLI / PowerShell)",
    vector: "RCE_COMMAND_INJECTION",
    severity: "critical",
    pattern: /(powershell(\.exe)?\s+(-enc|-w\s+hidden|-c)|cmd(\.exe)?\s+\/c\s+)/i,
    description: "Detected Windows terminal command probe",
  },

  // C) Cross-Site Scripting (XSS)
  {
    id: "XSS_SCRIPT_TAG",
    name: "Cross-Site Scripting (Script Tag Injection)",
    vector: "XSS_ATTACK",
    severity: "high",
    pattern: /(<script[\s\S]*?>|<\/script>|<iframe[\s\S]*?>|<embed[\s\S]*?>)/i,
    description: "Detected malicious executable HTML script tag injection",
  },
  {
    id: "XSS_EVENT_HANDLER",
    name: "Cross-Site Scripting (Event Handler / JS URI)",
    vector: "XSS_ATTACK",
    severity: "high",
    pattern: /(javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|on(load|error|click|mouseover|submit|focus|change)\s*=)/i,
    description: "Detected inline DOM event handler or javascript scheme injection",
  },

  // D) Path Traversal & Local File Inclusion (LFI)
  {
    id: "PATH_TRAVERSAL_DOTS",
    name: "Path Traversal (Directory Climbing)",
    vector: "PATH_TRAVERSAL",
    severity: "critical",
    pattern: /(\.\.[\/\\]\.\.[\/\\]|\.\.[\/\\]|\/etc\/passwd|\/etc\/shadow|\/proc\/self\/|c:\\windows\\)/i,
    description: "Detected relative directory escaping or root filesystem probe",
  },

  // E) Sensitive File & Environment Recon
  {
    id: "SENSITIVE_ENV_PROBE",
    name: "Sensitive System File Probe",
    vector: "SENSITIVE_FILE_SCAN",
    severity: "high",
    pattern: /(\/\.env|\/\.git\/|\/\.aws\/|\/actuator\/|\/server-status|\/phpmyadmin|\/wp-config|\/id_rsa)/i,
    description: "Detected hostile scan probing credentials or version control roots",
  },

  // F) Prototype Pollution & Object Tampering
  {
    id: "PROTOTYPE_POLLUTION",
    name: "JavaScript Prototype Pollution Probe",
    vector: "RCE_COMMAND_INJECTION",
    severity: "critical",
    pattern: /(__proto__|constructor\[\s*['"]?prototype['"]?\s*\])/i,
    description: "Detected attempt to manipulate root Object prototype",
  },
];

// Whitelist of benign paths that may contain legitimate code samples or tokens
const BENIGN_URL_PATTERNS = [
  /^\/_next\//,
  /^\/api\/health/,
  /^\/api\/v1\/health/,
  /^\/api\/chat/,
  /^\/api\/v1\/chat/,
  /^\/api\/tools\/whatsapp/,
  /^\/api\/admin\/whatsapp/,
  /^\/api\/v1\/models\/compare/,
  /^\/api\/admin\/runtime\/logs/,
  /^\/favicon\.ico/,
  /^\/icon\.png/,
  /^\/robots\.txt/,
  /^\/sitemap\.xml/,
];

// ==========================================
// 2. Request Inspector & Threat Evaluator
// ==========================================

export interface WafInspectionResult {
  allowed: boolean;
  status?: number;
  reason?: string;
  response?: NextResponse;
  incident?: HackerIncident;
}

export function inspectRequest(req: NextRequest): WafInspectionResult {
  const url = req.nextUrl;
  const pathname = url.pathname;
  const search = url.search;
  const method = req.method as "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS";

  // 1. Skip benign Next.js asset paths and health checks
  if (BENIGN_URL_PATTERNS.some((p) => p.test(pathname))) {
    return { allowed: true };
  }

  // 2. Extract Client IP and User Agent
  const ip = extractClientIP(req.headers);
  const userAgent = req.headers.get("user-agent") || "";

  // 3. Whitelist loopback, container network, and internal platform health probes immediately
  if (isWhitelistedOrLocalIP(ip)) {
    return { allowed: true };
  }

  // 3. Fast-Check: Is IP already banned?
  if (isIPBanned(ip)) {
    const geo = lookupGeo(ip);
    return {
      allowed: false,
      status: 403,
      reason: "IP_BANNED",
      response: NextResponse.json(
        {
          code: "IP_BANNED",
          message: "تم حظر هذا العنوان نهائياً بسبب محاولات اختراق عدائية متكررة ضد المنصة.",
          ip,
          country: geo.country,
          support: "security@souftools.com",
        },
        { status: 403 }
      ),
    };
  }

  // 4. Inspect User-Agent for known Offensive Security Tools
  const toolInfo = detectAttackerTool(userAgent);
  if (
    toolInfo.category === "Exploitation Suite" ||
    (toolInfo.category === "Fuzzing & Directory Recon" && toolInfo.confidence >= 95)
  ) {
    const geo = lookupGeo(ip);
    const device = parseClientDevice(userAgent);
    const incident = recordIncident({
      ip,
      ipSanitized: ip,
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      isVpnOrTor: geo.isVpn,
      asnOrIsp: geo.isp,
      deviceType: device.deviceType,
      os: device.os,
      browserEngine: device.browserEngine,
      architecture: device.architecture,
      rawUserAgent: userAgent,
      attackerTool: toolInfo,
      attackVector: "SENSITIVE_FILE_SCAN",
      targetEndpoint: pathname,
      httpMethod: method,
      payloadSample: `Hostile Scanner User-Agent: ${userAgent.slice(0, 100)}`,
      payloadLocation: "user_agent",
      severity: "critical",
      actionTaken: "BLOCKED_AND_BANNED",
      status: "active_ban",
    });

    banIP(ip, `Hostile tool signature detected: ${toolInfo.name}`, "SQL_INJECTION", toolInfo.name);

    return {
      allowed: false,
      status: 403,
      reason: "OFFENSIVE_TOOL_BLOCKED",
      incident,
      response: NextResponse.json(
        {
          code: "OFFENSIVE_TOOL_BLOCKED",
          message: `تم رصد وحظر أداة الهجوم الآلية (${toolInfo.name}). تم تسجيل الحادثة وعنوان IP فورياً.`,
          incidentId: incident.id,
        },
        { status: 403 }
      ),
    };
  }

  // 5. Inspect Path and Query Parameters against Injection Rules
  const decodedPath = decodeURIComponentSafe(pathname);
  const decodedSearch = decodeURIComponentSafe(search);
  const inspectTargets: { location: "path" | "url_param"; text: string }[] = [
    { location: "path", text: decodedPath },
    { location: "url_param", text: decodedSearch },
  ];

  for (const target of inspectTargets) {
    if (!target.text) continue;

    for (const rule of INJECTION_RULES) {
      if (rule.pattern.test(target.text)) {
        const geo = lookupGeo(ip);
        const device = parseClientDevice(userAgent);
        const sample = target.text.slice(0, 150);

        const incident = recordIncident({
          ip,
          ipSanitized: ip,
          country: geo.country,
          countryCode: geo.countryCode,
          city: geo.city,
          isVpnOrTor: geo.isVpn,
          asnOrIsp: geo.isp,
          deviceType: device.deviceType,
          os: device.os,
          browserEngine: device.browserEngine,
          architecture: device.architecture,
          rawUserAgent: userAgent,
          attackerTool: toolInfo,
          attackVector: rule.vector,
          targetEndpoint: pathname,
          httpMethod: method,
          payloadSample: sample,
          payloadLocation: target.location,
          severity: rule.severity,
          actionTaken: "BLOCKED_AND_BANNED",
          status: "active_ban",
        });

        // Automatically ban on critical vectors
        if (rule.severity === "critical") {
          banIP(ip, `WAF Intercept: ${rule.name}`, rule.vector, toolInfo.name);
        }

        return {
          allowed: false,
          status: 403,
          reason: rule.id,
          incident,
          response: NextResponse.json(
            {
              code: "WAF_INJECTION_BLOCKED",
              message: "طلب مرفوض: تم رصد محاولة حقن غير مشروعة بواسطة جدار حماية التطبيقات (SoufShield WAF).",
              rule: rule.name,
              vector: rule.vector,
              incidentId: incident.id,
            },
            { status: 403 }
          ),
        };
      }
    }
  }

  return { allowed: true };
}

// ==========================================
// 3. Global HTTP Security Headers Injector
// ==========================================

export function applySecurityHeaders(res: NextResponse): NextResponse {
  // Prevent MIME sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");

  // Prevent Clickjacking (allow only same origin)
  res.headers.set("X-Frame-Options", "SAMEORIGIN");

  // Enforce HSTS (Strict Transport Security)
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

  // XSS Auditor (legacy browser defense)
  res.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer Policy
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict sensitive browser APIs
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  return res;
}

// Helper for safe URL decoding without throwing URIError
function decodeURIComponentSafe(uri: string): string {
  try {
    return decodeURIComponent(uri);
  } catch {
    return uri;
  }
}

/**
 * Deep inspects a parsed JSON body for hostile code injection and Prototype Pollution.
 * For AI/Chat endpoints, applies Model Armor Guardrails (Intent/Jailbreak detection)
 * rather than database SQL/Shell Regex rules, avoiding false positives on code snippets.
 */
export function inspectRequestBody(
  body: any,
  clientIp = "127.0.0.1",
  endpoint = "/api"
): {
  safe: boolean;
  violation?: { rule: string; vector: AttackVectorType; sample: string };
} {
  if (!body || typeof body !== "object") return { safe: true };

  // 1. Prototype Pollution Check (Applicable to all JSON payloads)
  const stringsToCheck: string[] = [];
  function collectStrings(obj: any, depth = 0) {
    if (depth > 6) return;
    if (typeof obj === "string") {
      stringsToCheck.push(obj);
    } else if (Array.isArray(obj)) {
      for (const item of obj) collectStrings(item, depth + 1);
    } else if (obj !== null && typeof obj === "object") {
      for (const [key, val] of Object.entries(obj)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          stringsToCheck.push(`[Prototype-Key: ${key}]`);
        }
        collectStrings(val, depth + 1);
      }
    }
  }

  collectStrings(body);

  for (const text of stringsToCheck) {
    if (text && text.includes("[Prototype-Key:")) {
      return {
        safe: false,
        violation: {
          rule: "JavaScript Prototype Pollution Probe",
          vector: "RCE_COMMAND_INJECTION",
          sample: text,
        },
      };
    }
  }

  // 2. AI Model & Chat Routes: Apply Google Model Armor / Anthropic Constitutional Guardrail
  const isAiRoute =
    endpoint.includes("/chat") ||
    endpoint.includes("/whatsapp") ||
    endpoint.includes("/models") ||
    endpoint.includes("/agent");

  if (isAiRoute) {
    const rawPrompt = body.prompt || body.message || body.userResponse || "";
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const guardrailVerdict = inspectPromptGuardrails(rawPrompt, messages);

    if (!guardrailVerdict.safe) {
      return {
        safe: false,
        violation: {
          rule: `Model Armor Guardrail: ${guardrailVerdict.category || "Jailbreak Block"}`,
          vector: "UNAUTHORIZED_ADMIN_BYPASS",
          sample: guardrailVerdict.reason || "Adversarial prompt injection attempt",
        },
      };
    }

    // AI content is safe from adversarial jailbreaks; allow developer code, SQL, and natural language freely
    return { safe: true };
  }

  // 3. Traditional Web Infrastructure Routes: Inspect against Hostile Injection Rules
  for (const text of stringsToCheck) {
    if (!text || text.length < 4) continue;

    for (const rule of INJECTION_RULES) {
      if (rule.severity === "critical" && rule.pattern.test(text)) {
        recordIncident({
          ip: clientIp,
          ipSanitized: clientIp,
          country: "Hostile Client",
          countryCode: "XX",
          isVpnOrTor: false,
          deviceType: "Offensive Terminal",
          os: "Hostile Payload Agent",
          browserEngine: "Direct API Client",
          architecture: "x86_64",
          rawUserAgent: "Body-Payload-Exploit",
          attackerTool: {
            name: "Automated Body Exploit Injection",
            category: "Exploitation Suite",
            confidence: 96,
            matchedSignature: rule.id,
          },
          attackVector: rule.vector,
          targetEndpoint: endpoint,
          httpMethod: "POST",
          payloadSample: text.slice(0, 150),
          payloadLocation: "request_body",
          severity: rule.severity,
          actionTaken: "BLOCKED_AND_BANNED",
          status: "active_ban",
        });

        if (!isWhitelistedOrLocalIP(clientIp)) {
          banIP(clientIp, `Hostile Body Payload: ${rule.name}`, "Auto-WAF", rule.vector);
        }

        return {
          safe: false,
          violation: {
            rule: rule.name,
            vector: rule.vector,
            sample: text.slice(0, 100),
          },
        };
      }
    }
  }

  return { safe: true };
}
