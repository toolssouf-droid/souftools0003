/**
 * SoufAI Runtime Manager - Session & Lifecycle Manager
 * Handles sandbox session tracking, idle timeouts, snapshots, and automatic resource cleanups.
 */

import { SandboxSession, SandboxCreateOptions, SandboxExecutionResponse, SandboxStatus } from "./types";
import {
  saveSandboxSession,
  getSandboxSession,
  getAllActiveSandboxSessions,
  getRuntimeSettings,
  addRuntimeLog,
} from "./runtimeDatabaseServices";
import { SmartRuntimeRouter } from "./smartRouter";

export class RuntimeSessionManager {
  /**
   * Re-uses existing active session or spins up a new optimized sandbox
   */
  public static async getOrCreateSession(
    options: SandboxCreateOptions
  ): Promise<SandboxExecutionResponse & { session?: SandboxSession }> {
    const existingSessions = await getAllActiveSandboxSessions();
    const activeForProject = existingSessions.find(
      (s) =>
        s.projectId === options.projectId &&
        s.userId === options.userId &&
        (s.status === "active" || s.status === "idle")
    );

    // Reuse session if active and less than 15 mins old
    if (activeForProject) {
      const now = Date.now();
      const isIdle = now - activeForProject.lastActivity > 10 * 60 * 1000;

      // Update activity & snapshot
      activeForProject.lastActivity = now;
      activeForProject.status = "active";
      activeForProject.savedFilesSnapshot = options.files;
      await saveSandboxSession(activeForProject);

      return {
        success: true,
        sessionId: activeForProject.sessionId,
        previewUrl: activeForProject.previewUrl,
        status: "active",
        provider: activeForProject.provider,
        message: "تم إعادة الاتصال بجلسة Sandbox الحالية للمشروع بنجاح",
        resources: activeForProject.resources,
        session: activeForProject,
      };
    }

    // Otherwise create brand new sandbox via smart router
    const result = await SmartRuntimeRouter.createSandbox(options);

    if (result.success && result.sessionId) {
      const newSession: SandboxSession = {
        sessionId: result.sessionId,
        userId: options.userId,
        projectId: options.projectId,
        projectName: options.projectName,
        framework: options.framework,
        provider: result.provider,
        status: "active",
        previewUrl: result.previewUrl,
        port: options.port || 3000,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        resources: result.resources || {
          cpu: "1 Core",
          memory: "500 MB",
          disk: "2 GB",
          activeTimeSeconds: 0,
        },
        savedFilesSnapshot: options.files,
      };

      await saveSandboxSession(newSession);

      return {
        ...result,
        session: newSession,
      };
    }

    return result;
  }

  /**
   * Updates heartbeat / activity timestamp to prevent premature idle stoppage
   */
  public static async touchSession(sessionId: string): Promise<void> {
    try {
      const session = await getSandboxSession(sessionId);
      if (session && session.status !== "stopped") {
        session.lastActivity = Date.now();
        if (session.status === "idle") {
          session.status = "active";
        }
        await saveSandboxSession(session);
      }
    } catch (err) {
      // Quietly ignore touch error
    }
  }

  /**
   * Manually stops a sandbox, saving its final state
   */
  public static async stopSession(
    sessionId: string,
    finalFilesSnapshot?: Record<string, string>
  ): Promise<{ success: boolean; message: string }> {
    const session = await getSandboxSession(sessionId);
    if (!session) {
      return { success: false, message: "الجلسة غير موجودة" };
    }

    // Save final files snapshot in Firestore before stopping
    if (finalFilesSnapshot) {
      session.savedFilesSnapshot = finalFilesSnapshot;
    }
    session.status = "stopping";
    await saveSandboxSession(session);

    // Stop on provider
    const res = await SmartRuntimeRouter.stopSandbox(sessionId, session.provider);

    session.status = "stopped";
    session.lastActivity = Date.now();
    await saveSandboxSession(session);

    return res;
  }

  /**
   * Automatic Cleanup Engine: Finds and shuts down idle sandboxes (15-20 min timeout)
   */
  public static async runAutoCleanup(): Promise<{
    scanned: number;
    stoppedCount: number;
    stoppedSessionIds: string[];
  }> {
    const settings = await getRuntimeSettings();
    const timeoutMs = (settings.autoCleanupMinutes || 15) * 60 * 1000;
    const now = Date.now();

    const activeSessions = await getAllActiveSandboxSessions();
    const candidates = activeSessions.filter(
      (s) => s.status === "active" || s.status === "idle"
    );

    const stoppedSessionIds: string[] = [];

    for (const session of candidates) {
      const idleTime = now - session.lastActivity;
      if (idleTime >= timeoutMs) {
        try {
          // 1. Snapshot already in savedFilesSnapshot
          // 2. Stop cloud resources
          await SmartRuntimeRouter.stopSandbox(session.sessionId, session.provider);

          // 3. Mark as stopped in Firestore
          session.status = "stopped";
          await saveSandboxSession(session);

          stoppedSessionIds.push(session.sessionId);

          await addRuntimeLog({
            event: "auto_cleanup",
            provider: session.provider,
            success: true,
            timestamp: now,
            sessionId: session.sessionId,
            userId: session.userId,
            details: `تم الإيقاف التلقائي وحفظ لقطة المشروع لجلسة خاملة (${Math.round(idleTime / 60000)} دقيقة خمول)`,
          });
        } catch (err: any) {
          console.warn(`Failed auto-cleanup for session ${session.sessionId}:`, err);
        }
      } else if (idleTime >= timeoutMs * 0.7 && session.status !== "idle") {
        // Mark as idle warning state
        session.status = "idle";
        await saveSandboxSession(session);
      }
    }

    return {
      scanned: candidates.length,
      stoppedCount: stoppedSessionIds.length,
      stoppedSessionIds,
    };
  }
}
