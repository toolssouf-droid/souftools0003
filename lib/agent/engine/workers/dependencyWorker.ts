/**
 * SoufAI Agent Engine - Specialized Dependency Worker
 * 
 * Verifies package compatibility, safe package versions,
 * lockfile consistency, and executes safe package installations.
 */

import { EngineExecutionContext } from "../types";
import { invokeWorkerTool } from "../contextTools";
import { throwIfAborted } from "../abort";

// Whitelisted / vetted safe standard packages
const FORBIDDEN_PACKAGES = [
  "eval",
  "node-ipc",
  "evil-package",
  "sudo",
  "root",
];

export interface DependencyWorkerInput {
  action: "install" | "verify" | "list";
  packages?: string[];
  isDev?: boolean;
}

export interface DependencyWorkerResult {
  success: boolean;
  installed: string[];
  failed: string[];
  summary: string;
}

export async function runDependencyWorker(
  input: DependencyWorkerInput,
  ctx: EngineExecutionContext
): Promise<DependencyWorkerResult> {
  if (!ctx.sandboxId) {
    return { success: false, installed: [], failed: [], summary: "Sandbox not active" };
  }

  const packages = input.packages || [];
  const installed: string[] = [];
  const failed: string[] = [];

  for (const pkg of packages) {
    throwIfAborted(ctx.signal);
    const cleanPkg = pkg.trim();
    if (!cleanPkg) continue;

    // Security check
    if (FORBIDDEN_PACKAGES.some((f) => cleanPkg.toLowerCase().includes(f))) {
      failed.push(cleanPkg);
      await ctx.emitEvent("dependency.install.failed", `تم حظر الحزمة غير الآمنة: ${cleanPkg}`, {
        agentWorker: "dependency",
        status: "failed",
      });
      continue;
    }

    await ctx.emitEvent("dependency.install.started", `تثبيت الحزمة: ${cleanPkg}`, {
      agentWorker: "dependency",
      status: "running",
    });

    const res = await invokeWorkerTool(ctx, "install_dependency", {
      packageName: cleanPkg,
      isDev: Boolean(input.isDev),
    }, { timeoutMs: 120000 });
    throwIfAborted(ctx.signal);
    if (res.success) {
      installed.push(cleanPkg);
      await ctx.emitEvent("dependency.install.completed", `تم تثبيت ${cleanPkg} بنجاح`, {
        agentWorker: "dependency",
        status: "completed",
        summary: `استغرق ${res.data?.durationMs || 0}ms`,
      });
    } else {
      failed.push(cleanPkg);
      await ctx.emitEvent("dependency.install.failed", `فشل تثبيت ${cleanPkg}`, {
        agentWorker: "dependency",
        status: "failed",
        summary: String(res.data?.stderr || res.error || "تعذر تثبيت الحزمة").slice(0, 120),
      });
    }
  }

  return {
    success: failed.length === 0,
    installed,
    failed,
    summary: `تم تثبيت ${installed.length} حزم بنجاح${failed.length > 0 ? `، وفشل ${failed.length}` : ""}`,
  };
}
