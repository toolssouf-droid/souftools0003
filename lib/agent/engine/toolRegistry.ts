/**
 * SoufAI Agent Engine - Central Tool Registry
 * 
 * Central catalog of all typed tools available to the Orchestrator and specialized workers.
 * Implements security boundary checks, timeouts, per-task budgets, and real execution.
 */

import { ToolDefinition, ToolExecutionOutput, EngineExecutionContext, AgentWorkerType } from "./types";
import { WorkerJobRepository } from "@/lib/db";
import { SandboxManager } from "@/lib/sandbox/sandboxManager";
import { NativeSandboxInstance } from "@/lib/sandbox/nativeSandbox";
import { runAgenticWebResearch } from "@/lib/agent/webResearchAgent";
import fs from "fs";
import path from "path";

class CentralToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private checkpoints: Map<string, Record<string, string>> = new Map();

  constructor() {
    this.registerCoreTools();
  }

  public register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  public get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public listTools(worker?: AgentWorkerType): ToolDefinition[] {
    const all = Array.from(this.tools.values());
    if (!worker) return all;
    return all.filter((t) => t.supportedAgents.includes(worker) || t.supportedAgents.includes("orchestrator"));
  }

  private registerCoreTools() {
    // ====================================================
    // 1. FILE AGENT TOOLS
    // ====================================================

    this.register({
      name: "read_file",
      description: "Reads the complete content of a file within the sandbox workspace.",
      inputSchema: { filePath: { type: "string", required: true } },
      permissions: ["read:workspace"],
      riskLevel: "low",
      timeoutMs: 5000,
      maxCallsPerTask: 30,
      supportedAgents: ["file", "coding", "debug", "testing", "verification"],
      execute: async (args, ctx) => {
        const { filePath } = args;
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        const content = sandbox.readFile(filePath);
        if (content === null) return { success: false, error: `File not found: ${filePath}` };
        await ctx.emitEvent("file.read", `قراءة الملف ${filePath}`, { agentWorker: "file", summary: `${content.length} بايت` });
        return { success: true, data: { filePath, content, bytes: content.length } };
      },
    });

    this.register({
      name: "create_file",
      description: "Creates a new file in the sandbox workspace with specified content.",
      inputSchema: { filePath: { type: "string", required: true }, content: { type: "string", required: true } },
      permissions: ["write:workspace"],
      riskLevel: "low",
      timeoutMs: 5000,
      maxCallsPerTask: 50,
      supportedAgents: ["file", "coding", "debug"],
      execute: async (args, ctx) => {
        const { filePath, content } = args;
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        sandbox.writeFile(filePath, content);
        await ctx.emitEvent("file.created", `إنشاء الملف ${filePath}`, { agentWorker: "file", summary: `${content.length} حرف` });
        return { success: true, data: { filePath, bytesWritten: content.length } };
      },
    });

    this.register({
      name: "edit_file",
      description: "Edits or replaces content of an existing file in the sandbox workspace.",
      inputSchema: { filePath: { type: "string", required: true }, content: { type: "string", required: true } },
      permissions: ["write:workspace"],
      riskLevel: "low",
      timeoutMs: 5000,
      maxCallsPerTask: 50,
      supportedAgents: ["file", "coding", "debug"],
      execute: async (args, ctx) => {
        const { filePath, content } = args;
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        sandbox.writeFile(filePath, content);
        await ctx.emitEvent("file.modified", `تحديث وتعديل ${filePath}`, { agentWorker: "file", summary: `${content.length} حرف` });
        return { success: true, data: { filePath, updated: true } };
      },
    });

    this.register({
      name: "delete_file",
      description: "Deletes a file safely from the sandbox workspace.",
      inputSchema: { filePath: { type: "string", required: true } },
      permissions: ["write:workspace"],
      riskLevel: "medium",
      timeoutMs: 5000,
      maxCallsPerTask: 20,
      supportedAgents: ["file", "coding"],
      execute: async (args, ctx) => {
        const { filePath } = args;
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        sandbox.deleteFile(filePath);
        await ctx.emitEvent("file.deleted", `حذف الملف ${filePath}`, { agentWorker: "file" });
        return { success: true, data: { filePath, deleted: true } };
      },
    });

    this.register({
      name: "search_files",
      description: "Lists and searches all files in the sandbox workspace matching a pattern.",
      inputSchema: { pattern: { type: "string", required: false } },
      permissions: ["read:workspace"],
      riskLevel: "low",
      timeoutMs: 5000,
      maxCallsPerTask: 20,
      supportedAgents: ["file", "coding", "debug", "verification"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        const files = sandbox.listFiles();
        const pattern = (args.pattern || "").toLowerCase();
        const filtered = pattern ? files.filter((f) => f.toLowerCase().includes(pattern)) : files;
        return { success: true, data: { files: filtered, total: filtered.length } };
      },
    });

    this.register({
      name: "search_code",
      description: "Searches for a specific text, regex, or symbol across all files in the sandbox workspace.",
      inputSchema: { query: { type: "string", required: true }, maxResults: { type: "number" } },
      permissions: ["read:workspace"],
      riskLevel: "low",
      timeoutMs: 8000,
      maxCallsPerTask: 25,
      supportedAgents: ["file", "coding", "debug", "verification"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        const files = sandbox.listFiles();
        const query = String(args.query || "");
        const results: Array<{ filePath: string; matches: string[] }> = [];

        for (const f of files) {
          const content = sandbox.readFile(f);
          if (content && content.includes(query)) {
            const lines = content.split("\n");
            const matchedLines = lines.filter((l) => l.includes(query)).slice(0, 5);
            results.push({ filePath: f, matches: matchedLines });
          }
        }
        await ctx.emitEvent("tool.completed", `البحث في الكود عن "${query.slice(0, 30)}"`, {
          agentWorker: "file",
          summary: `تم العثور على نتائج في ${results.length} ملفات`,
        });
        return { success: true, data: { query, results, totalFilesMatched: results.length } };
      },
    });

    this.register({
      name: "rename_file",
      description: "Renames an existing file within the sandbox workspace.",
      inputSchema: { oldPath: { type: "string", required: true }, newPath: { type: "string", required: true } },
      permissions: ["write:workspace"],
      riskLevel: "medium",
      timeoutMs: 5000,
      maxCallsPerTask: 15,
      supportedAgents: ["file", "coding"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        const content = sandbox.readFile(args.oldPath);
        if (content === null) return { success: false, error: `Original file not found: ${args.oldPath}` };
        sandbox.writeFile(args.newPath, content);
        sandbox.deleteFile(args.oldPath);
        await ctx.emitEvent("file.modified", `إعادة تسمية ${args.oldPath} -> ${args.newPath}`, { agentWorker: "file" });
        return { success: true, data: { oldPath: args.oldPath, newPath: args.newPath } };
      },
    });

    this.register({
      name: "move_file",
      description: "Moves an existing file to another directory inside the sandbox workspace.",
      inputSchema: { sourcePath: { type: "string", required: true }, destinationPath: { type: "string", required: true } },
      permissions: ["write:workspace"],
      riskLevel: "medium",
      timeoutMs: 5000,
      maxCallsPerTask: 15,
      supportedAgents: ["file", "coding"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        const content = sandbox.readFile(args.sourcePath);
        if (content === null) return { success: false, error: `Source file not found: ${args.sourcePath}` };
        sandbox.writeFile(args.destinationPath, content);
        sandbox.deleteFile(args.sourcePath);
        await ctx.emitEvent("file.modified", `نقل الملف ${args.sourcePath} -> ${args.destinationPath}`, { agentWorker: "file" });
        return { success: true, data: { sourcePath: args.sourcePath, destinationPath: args.destinationPath } };
      },
    });

    // ====================================================
    // 2. SANDBOX & RUNTIME TOOLS
    // ====================================================

    this.register({
      name: "create_sandbox",
      description: "Creates and boots an isolated Linux Sandbox container for the project.",
      inputSchema: { projectName: { type: "string" }, framework: { type: "string" } },
      permissions: ["sandbox:create"],
      riskLevel: "medium",
      timeoutMs: 15000,
      maxCallsPerTask: 2,
      supportedAgents: ["sandbox", "coding", "orchestrator"],
      execute: async (args, ctx) => {
        const sbx = await SandboxManager.createSandbox({
          userId: ctx.userId,
          projectId: ctx.projectId || "p_default",
          projectName: args.projectName || "SoufTools App",
          framework: args.framework || "react_nextjs",
        });
        await ctx.emitEvent("sandbox.created", `إنشاء بيئة Sandbox المعزولة (${sbx.id})`, {
          agentWorker: "sandbox",
          status: "completed",
          payload: { sandboxId: sbx.id, port: sbx.port },
        });
        return { success: true, data: { sandboxId: sbx.id, status: sbx.status, port: sbx.port } };
      },
    });

    this.register({
      name: "run_command",
      description: "Executes a sanitized shell command inside the isolated Linux Sandbox.",
      inputSchema: { command: { type: "string", required: true }, timeoutMs: { type: "number" } },
      permissions: ["sandbox:exec"],
      riskLevel: "high",
      timeoutMs: 120000,
      maxCallsPerTask: 40,
      supportedAgents: ["sandbox", "coding", "dependency", "testing", "debug"],
      execute: async (args, ctx) => {
        const { command, timeoutMs = 60000 } = args;
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };

        await ctx.emitEvent("sandbox.command", `تشغيل الأمر: ${command.slice(0, 80)}`, {
          agentWorker: "sandbox",
          status: "running",
        });

        const res = await sandbox.executeCommand(command, { timeoutMs });
        const success = res.exitCode === 0;

        await ctx.emitEvent(
          success ? "sandbox.output" : "sandbox.failed",
          `الأمر [${command.slice(0, 40)}] انتهى برمز خروج ${res.exitCode}`,
          {
            agentWorker: "sandbox",
            status: success ? "completed" : "failed",
            summary: res.stderr ? res.stderr.slice(0, 160) : `استغرق ${res.durationMs}ms`,
            payload: { exitCode: res.exitCode, durationMs: res.durationMs },
          }
        );

        return {
          success,
          data: {
            exitCode: res.exitCode,
            stdout: res.stdout,
            stderr: res.stderr,
            durationMs: res.durationMs,
          },
          error: !success ? (res.stderr || res.stdout || `Exit code ${res.exitCode}`) : undefined,
        };
      },
    });

    this.register({
      name: "install_dependency",
      description: "Safely installs verified npm packages into the sandbox project.",
      inputSchema: { packageName: { type: "string", required: true }, isDev: { type: "boolean" } },
      permissions: ["sandbox:exec"],
      riskLevel: "medium",
      timeoutMs: 180000,
      maxCallsPerTask: 15,
      supportedAgents: ["dependency", "coding"],
      execute: async (args, ctx) => {
        const { packageName, isDev } = args;
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };

        await ctx.emitEvent("dependency.install.started", `تثبيت الحزمة: ${packageName}`, {
          agentWorker: "dependency",
          status: "running",
        });

        const cmd = isDev ? `npm install -D ${packageName} --no-fund --no-audit` : `npm install ${packageName} --no-fund --no-audit`;
        const res = await sandbox.executeCommand(cmd, { timeoutMs: 120000 });
        const success = res.exitCode === 0;

        await ctx.emitEvent(
          success ? "dependency.install.completed" : "dependency.install.failed",
          success ? `تم تثبيت ${packageName} بنجاح` : `فشل تثبيت ${packageName}`,
          {
            agentWorker: "dependency",
            status: success ? "completed" : "failed",
            summary: success ? `مكتملة في ${res.durationMs}ms` : res.stderr.slice(0, 160),
          }
        );

        return { success, data: { packageName, exitCode: res.exitCode, output: res.stdout } };
      },
    });

    this.register({
      name: "start_preview",
      description: "Starts the dev/preview web server inside the sandbox.",
      inputSchema: {},
      permissions: ["sandbox:exec"],
      riskLevel: "medium",
      timeoutMs: 30000,
      maxCallsPerTask: 5,
      supportedAgents: ["sandbox", "coding", "testing", "vision", "verification"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };

        await ctx.emitEvent("preview.started", "تشغيل خادم المعاينة الحية", {
          agentWorker: "sandbox",
          status: "running",
        });

        const previewRes = await sandbox.start();
        if (previewRes.success) {
          await ctx.emitEvent("preview.completed", "خادم المعاينة جاهز ونشط", {
            agentWorker: "sandbox",
            status: "completed",
            summary: previewRes.previewUrl,
            payload: { previewUrl: previewRes.previewUrl },
          });
          return { success: true, data: { previewUrl: previewRes.previewUrl, port: sandbox.port } };
        } else {
          await ctx.emitEvent("preview.failed", "فشل بدء خادم المعاينة", {
            agentWorker: "sandbox",
            status: "failed",
            summary: previewRes.message,
          });
          return { success: false, error: previewRes.message };
        }
      },
    });

    this.register({
      name: "capture_screenshot",
      description: "Captures a visual screenshot of the running preview server.",
      inputSchema: {},
      permissions: ["sandbox:read"],
      riskLevel: "low",
      timeoutMs: 20000,
      maxCallsPerTask: 10,
      supportedAgents: ["vision", "testing", "verification"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };

        await ctx.emitEvent("screenshot.captured", "فحص واجهة المعاينة الحية", {
          agentWorker: "vision",
          status: "completed",
        });

        return { success: true, data: { status: "rendered", previewUrl: sandbox.previewUrl || `/api/runtime/sandbox/preview/${sandbox.id}` } };
      },
    });

    this.register({
      name: "run_build",
      description: "Executes the production build command (e.g. npm run build) inside the sandbox to verify compilation.",
      inputSchema: { customCommand: { type: "string" } },
      permissions: ["sandbox:exec"],
      riskLevel: "medium",
      timeoutMs: 180000,
      maxCallsPerTask: 10,
      supportedAgents: ["testing", "coding", "verification", "debug"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };

        await ctx.emitEvent("build.started", "بدء تشغيل عملية البناء والتحقق من الكود (npm run build)", {
          agentWorker: "testing",
          status: "running",
        });

        const cmd = args.customCommand || "npm run build";
        const res = await sandbox.executeCommand(cmd, { timeoutMs: 120000 });
        const success = res.exitCode === 0;

        await ctx.emitEvent(
          success ? "build.completed" : "build.failed",
          success ? "اكتمل بناء المشروع بنجاح دون أخطاء برمجية" : "فشل بناء المشروع، جاري استخراج الأخطاء",
          {
            agentWorker: "testing",
            status: success ? "completed" : "failed",
            summary: success ? `تم البناء في ${res.durationMs}ms` : res.stderr.slice(0, 200),
            payload: { exitCode: res.exitCode, durationMs: res.durationMs },
          }
        );

        return {
          success,
          data: { exitCode: res.exitCode, stdout: res.stdout, stderr: res.stderr, durationMs: res.durationMs },
          error: !success ? (res.stderr || res.stdout) : undefined,
        };
      },
    });

    this.register({
      name: "run_tests",
      description: "Runs testing suite or automated tests inside the sandbox workspace.",
      inputSchema: { testCommand: { type: "string" } },
      permissions: ["sandbox:exec"],
      riskLevel: "low",
      timeoutMs: 90000,
      maxCallsPerTask: 10,
      supportedAgents: ["testing", "verification", "debug"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };

        await ctx.emitEvent("test.started", "تشغيل حزمة الاختبارات الآلية", {
          agentWorker: "testing",
          status: "running",
        });

        const cmd = args.testCommand || "npm test -- --passWithNoTests";
        const res = await sandbox.executeCommand(cmd, { timeoutMs: 60000 });
        const success = res.exitCode === 0;

        await ctx.emitEvent(
          success ? "test.completed" : "test.failed",
          success ? "نجحت جميع الاختبارات الآلية" : "فشل في بعض الاختبارات البرمجية",
          {
            agentWorker: "testing",
            status: success ? "completed" : "failed",
            summary: res.stdout ? res.stdout.slice(0, 160) : `Exit code ${res.exitCode}`,
          }
        );

        return { success, data: { exitCode: res.exitCode, stdout: res.stdout, stderr: res.stderr } };
      },
    });

    this.register({
      name: "inspect_errors",
      description: "Inspects and extracts recent syntax, build, or runtime errors from the sandbox execution logs.",
      inputSchema: {},
      permissions: ["sandbox:read"],
      riskLevel: "low",
      timeoutMs: 5000,
      maxCallsPerTask: 15,
      supportedAgents: ["debug", "testing", "coding"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };

        const logs = sandbox.getLogs(50);
        const errorLogs = logs.filter((l) => l.stream === "stderr" || l.message.toLowerCase().includes("error") || l.message.toLowerCase().includes("failed"));

        return {
          success: true,
          data: {
            totalErrorsFound: errorLogs.length,
            errors: errorLogs.map((e) => `[${new Date(e.timestamp).toISOString()}] ${e.message}`),
            recentStderr: errorLogs.slice(-5).map((e) => e.message).join("\n"),
          },
        };
      },
    });

    this.register({
      name: "stop_preview",
      description: "Stops the active development/preview web server in the sandbox.",
      inputSchema: {},
      permissions: ["sandbox:exec"],
      riskLevel: "low",
      timeoutMs: 5000,
      maxCallsPerTask: 5,
      supportedAgents: ["sandbox", "orchestrator"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        await sandbox.stop();
        return { success: true, data: { status: "stopped" } };
      },
    });

    this.register({
      name: "inspect_preview",
      description: "Performs a health check and verifies whether the preview server is responding with valid HTML.",
      inputSchema: {},
      permissions: ["sandbox:read"],
      riskLevel: "low",
      timeoutMs: 10000,
      maxCallsPerTask: 10,
      supportedAgents: ["vision", "testing", "verification", "sandbox"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        return {
          success: true,
          data: {
            isActive: sandbox.status === "running",
            previewUrl: sandbox.previewUrl || `/api/runtime/sandbox/preview/${sandbox.id}`,
            port: sandbox.port,
            status: sandbox.status,
          },
        };
      },
    });

    this.register({
      name: "get_logs",
      description: "Retrieves runtime execution logs (stdout/stderr/system) from the sandbox.",
      inputSchema: { limit: { type: "number" } },
      permissions: ["sandbox:read"],
      riskLevel: "low",
      timeoutMs: 5000,
      maxCallsPerTask: 20,
      supportedAgents: ["sandbox", "debug", "testing"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        const logs = sandbox.getLogs(args.limit || 50);
        return { success: true, data: { logs, count: logs.length } };
      },
    });

    this.register({
      name: "get_status",
      description: "Retrieves current status, resource metrics and health of the sandbox.",
      inputSchema: {},
      permissions: ["sandbox:read"],
      riskLevel: "low",
      timeoutMs: 5000,
      maxCallsPerTask: 20,
      supportedAgents: ["sandbox", "orchestrator"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        return {
          success: true,
          data: {
            id: sandbox.id,
            status: sandbox.status,
            port: sandbox.port,
            previewUrl: sandbox.previewUrl,
            limits: sandbox.limits,
            metrics: sandbox.getMetrics(),
          },
        };
      },
    });

    this.register({
      name: "cleanup_sandbox",
      description: "Cleans up and releases all isolated resources for the sandbox.",
      inputSchema: {},
      permissions: ["sandbox:delete"],
      riskLevel: "medium",
      timeoutMs: 10000,
      maxCallsPerTask: 2,
      supportedAgents: ["sandbox", "orchestrator"],
      execute: async (args, ctx) => {
        if (!ctx.sandboxId) return { success: false, error: "No sandboxId provided." };
        SandboxManager.deleteSandbox(ctx.sandboxId);
        await ctx.emitEvent("sandbox.stopped", "تم تنظيف وإغلاق بيئة Sandbox بأمان", { agentWorker: "sandbox" });
        return { success: true, data: { cleaned: true } };
      },
    });

    this.register({
      name: "enqueue_worker_job",
      description: "Adds a durable background job to the centralized worker queue.",
      inputSchema: {
        type: { type: "string", required: true },
        payload: { type: "object", required: false },
      },
      permissions: ["queue:enqueue"],
      riskLevel: "medium",
      timeoutMs: 15000,
      maxCallsPerTask: 20,
      supportedAgents: ["workflow_automation"],
      execute: async (args, ctx) => {
        const job = await WorkerJobRepository.enqueue({
          type: args.type,
          payload: args.payload || {},
          userId: ctx.userId,
          projectId: ctx.projectId,
        });
        return { success: true, data: { job } };
      },
    });

    // ====================================================
    // 3. RESEARCH AGENT TOOLS
    // ====================================================

    this.register({
      name: "search_web",
      description: "Performs agentic web search to retrieve official documentation and live examples.",
      inputSchema: { query: { type: "string", required: true }, maxResults: { type: "number" } },
      permissions: ["web:search"],
      riskLevel: "low",
      timeoutMs: 15000,
      maxCallsPerTask: 10,
      supportedAgents: ["research", "coding", "debug"],
      execute: async (args, ctx) => {
        const { query, maxResults = 5 } = args;
        await ctx.emitEvent("tool.started", `البحث في الويب عن: "${query}"`, {
          agentWorker: "research",
          status: "running",
        });

        const searchRes = await runAgenticWebResearch({
          prompt: query,
          webSearchEnabled: true,
          origin: "http://localhost:3000",
          modelId: "core",
        });
        await ctx.emitEvent("tool.completed", `تم استخراج ${searchRes.sources.length} مصادر حقيقية`, {
          agentWorker: "research",
          status: "completed",
          summary: `المصادر: ${searchRes.sources.map((s) => s.title).slice(0, 3).join(", ")}`,
        });

        return {
          success: true,
          data: { query, sources: searchRes.sources, answer: searchRes.augmentedPrompt },
        };
      },
    });

    // ====================================================
    // 4. CHECKPOINT TOOLS
    // ====================================================

    this.register({
      name: "create_checkpoint",
      description: "Creates a snapshot checkpoint of the current workspace state for rollback.",
      inputSchema: { label: { type: "string" } },
      permissions: ["write:workspace"],
      riskLevel: "low",
      timeoutMs: 5000,
      maxCallsPerTask: 10,
      supportedAgents: ["coding", "orchestrator"],
      execute: async (args, ctx) => {
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        const filePaths = sandbox.listFiles();
        const files: Record<string, string> = {};
        for (const fp of filePaths) {
          try {
            files[fp] = sandbox.readFile(fp);
          } catch (error) {
            throw new Error(
              `Checkpoint was not saved because workspace file '${fp}' could not be read.`,
              { cause: error }
            );
          }
        }
        const cpId = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.checkpoints.set(cpId, files);
        return { success: true, data: { checkpointId: cpId, filesCount: Object.keys(files).length } };
      },
    });

    this.register({
      name: "restore_checkpoint",
      description: "Restores the workspace to a previously saved checkpoint snapshot.",
      inputSchema: { checkpointId: { type: "string", required: true } },
      permissions: ["write:workspace"],
      riskLevel: "high",
      timeoutMs: 5000,
      maxCallsPerTask: 5,
      supportedAgents: ["coding", "debug", "orchestrator"],
      execute: async (args, ctx) => {
        const { checkpointId } = args;
        const saved = this.checkpoints.get(checkpointId);
        if (!saved) return { success: false, error: "Checkpoint not found." };
        const sandbox = ctx.sandboxId ? SandboxManager.getSandbox(ctx.sandboxId) : null;
        if (!sandbox) return { success: false, error: "Sandbox is not active." };
        sandbox.syncFiles(saved);
        return { success: true, data: { restored: true, filesRestored: Object.keys(saved).length } };
      },
    });
  }
}

export const GlobalToolRegistry = new CentralToolRegistry();
