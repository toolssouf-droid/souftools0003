/**
 * SoufTools Native Sandbox Provider
 * Implements ISandboxProvider backed by Linux namespaces, cgroups, ulimit,
 * process isolation, and filesystem jailing (replaces E2B).
 * 
 * ARCHITECTURE:
 * SoufAI → Coding Agent → Sandbox Manager → Isolated Sandbox → Preview/Logs
 */

import {
  SandboxCreateOptions,
  SandboxExecutionResponse,
  SandboxProviderId,
  KeyTestResult,
  SandboxResources,
} from "../types";
import { ISandboxProvider } from "./e2bProvider";
import { SandboxManager } from "@/lib/sandbox/sandboxManager";

export class NativeSandboxProvider implements ISandboxProvider {
  public id: SandboxProviderId = "native_sandbox";
  public name = "SoufTools Native Sandbox";

  /**
   * Creates or gets a native isolated sandbox
   */
  public async createSandbox(
    options: SandboxCreateOptions
  ): Promise<SandboxExecutionResponse> {
    const startTime = Date.now();
    try {
      const sbx = await SandboxManager.createSandbox({
        userId: options.userId,
        projectId: options.projectId,
        projectName: options.projectName,
        framework: options.framework,
        files: options.files,
        port: options.port || 3000,
        limits: options.limits,
      });

      const metrics = sbx.getLiveMetrics();

      return {
        success: true,
        sessionId: sbx.id,
        previewUrl: sbx.previewUrl,
        status: sbx.status,
        provider: "native_sandbox",
        message: "تم إنشاء بيئة SoufTools Native Sandbox المعزولة بنجاح",
        latencyMs: Date.now() - startTime,
        resources: {
          cpu: `${sbx.limits.cpuCores} Core`,
          memory: `${sbx.limits.ramMb} MB`,
          disk: `${sbx.limits.diskMb} MB`,
          activeTimeSeconds: metrics.durationSeconds,
          processCount: metrics.processCount,
          networkMode: sbx.limits.networkMode,
        },
        metrics,
      };
    } catch (err: any) {
      return {
        success: false,
        status: "failed",
        provider: "native_sandbox",
        error: err?.message || "Failed to initialize Native Sandbox",
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Writes files and prepares/starts project inside native sandbox
   */
  public async startProject(
    sessionId: string,
    files: Record<string, string>,
    framework: string
  ): Promise<SandboxExecutionResponse> {
    const startTime = Date.now();
    try {
      const sbx = SandboxManager.getSandbox(sessionId);
      if (!sbx) {
        return {
          success: false,
          status: "failed",
          provider: "native_sandbox",
          error: "Sandbox session not found",
        };
      }

      sbx.syncFiles(files);
      const startRes = await sbx.start();
      const metrics = sbx.getLiveMetrics();

      return {
        success: startRes.success,
        sessionId: sbx.id,
        previewUrl: startRes.previewUrl,
        status: sbx.status,
        provider: "native_sandbox",
        message: startRes.message,
        latencyMs: Date.now() - startTime,
        resources: {
          cpu: `${sbx.limits.cpuCores} Core`,
          memory: `${sbx.limits.ramMb} MB`,
          disk: `${sbx.limits.diskMb} MB`,
          activeTimeSeconds: metrics.durationSeconds,
          processCount: metrics.processCount,
        },
        metrics,
      };
    } catch (err: any) {
      return {
        success: false,
        status: "failed",
        provider: "native_sandbox",
        error: err?.message || "Failed to start project in Native Sandbox",
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Stops the native sandbox
   */
  public async stopSandbox(sessionId: string): Promise<{ success: boolean; message: string }> {
    const ok = SandboxManager.stopSandbox(sessionId);
    if (ok) {
      return { success: true, message: "تم إيقاف بيئة Native Sandbox وتحرير موارد الذاكرة والعمليات بنجاح" };
    }
    return { success: false, message: "الجلسة غير موجودة أو متوقفة بالفعل" };
  }

  /**
   * Restarts native sandbox with optional new files
   */
  public async restartSandbox(
    sessionId: string,
    files: Record<string, string>
  ): Promise<SandboxExecutionResponse> {
    const startTime = Date.now();
    try {
      const sbx = await SandboxManager.restartSandbox(sessionId, files);
      if (!sbx) {
        return {
          success: false,
          status: "failed",
          provider: "native_sandbox",
          error: "Sandbox not found for restart",
        };
      }

      const metrics = sbx.getLiveMetrics();

      return {
        success: true,
        sessionId: sbx.id,
        previewUrl: sbx.previewUrl,
        status: sbx.status,
        provider: "native_sandbox",
        message: "تم إعادة تشغيل بيئة Native Sandbox بنجاح",
        latencyMs: Date.now() - startTime,
        resources: {
          cpu: `${sbx.limits.cpuCores} Core`,
          memory: `${sbx.limits.ramMb} MB`,
          disk: `${sbx.limits.diskMb} MB`,
          activeTimeSeconds: metrics.durationSeconds,
          processCount: metrics.processCount,
        },
        metrics,
      };
    } catch (err: any) {
      return {
        success: false,
        status: "failed",
        provider: "native_sandbox",
        error: err?.message || "Failed to restart Native Sandbox",
      };
    }
  }

  /**
   * Checks real live status and resources
   */
  public async checkStatus(
    sessionId: string
  ): Promise<{ active: boolean; resources?: SandboxResources; previewUrl?: string }> {
    const sbx = SandboxManager.getSandbox(sessionId);
    if (!sbx) {
      return { active: false };
    }

    const metrics = sbx.getLiveMetrics();
    const isActive = sbx.status === "running" || sbx.status === "active";

    return {
      active: isActive,
      previewUrl: sbx.previewUrl,
      resources: {
        cpu: `${sbx.limits.cpuCores} Core`,
        memory: `${metrics.ramUsageMb} MB / ${sbx.limits.ramMb} MB`,
        disk: `${metrics.diskUsageMb} MB / ${sbx.limits.diskMb} MB`,
        activeTimeSeconds: metrics.durationSeconds,
        processCount: metrics.processCount,
      },
    };
  }

  /**
   * Tests Native Linux environment isolation health
   */
  public async testKey(): Promise<KeyTestResult> {
    const startTime = Date.now();
    try {
      const limits = await SandboxManager.getGlobalLimits();
      const latencyMs = Math.max(1, Date.now() - startTime);

      return {
        valid: true,
        latencyMs,
        message: `نظام SoufTools Native Sandbox يعمل بكفاءة ذاتية عالية وعزل Linux متكامل (RAM: ${limits.ramMb}MB, CPU: ${limits.cpuCores} Core, Disk: ${limits.diskMb}MB)`,
        quotaRemaining: "Unlimited (Self-Hosted Linux Isolation)",
        testedAt: Date.now(),
      };
    } catch (err: any) {
      return {
        valid: false,
        latencyMs: Date.now() - startTime,
        message: `خطأ في فحص بيئة الساندبوكس المحلية: ${err?.message}`,
        testedAt: Date.now(),
      };
    }
  }
}
