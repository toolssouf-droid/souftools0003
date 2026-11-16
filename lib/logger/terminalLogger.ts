/**
 * SoufTools Modern Terminal Logger & CLI Display Engine
 * Provides ANSI-formatted, structured, high-visibility console output
 * with detailed real model and API key invocation metrics.
 */

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  
  // Foreground
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background
  bgBlue: "\x1b[44m",
  bgCyan: "\x1b[46m",
  bgGreen: "\x1b[42m",
  bgMagenta: "\x1b[45m",
  bgYellow: "\x1b[43m",
  bgRed: "\x1b[41m",
  bgDark: "\x1b[48;5;236m",
};

function getTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Global flag to ensure startup banner only renders once per process
const globalState = globalThis as unknown as {
  __soufTerminalBannerPrinted?: boolean;
  __soufDbInitLogged?: boolean;
};

export const terminalLogger = {
  /**
   * Logs real AI Model invocation with actual model name, key mask, provider, and latency
   */
  ai: (params: {
    model: string;
    provider: string;
    keyMask?: string;
    latencyMs?: number;
    status?: "success" | "fallback" | "error" | "retrying";
    tokensIn?: number;
    tokensOut?: number;
    details?: string;
  }) => {
    const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
    const badge = `${ANSI.bgCyan}${ANSI.black}${ANSI.bold} AI MODEL ${ANSI.reset}`;
    const modelStr = `${ANSI.brightCyan}${ANSI.bold}${params.model}${ANSI.reset}`;
    const provStr = `${ANSI.magenta}(${params.provider})${ANSI.reset}`;
    const keyStr = params.keyMask
      ? `${ANSI.yellow}🔑 [${params.keyMask}]${ANSI.reset}`
      : `${ANSI.gray}🔑 [ENV_DEFAULT]${ANSI.reset}`;
    
    let statusStr = "";
    if (params.status === "success" || !params.status) {
      statusStr = `${ANSI.green}✓ ${params.latencyMs ? `${params.latencyMs}ms` : "200 OK"}${ANSI.reset}`;
    } else if (params.status === "fallback") {
      statusStr = `${ANSI.yellow}↷ Fallback to Next${ANSI.reset}`;
    } else if (params.status === "retrying") {
      statusStr = `${ANSI.brightYellow}↻ Retrying Key${ANSI.reset}`;
    } else {
      statusStr = `${ANSI.red}✗ Failed${ANSI.reset}`;
    }

    const extra = params.details ? ` ${ANSI.gray}${params.details}${ANSI.reset}` : "";
    console.log(`${time} ${badge} ${modelStr} ${provStr} ${keyStr} → ${statusStr}${extra}`);
  },

  /**
   * Logs Database operations (Turso libSQL / Drizzle)
   */
  db: (message: string, isInitial: boolean = false) => {
    if (isInitial && globalState.__soufDbInitLogged) {
      return; // Deduplicate startup db connection logs
    }
    if (isInitial) {
      globalState.__soufDbInitLogged = true;
    }
    const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
    const badge = `${ANSI.bgBlue}${ANSI.white}${ANSI.bold} TURSO DB ${ANSI.reset}`;
    console.log(`${time} ${badge} ${ANSI.blue}${message}${ANSI.reset}`);
  },

  /**
   * Logs Auth and Admin authorization events
   */
  auth: (email: string, role: string, action: string) => {
    const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
    const badge = `${ANSI.bgGreen}${ANSI.black}${ANSI.bold} AUTH/RBAC ${ANSI.reset}`;
    const userStr = `${ANSI.brightGreen}${email}${ANSI.reset}`;
    const roleStr = `${ANSI.cyan}[${role}]${ANSI.reset}`;
    console.log(`${time} ${badge} ${userStr} ${roleStr} → ${action}`);
  },

  /**
   * Logs Telegram and WhatsApp Gateway events
   */
  gateway: (service: "telegram" | "whatsapp", message: string, type: "info" | "warn" | "error" = "info") => {
    const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
    const isWa = service === "whatsapp";
    const badge = isWa
      ? `${ANSI.bgGreen}${ANSI.black}${ANSI.bold} WHATSAPP ${ANSI.reset}`
      : `${ANSI.bgCyan}${ANSI.black}${ANSI.bold} TELEGRAM ${ANSI.reset}`;
    
    let color = ANSI.white;
    if (type === "warn") color = ANSI.yellow;
    if (type === "error") color = ANSI.red;

    console.log(`${time} ${badge} ${color}${message}${ANSI.reset}`);
  },

  /**
   * Logs Autonomous Agent and Tool executions
   */
  tool: (toolName: string, queryOrArgs: string, resultSummary?: string) => {
    const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
    const badge = `${ANSI.bgMagenta}${ANSI.white}${ANSI.bold} AGENT TOOL ${ANSI.reset}`;
    const toolStr = `${ANSI.brightYellow}${ANSI.bold}${toolName}${ANSI.reset}`;
    const argStr = `${ANSI.gray}"${queryOrArgs.slice(0, 60)}"${ANSI.reset}`;
    const resStr = resultSummary ? ` → ${ANSI.green}${resultSummary.slice(0, 60)}${ANSI.reset}` : "";
    console.log(`${time} ${badge} ${toolStr}(${argStr})${resStr}`);
  },

  /**
   * General Info log
   */
  info: (message: string, context?: string) => {
    const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
    const ctx = context ? `${ANSI.cyan}[${context}]${ANSI.reset} ` : "";
    console.log(`${time} ${ANSI.blue}ℹ${ANSI.reset} ${ctx}${message}`);
  },

  /**
   * General Success log
   */
  success: (message: string, context?: string) => {
    const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
    const ctx = context ? `${ANSI.green}[${context}]${ANSI.reset} ` : "";
    console.log(`${time} ${ANSI.green}✔${ANSI.reset} ${ctx}${ANSI.brightGreen}${message}${ANSI.reset}`);
  },

  /**
   * General Warn log
   */
  warn: (message: string, context?: string) => {
    const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
    const ctx = context ? `${ANSI.yellow}[${context}]${ANSI.reset} ` : "";
    console.log(`${time} ${ANSI.yellow}⚠${ANSI.reset} ${ctx}${ANSI.yellow}${message}${ANSI.reset}`);
  },

  /**
   * General Error log
   */
  error: (message: string, error?: any, context?: string) => {
    const time = `${ANSI.gray}[${getTimestamp()}]${ANSI.reset}`;
    const ctx = context ? `${ANSI.red}[${context}]${ANSI.reset} ` : "";
    const errDetail = error?.message || (typeof error === "string" ? error : "");
    console.error(`${time} ${ANSI.red}✖${ANSI.reset} ${ctx}${ANSI.red}${message}${errDetail ? ` (${errDetail})` : ""}${ANSI.reset}`);
  },

  /**
   * Displays Modern High-End Startup Dashboard in PowerShell / Terminal
   */
  printStartupBanner: (config?: {
    port?: number;
    dbStatus?: string;
    modelsLoaded?: number;
    keysConfigured?: number;
  }) => {
    if (globalState.__soufTerminalBannerPrinted) return;
    globalState.__soufTerminalBannerPrinted = true;

    const port = config?.port || 3000;
    const db = config?.dbStatus || "Turso Ready (libSQL + Drizzle ORM)";
    const modelsCount = config?.modelsLoaded ?? "Dynamic Multi-Tier";
    const keysCount = config?.keysConfigured ?? "Secure Cloud & DB Vault";

    console.log("\n" + ANSI.cyan + ANSI.bold +
      "╔══════════════════════════════════════════════════════════════════════════╗\n" +
      "║                       ⚡ SoufTools AI Platform v2.0                      ║\n" +
      "║                 Autonomous AI Engine & Omnichannel Gateway               ║\n" +
      "╠══════════════════════════════════════════════════════════════════════════╣" + ANSI.reset);
    console.log(
      `${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}Local Server:${ANSI.reset}    ${ANSI.green}http://localhost:${port}${ANSI.reset}`.padEnd(83) + `${ANSI.cyan}║${ANSI.reset}\n` +
      `${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}Network IP:${ANSI.reset}      ${ANSI.green}http://0.0.0.0:${port}${ANSI.reset}`.padEnd(83) + `${ANSI.cyan}║${ANSI.reset}\n` +
      `${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}Database:${ANSI.reset}        ${ANSI.brightCyan}${db}${ANSI.reset}`.padEnd(83) + `${ANSI.cyan}║${ANSI.reset}\n` +
      `${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}AI Model Engine:${ANSI.reset} ${ANSI.yellow}${modelsCount}${ANSI.reset}`.padEnd(83) + `${ANSI.cyan}║${ANSI.reset}\n` +
      `${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}Key Rotation:${ANSI.reset}    ${ANSI.magenta}${keysCount}${ANSI.reset}`.padEnd(83) + `${ANSI.cyan}║${ANSI.reset}\n` +
      `${ANSI.cyan}║${ANSI.reset}  ${ANSI.bold}Gateways:${ANSI.reset}        ${ANSI.brightGreen}WhatsApp Web Multi-Device + Telegram Long Polling${ANSI.reset}`.padEnd(83) + `${ANSI.cyan}║${ANSI.reset}`
    );
    console.log(ANSI.cyan + ANSI.bold +
      "╚══════════════════════════════════════════════════════════════════════════╝\n" + ANSI.reset);
  }
};
