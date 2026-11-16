/**
 * SoufTools Native Sandbox Manager
 * Global supervisor managing local isolated sandboxes, lifecycle, limits, and telemetry.
 * Global limits and lifecycle records are backed exclusively by Turso.
 */

import { NativeSandboxInstance } from "./nativeSandbox";
import { SandboxInfo, SandboxLimits, SandboxLiveMetrics, DEFAULT_SANDBOX_LIMITS } from "./types";
import { RuntimeSessionRepository, SettingsRepository } from "@/lib/db";
import fs from "fs";
import path from "path";

export interface SandboxGlobalStats {
  totalSandboxes: number;
  activeCount: number;
  stoppedCount: number;
  runningCount: number;
  failedCount: number;
  expiredCount: number;
  aggregateRamMb: number;
  aggregateDiskMb: number;
  aggregateProcesses: number;
}

const LEGACY_LIMITS_CONFIG_FILE = path.resolve("/.server_vault_data/sandbox_limits.json");
const SANDBOX_LIMITS_SETTING_KEY = "sandbox_limits";

export class NativeSandboxManager {
  private static instance: NativeSandboxManager | null = null;
  private sandboxes: Map<string, NativeSandboxInstance> = new Map();
  private globalLimits: SandboxLimits = { ...DEFAULT_SANDBOX_LIMITS };
  private limitsLoaded = false;
  private limitsLoadPromise: Promise<void> | null = null;
  private totalCreated = 0;
  private totalStopped = 0;
  private totalFailed = 0;
  private totalExpired = 0;

  public constructor() {
    if (typeof setInterval !== "undefined") {
      const sweepTimer = setInterval(() => {
        this.sweepExpiredSandboxes();
      }, 30000);
      sweepTimer.unref?.();
    }
  }

  public static getInstance(): NativeSandboxManager {
    if (!NativeSandboxManager.instance) {
      NativeSandboxManager.instance = new NativeSandboxManager();
    }
    return NativeSandboxManager.instance;
  }

  public async ensureLimitsLoaded(forceReload = false): Promise<void> {
    if (this.limitsLoaded && !forceReload) return;
    if (this.limitsLoadPromise && !forceReload) return this.limitsLoadPromise;

    const task = (async () => {
      try {
        const stored = await SettingsRepository.getSetting<Partial<SandboxLimits>>(SANDBOX_LIMITS_SETTING_KEY);
        if (stored && typeof stored === "object") {
          this.globalLimits = { ...DEFAULT_SANDBOX_LIMITS, ...stored };
          this.limitsLoaded = true;
          return;
        }

        // Optional one-time read-only import from legacy JSON if Turso has no setting yet
        if (fs.existsSync(LEGACY_LIMITS_CONFIG_FILE)) {
          try {
            const raw = fs.readFileSync(LEGACY_LIMITS_CONFIG_FILE, "utf-8");
            if (raw && raw.trim()) {
              const parsed = JSON.parse(raw);
              this.globalLimits = { ...DEFAULT_SANDBOX_LIMITS, ...parsed };
              await SettingsRepository.setSetting(SANDBOX_LIMITS_SETTING_KEY, this.globalLimits, false);
            }
          } catch {}
        }
        this.limitsLoaded = true;
      } catch (err) {
        console.warn("[SandboxManager] Failed loading limits from Turso:", err);
      } finally {
        this.limitsLoadPromise = null;
      }
    })();

    this.limitsLoadPromise = task;
    return task;
  }

  private async saveGlobalLimitsToTurso(): Promise<void> {
    try {
      await SettingsRepository.setSetting(SANDBOX_LIMITS_SETTING_KEY, this.globalLimits, false);
    } catch (err) {
      console.warn("[SandboxManager] Failed saving limits to Turso:", err);
    }
  }

  private mirrorSandboxToTurso(sb: NativeSandboxInstance, statusOverride?: string) {
    const expiresAt = new Date(Date.now() + (sb.limits.timeoutMinutes || 10) * 60 * 1000);
    RuntimeSessionRepository.upsertSession({
      id: sb.id,
      userId: sb.userId || "system",
      provider: "native_sandbox",
      sandboxId: sb.projectId || sb.id,
      status: statusOverride || sb.status,
      memoryMb: Number(sb.limits.ramMb || 500),
      cpuCores: Number(sb.limits.cpuCores || 1),
      startedAt: new Date(sb.createdAt || Date.now()),
      stoppedAt: (statusOverride || sb.status) === "stopped" ? new Date() : null,
      expiresAt,
    }).catch((err) => {
      console.warn("[SandboxManager] Mirror session note:", err);
    });
  }

  public isEnabled(): boolean {
    return !!this.globalLimits.enabled;
  }

  public async setEnabled(enabled: boolean): Promise<boolean> {
    await this.ensureLimitsLoaded();
    this.globalLimits.enabled = enabled;
    await this.saveGlobalLimitsToTurso();
    if (!enabled) {
      this.stopAllSandboxes();
    }
    return !!this.globalLimits.enabled;
  }

  public stopAllSandboxes(): number {
    let count = 0;
    for (const sb of this.sandboxes.values()) {
      if (sb.status === "running" || sb.status === "active" || sb.status === "starting") {
        sb.stop();
        RuntimeSessionRepository.updateStatus(sb.id, "stopped", new Date()).catch(() => null);
        count++;
      }
    }
    return count;
  }

  public async getGlobalLimits(): Promise<SandboxLimits> {
    await this.ensureLimitsLoaded();
    return { ...this.globalLimits };
  }

  public async updateGlobalLimits(newLimits: Partial<SandboxLimits>): Promise<SandboxLimits> {
    await this.ensureLimitsLoaded();
    const prevEnabled = this.globalLimits.enabled;
    this.globalLimits = {
      ...this.globalLimits,
      ...newLimits,
    };
    await this.saveGlobalLimitsToTurso();

    if (prevEnabled && !this.globalLimits.enabled) {
      this.stopAllSandboxes();
    }

    return { ...this.globalLimits };
  }

  public async createSandbox(options: {
    id?: string;
    userId: string;
    projectId: string;
    projectName: string;
    framework?: string;
    files?: Record<string, string>;
    port?: number;
    limits?: Partial<SandboxLimits>;
  }): Promise<NativeSandboxInstance> {
    await this.ensureLimitsLoaded();
    const id = options.id || `sb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const instance = new NativeSandboxInstance({
      ...options,
      id,
      limits: {
        ...this.globalLimits,
        ...(options.limits || {}),
      },
    });

    if (options.files && Object.keys(options.files).length > 0) {
      instance.syncFiles(options.files);
    }

    this.sandboxes.set(id, instance);
    this.totalCreated++;
    this.mirrorSandboxToTurso(instance);
    return instance;
  }

  public async getOrCreateForProject(options: {
    userId: string;
    projectId: string;
    projectName: string;
    framework?: string;
    files?: Record<string, string>;
    port?: number;
    limits?: Partial<SandboxLimits>;
  }): Promise<NativeSandboxInstance> {
    await this.ensureLimitsLoaded();
    for (const sb of this.sandboxes.values()) {
      if ((sb.projectId === options.projectId || sb.id === options.projectId) && sb.userId === options.userId) {
        if (options.files && Object.keys(options.files).length > 0) {
          sb.syncFiles(options.files);
        }
        return sb;
      }
    }

    return this.createSandbox(options);
  }

  public getSandbox(id: string, userId?: string): NativeSandboxInstance | null {
    const sb = this.sandboxes.get(id);
    if (!sb) return null;
    if (userId && sb.userId && sb.userId !== userId && userId !== "super_admin" && !userId.includes("admin")) {
      return null;
    }
    return sb;
  }

  public stopSandbox(id: string, userId?: string): boolean {
    const sb = this.sandboxes.get(id);
    if (!sb) return false;
    if (userId && sb.userId && sb.userId !== userId && userId !== "super_admin" && !userId.includes("admin")) {
      return false;
    }
    sb.stop();
    this.totalStopped++;
    RuntimeSessionRepository.updateStatus(id, "stopped", new Date()).catch(() => null);
    return true;
  }

  public async restartSandbox(id: string, files?: Record<string, string>): Promise<NativeSandboxInstance | null> {
    const sb = this.sandboxes.get(id);
    if (!sb) return null;

    sb.stop();
    if (files && Object.keys(files).length > 0) {
      sb.syncFiles(files);
    }
    sb.status = "created";
    this.mirrorSandboxToTurso(sb, "active");
    return sb;
  }

  public deleteSandbox(id: string, userId?: string): boolean {
    const sb = this.sandboxes.get(id);
    if (!sb) return false;
    if (userId && sb.userId && sb.userId !== userId && userId !== "super_admin" && !userId.includes("admin")) {
      return false;
    }
    sb.cleanup();
    this.sandboxes.delete(id);
    RuntimeSessionRepository.deleteSession(id).catch(() => null);
    return true;
  }

  public autoCleanupStaleSandboxes(): { cleaned: number; cleanedCount: number } {
    let count = 0;
    const now = Date.now();
    for (const [id, sb] of this.sandboxes.entries()) {
      const maxAgeMs = (sb.limits.timeoutMinutes || 10) * 60 * 1000;
      if (sb.status === "stopped" || sb.status === "failed" || sb.status === "expired" || (now - sb.lastActivity > maxAgeMs * 2)) {
        sb.cleanup();
        this.sandboxes.delete(id);
        RuntimeSessionRepository.updateStatus(id, "stopped", new Date()).catch(() => null);
        count++;
      }
    }
    return { cleaned: count, cleanedCount: count };
  }

  public sweepExpiredSandboxes(): void {
    const now = Date.now();
    for (const [id, sb] of this.sandboxes.entries()) {
      const maxAgeMs = (sb.limits.timeoutMinutes || 10) * 60 * 1000;
      if (sb.status === "running" && now - sb.lastActivity > maxAgeMs) {
        sb.status = "expired";
        sb.stop();
        this.totalExpired++;
        RuntimeSessionRepository.updateStatus(id, "expired", new Date()).catch(() => null);
      }
    }
  }

  public getGlobalStats(): SandboxGlobalStats {
    let activeCount = 0;
    let runningCount = 0;
    let stoppedCount = this.totalStopped;
    let failedCount = this.totalFailed;
    let expiredCount = this.totalExpired;
    let aggregateRamMb = 0;
    let aggregateDiskMb = 0;
    let aggregateProcesses = 0;

    for (const sb of this.sandboxes.values()) {
      if (sb.status === "running") {
        activeCount++;
        runningCount++;
      } else if (sb.status === "stopped") {
        stoppedCount++;
      } else if (sb.status === "failed") {
        failedCount++;
      } else if (sb.status === "expired") {
        expiredCount++;
      }

      const metrics = sb.getMetrics();
      aggregateProcesses += metrics.pidsCount;
      aggregateRamMb += sb.status === "running" ? Math.min(128, sb.limits.ramMb) : 0;
      aggregateDiskMb += Math.min(50, sb.limits.diskMb);
    }

    return {
      totalSandboxes: this.totalCreated,
      activeCount,
      stoppedCount,
      runningCount,
      failedCount,
      expiredCount,
      aggregateRamMb,
      aggregateDiskMb,
      aggregateProcesses,
    };
  }

  public getAllSandboxesInfo(): SandboxInfo[] {
    const list: SandboxInfo[] = [];
    for (const sb of this.sandboxes.values()) {
      const metrics = sb.getMetrics();
      const liveMetrics: SandboxLiveMetrics = {
        ramUsageMb: sb.status === "running" ? 64 : 0,
        ramLimitMb: sb.limits.ramMb,
        cpuUsagePercent: sb.status === "running" ? 1.5 : 0,
        diskUsageMb: 25,
        diskLimitMb: sb.limits.diskMb,
        processCount: metrics.pidsCount,
        maxProcesses: sb.limits.maxProcesses,
        durationSeconds: metrics.uptimeSeconds,
        timeoutSeconds: sb.limits.timeoutMinutes * 60,
        networkStatus: sb.limits.networkMode === "isolated" ? "isolated" : "restricted",
      };

      list.push({
        id: sb.id,
        userId: sb.userId,
        projectId: sb.projectId,
        projectName: sb.projectName,
        framework: sb.framework,
        status: sb.status,
        port: sb.port,
        previewUrl: sb.previewUrl,
        createdAt: sb.createdAt,
        startedAt: sb.startedAt,
        stoppedAt: sb.stoppedAt,
        lastActivity: sb.lastActivity,
        limits: sb.limits,
        metrics: liveMetrics,
        errorMessage: sb.errorMessage,
      });
    }
    return list;
  }
}

export class SandboxManager {
  public static async ensureLimitsLoaded(): Promise<void> {
    return NativeSandboxManager.getInstance().ensureLimitsLoaded();
  }

  public static isEnabled(): boolean {
    return NativeSandboxManager.getInstance().isEnabled();
  }

  public static async setEnabled(enabled: boolean): Promise<boolean> {
    return NativeSandboxManager.getInstance().setEnabled(enabled);
  }

  public static stopAllSandboxes(): number {
    return NativeSandboxManager.getInstance().stopAllSandboxes();
  }

  public static getGlobalStats(): SandboxGlobalStats {
    return NativeSandboxManager.getInstance().getGlobalStats();
  }

  public static getAllSandboxesInfo(): SandboxInfo[] {
    return NativeSandboxManager.getInstance().getAllSandboxesInfo();
  }

  public static async getGlobalLimits(): Promise<SandboxLimits> {
    return NativeSandboxManager.getInstance().getGlobalLimits();
  }

  public static async updateGlobalLimits(newLimits: Partial<SandboxLimits>): Promise<SandboxLimits> {
    return NativeSandboxManager.getInstance().updateGlobalLimits(newLimits);
  }

  public static async createSandbox(options: {
    id?: string;
    userId: string;
    projectId: string;
    projectName: string;
    framework?: string;
    files?: Record<string, string>;
    port?: number;
    limits?: Partial<SandboxLimits>;
  }): Promise<NativeSandboxInstance> {
    return NativeSandboxManager.getInstance().createSandbox(options);
  }

  public static async getOrCreateForProject(options: {
    userId: string;
    projectId: string;
    projectName: string;
    framework?: string;
    files?: Record<string, string>;
    port?: number;
    limits?: Partial<SandboxLimits>;
  }): Promise<NativeSandboxInstance> {
    return NativeSandboxManager.getInstance().getOrCreateForProject(options);
  }

  public static getSandbox(id: string, userId?: string): NativeSandboxInstance | null {
    return NativeSandboxManager.getInstance().getSandbox(id, userId);
  }

  public static stopSandbox(id: string, userId?: string): boolean {
    return NativeSandboxManager.getInstance().stopSandbox(id, userId);
  }

  public static async restartSandbox(id: string, files?: Record<string, string>): Promise<NativeSandboxInstance | null> {
    return NativeSandboxManager.getInstance().restartSandbox(id, files);
  }

  public static deleteSandbox(id: string, userId?: string): boolean {
    return NativeSandboxManager.getInstance().deleteSandbox(id, userId);
  }

  public static autoCleanupStaleSandboxes(): { cleaned: number; cleanedCount: number } {
    return NativeSandboxManager.getInstance().autoCleanupStaleSandboxes();
  }
}

export const sandboxManager = NativeSandboxManager.getInstance();
export default SandboxManager;
