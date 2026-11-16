/**
 * SoufTools Database Maintenance & Health Optimization Engine (Turso / libSQL)
 * Handles automated retention policies, expired session cleanup, stale log pruning,
 * sandbox cleanup, storage quota reconciliation, and Turso telemetry statistics.
 */

import { getReadyDb, getTursoConfig } from "./index";
import * as schema from "./schema";
import { lt, sql } from "drizzle-orm";

export interface DatabaseHealthStats {
  engine: "turso_cloud" | "turso_local";
  status: "healthy" | "degraded" | "error";
  tableCounts: {
    users: number;
    sessions: number;
    conversations: number;
    messages: number;
    memories: number;
    objects: number;
    auditLogs: number;
    wafLogs: number;
    workerJobs: number;
    checkpoints: number;
  };
  lastMaintenanceRun?: string;
  uptimeSeconds: number;
}

function extractAffectedCount(res: any): number {
  if (!res) return 0;
  return Number(res.rowsAffected ?? res.rowCount ?? res.changes ?? 0);
}

export const DatabaseMaintenanceService = {
  /**
   * Purge expired user sessions
   */
  async cleanExpiredSessions(): Promise<number> {
    try {
      const database = await getReadyDb();
      const now = new Date();
      const res = await database.delete(schema.userSessions).where(lt(schema.userSessions.expiresAt, now));
      return extractAffectedCount(res);
    } catch (err) {
      console.warn("[DatabaseMaintenance] cleanExpiredSessions error:", err);
      return 0;
    }
  },

  /**
   * Purge expired verification tokens
   */
  async cleanExpiredVerifications(): Promise<number> {
    try {
      const database = await getReadyDb();
      const now = new Date();
      const res = await database.delete(schema.verifications).where(lt(schema.verifications.expiresAt, now));
      return extractAffectedCount(res);
    } catch (err) {
      console.warn("[DatabaseMaintenance] cleanExpiredVerifications error:", err);
      return 0;
    }
  },

  /**
   * Purge audit logs older than retentionDays (default 90 days)
   */
  async cleanStaleAuditLogs(retentionDays = 90): Promise<number> {
    try {
      const database = await getReadyDb();
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const res = await database.delete(schema.adminLogs).where(lt(schema.adminLogs.createdAt, cutoffDate));
      return extractAffectedCount(res);
    } catch (err) {
      console.warn("[DatabaseMaintenance] cleanStaleAuditLogs error:", err);
      return 0;
    }
  },

  /**
   * Purge WAF / security event logs older than retentionDays (default 30 days)
   */
  async cleanStaleWafLogs(retentionDays = 30): Promise<number> {
    try {
      const database = await getReadyDb();
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const res = await database
        .delete(schema.analyticsSecurityEvents)
        .where(lt(schema.analyticsSecurityEvents.createdAt, cutoffDate));
      return extractAffectedCount(res);
    } catch (err) {
      console.warn("[DatabaseMaintenance] cleanStaleWafLogs error:", err);
      return 0;
    }
  },

  /**
   * Purge expired runtime sandbox sessions
   */
  async cleanStaleSandboxes(retentionDays = 7): Promise<number> {
    try {
      const database = await getReadyDb();
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const res = await database
        .delete(schema.runtimeSessions)
        .where(lt(schema.runtimeSessions.expiresAt, cutoffDate));
      return extractAffectedCount(res);
    } catch (err) {
      console.warn("[DatabaseMaintenance] cleanStaleSandboxes error:", err);
      return 0;
    }
  },

  /**
   * Run complete full maintenance cycle
   */
  async runFullMaintenance(): Promise<{
    expiredSessionsCleaned: number;
    expiredVerificationsCleaned: number;
    staleAuditLogsCleaned: number;
    staleWafLogsCleaned: number;
    staleSandboxesCleaned: number;
    completedAt: string;
  }> {
    const [
      expiredSessionsCleaned,
      expiredVerificationsCleaned,
      staleAuditLogsCleaned,
      staleWafLogsCleaned,
      staleSandboxesCleaned,
    ] = await Promise.all([
      this.cleanExpiredSessions(),
      this.cleanExpiredVerifications(),
      this.cleanStaleAuditLogs(90),
      this.cleanStaleWafLogs(30),
      this.cleanStaleSandboxes(7),
    ]);

    return {
      expiredSessionsCleaned,
      expiredVerificationsCleaned,
      staleAuditLogsCleaned,
      staleWafLogsCleaned,
      staleSandboxesCleaned,
      completedAt: new Date().toISOString(),
    };
  },

  /**
   * Get detailed database health statistics & table row counts
   */
  async getDatabaseHealthStats(): Promise<DatabaseHealthStats> {
    let engine: DatabaseHealthStats["engine"] = "turso_cloud";
    try {
      const cfg = getTursoConfig();
      engine = cfg.isRemote ? "turso_cloud" : "turso_local";
    } catch {}

    try {
      const database = await getReadyDb();
      const [
        usersCount,
        sessionsCount,
        conversationsCount,
        messagesCount,
        memoriesCount,
        objectsCount,
        auditCount,
        wafCount,
        workerJobsCount,
        checkpointsCount,
      ] = await Promise.all([
        database.select({ count: sql<number>`count(*)` }).from(schema.users).then((r) => Number(r[0]?.count || 0)).catch(() => 0),
        database.select({ count: sql<number>`count(*)` }).from(schema.userSessions).then((r) => Number(r[0]?.count || 0)).catch(() => 0),
        database.select({ count: sql<number>`count(*)` }).from(schema.conversations).then((r) => Number(r[0]?.count || 0)).catch(() => 0),
        database.select({ count: sql<number>`count(*)` }).from(schema.messages).then((r) => Number(r[0]?.count || 0)).catch(() => 0),
        database.select({ count: sql<number>`count(*)` }).from(schema.memories).then((r) => Number(r[0]?.count || 0)).catch(() => 0),
        database.select({ count: sql<number>`count(*)` }).from(schema.storageObjects).then((r) => Number(r[0]?.count || 0)).catch(() => 0),
        database.select({ count: sql<number>`count(*)` }).from(schema.adminLogs).then((r) => Number(r[0]?.count || 0)).catch(() => 0),
        database.select({ count: sql<number>`count(*)` }).from(schema.analyticsSecurityEvents).then((r) => Number(r[0]?.count || 0)).catch(() => 0),
        database.select({ count: sql<number>`count(*)` }).from(schema.workerJobs).then((r) => Number(r[0]?.count || 0)).catch(() => 0),
        database.select({ count: sql<number>`count(*)` }).from(schema.agentCheckpoints).then((r) => Number(r[0]?.count || 0)).catch(() => 0),
      ]);

      return {
        engine,
        status: "healthy",
        tableCounts: {
          users: usersCount,
          sessions: sessionsCount,
          conversations: conversationsCount,
          messages: messagesCount,
          memories: memoriesCount,
          objects: objectsCount,
          auditLogs: auditCount,
          wafLogs: wafCount,
          workerJobs: workerJobsCount,
          checkpoints: checkpointsCount,
        },
        uptimeSeconds: Math.floor(process.uptime()),
      };
    } catch (err) {
      console.error("[DatabaseMaintenance] getDatabaseHealthStats error:", err);
      return {
        engine,
        status: "degraded",
        tableCounts: {
          users: 0,
          sessions: 0,
          conversations: 0,
          messages: 0,
          memories: 0,
          objects: 0,
          auditLogs: 0,
          wafLogs: 0,
          workerJobs: 0,
          checkpoints: 0,
        },
        uptimeSeconds: Math.floor(process.uptime()),
      };
    }
  },
};
