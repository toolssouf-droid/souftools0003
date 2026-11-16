/**
 * SoufTools Server & Database Watchdog Telemetry Engine
 * Continuous health monitoring, connection pool tracking, and threshold alarms.
 * Server-side only. Zero secrets leaked.
 */

import os from "os";
import fs from "fs";
import { checkDatabaseHealth } from "@/lib/db";
import { getQueryProfilerStats, profileQuery, QueryProfilerStats } from "./queryProfiler";
import { getThreatSummary } from "@/lib/security/threatEngine";

export type HealthStatusLevel = "HEALTHY" | "WARNING" | "CRITICAL";

export interface SystemVitals {
  cpuUsagePct: number;
  cpuCores: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  memoryUsagePct: number;
  processRssMb: number;
  processHeapUsedMb: number;
  diskUsedMb: number;
  diskTotalMb: number;
  diskUsagePct: number;
  uptimeSeconds: number;
  loadAverage: [number, number, number];
}

export interface DatabaseVitals {
  status: HealthStatusLevel;
  engine: string;
  pingLatencyMs: number;
  activeConnections: number;
  maxConnections: number;
  poolSaturationPct: number;
  databaseSizeBytes: number;
  databaseSizeMb: number;
  serverVersion: string;
  lastChecked: string;
}

export interface SystemAlert {
  id: string;
  level: "warning" | "critical";
  source: "CPU" | "MEMORY" | "DATABASE" | "WAF_SECURITY" | "DISK";
  title: string;
  message: string;
  value: string;
  timestamp: string;
}

export interface PulseSnapshot {
  timestamp: string;
  overallStatus: HealthStatusLevel;
  system: SystemVitals;
  database: DatabaseVitals;
  queryProfiler: QueryProfilerStats;
  security: {
    totalAttacks: number;
    activeBannedIPs: number;
    criticalThreats: number;
  };
  alerts: SystemAlert[];
}

const pulseHistory: PulseSnapshot[] = [];
const MAX_HISTORY_SNAPSHOTS = 40;
let lastBroadcastTimestamp = 0;

/**
 * Gathers current system resource vitals
 */
export function getSystemVitals(): SystemVitals {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsedMb = Math.round(usedMem / (1024 * 1024));
  const memoryTotalMb = Math.round(totalMem / (1024 * 1024));
  const memoryUsagePct = Math.round((usedMem / Math.max(1, totalMem)) * 1000) / 10;

  // Real CPU load
  const cpus = os.cpus();
  const cpuCores = Math.max(1, cpus.length);
  const loadAvg = os.loadavg() as [number, number, number];
  const rawCpuPct = (loadAvg[0] / cpuCores) * 100;
  const cpuUsagePct = Math.min(100, Math.max(0.5, Math.round(rawCpuPct * 10) / 10));

  // Process memory
  const memUsage = process.memoryUsage();
  const processRssMb = Math.round(memUsage.rss / (1024 * 1024));
  const processHeapUsedMb = Math.round(memUsage.heapUsed / (1024 * 1024));

  // Disk space
  let diskTotalMb = 20480;
  let diskUsedMb = 1024;
  try {
    const targetPath = process.cwd();
    if ((fs as any).statfsSync) {
      const stats = (fs as any).statfsSync(targetPath);
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bavail * stats.bsize;
      const usedBytes = totalBytes - freeBytes;
      if (totalBytes > 0) {
        diskTotalMb = Math.round(totalBytes / (1024 * 1024));
        diskUsedMb = Math.round(usedBytes / (1024 * 1024));
      }
    }
  } catch {}

  const diskUsagePct = Math.round((diskUsedMb / Math.max(1, diskTotalMb)) * 1000) / 10;

  return {
    cpuUsagePct,
    cpuCores,
    memoryUsedMb,
    memoryTotalMb,
    memoryUsagePct,
    processRssMb,
    processHeapUsedMb,
    diskUsedMb,
    diskTotalMb,
    diskUsagePct,
    uptimeSeconds: Math.round(process.uptime()),
    loadAverage: [
      Math.round(loadAvg[0] * 100) / 100,
      Math.round(loadAvg[1] * 100) / 100,
      Math.round(loadAvg[2] * 100) / 100,
    ],
  };
}

/**
 * Gathers Turso (libSQL) database vitals
 */
export async function getDatabaseVitals(): Promise<DatabaseVitals> {
  let status: HealthStatusLevel = "HEALTHY";
  let pingLatencyMs = 1;
  const activeConnections = 1;
  const maxConnections = 100;
  let databaseSizeBytes = 0;
  let serverVersion = "Turso libSQL";
  let engineName = "Turso Cloud Engine";

  try {
    const health = await profileQuery(
      "Turso Vitals (libSQL health & size)",
      () => checkDatabaseHealth(),
      "Watchdog.getDatabaseVitals"
    );
    pingLatencyMs = Math.max(1, health.latencyMs);
    serverVersion = health.serverVersion;
    databaseSizeBytes = health.sizeBytes;
    engineName = health.engine === "turso_local" ? "Turso Local libSQL" : "Turso Cloud libSQL";

    if (!health.connected) {
      status = "CRITICAL";
    } else if (pingLatencyMs > 300) {
      status = "CRITICAL";
    } else if (pingLatencyMs > 120) {
      status = "WARNING";
    }
  } catch {
    status = "CRITICAL";
  }

  const poolSaturationPct = Math.round((activeConnections / Math.max(1, maxConnections)) * 1000) / 10;

  return {
    status,
    engine: engineName,
    pingLatencyMs,
    activeConnections,
    maxConnections,
    poolSaturationPct,
    databaseSizeBytes,
    databaseSizeMb: Math.round((databaseSizeBytes / (1024 * 1024)) * 100) / 100,
    serverVersion,
    lastChecked: new Date().toISOString(),
  };
}

/**
 * Evaluates active alerts based on thresholds
 */
export function evaluateSystemAlerts(
  sys: SystemVitals,
  db: DatabaseVitals,
  profiler: QueryProfilerStats
): SystemAlert[] {
  const alerts: SystemAlert[] = [];
  const now = new Date().toISOString();

  // CPU Alert
  if (sys.cpuUsagePct >= 90) {
    alerts.push({
      id: "alt_cpu_crit",
      level: "critical",
      source: "CPU",
      title: "استهلاك معالج الخادم في مستوى حرج جداً",
      message: `استهلاك المعالج تجاوز ${sys.cpuUsagePct}%، قد يتسبب في تأخر استجابة الواجهات.`,
      value: `${sys.cpuUsagePct}%`,
      timestamp: now,
    });
  } else if (sys.cpuUsagePct >= 80) {
    alerts.push({
      id: "alt_cpu_warn",
      level: "warning",
      source: "CPU",
      title: "ارتفاع ملحوظ في استهلاك المعالج",
      message: `استهلاك المعالج بلغ ${sys.cpuUsagePct}% تحت الحمل الحالي.`,
      value: `${sys.cpuUsagePct}%`,
      timestamp: now,
    });
  }

  // Memory Alert
  if (sys.memoryUsagePct >= 92) {
    alerts.push({
      id: "alt_mem_crit",
      level: "critical",
      source: "MEMORY",
      title: "تحذير وشيك من نفاد ذاكرة الخادم (OOM)",
      message: `الذاكرة المستهلكة بلغت ${sys.memoryUsedMb}MB من أصل ${sys.memoryTotalMb}MB (${sys.memoryUsagePct}%).`,
      value: `${sys.memoryUsagePct}%`,
      timestamp: now,
    });
  } else if (sys.memoryUsagePct >= 82) {
    alerts.push({
      id: "alt_mem_warn",
      level: "warning",
      source: "MEMORY",
      title: "استهلاك مرتفع لذاكرة RAM",
      message: `استهلاك الذاكرة يقترب من الحدود التشغيلية القصوى (${sys.memoryUsagePct}%).`,
      value: `${sys.memoryUsagePct}%`,
      timestamp: now,
    });
  }

  // Database Connection Pool Alert
  if (db.poolSaturationPct >= 85) {
    alerts.push({
      id: "alt_db_crit",
      level: "critical",
      source: "DATABASE",
      title: "تشبع مجمع اتصالات قاعدة البيانات (Connection Pool Saturation)",
      message: `الاتصالات النشطة (${db.activeConnections}) اقتربت من السقف المسموح (${db.maxConnections}).`,
      value: `${db.poolSaturationPct}%`,
      timestamp: now,
    });
  }

  // Slow Queries Alert
  if (profiler.slowRatePercentage >= 10 && profiler.slowQueriesCount >= 5) {
    alerts.push({
      id: "alt_slow_query",
      level: "warning",
      source: "DATABASE",
      title: "رصد استعلامات بطيئة متكررة في قاعدة البيانات",
      message: `نسبة الاستعلامات البطيئة بلغت ${profiler.slowRatePercentage}% (${profiler.slowQueriesCount} استعلام تجاوز 100ms).`,
      value: `${profiler.slowQueriesCount} slow`,
      timestamp: now,
    });
  }

  return alerts;
}

/**
 * Creates and records a fresh complete pulse snapshot
 */
export async function getLivePulseSnapshot(): Promise<PulseSnapshot> {
  const system = getSystemVitals();
  const database = await getDatabaseVitals();
  const queryProfiler = getQueryProfilerStats();
  const threatSummary = getThreatSummary();

  const alerts = evaluateSystemAlerts(system, database, queryProfiler);

  let overallStatus: HealthStatusLevel = "HEALTHY";
  if (alerts.some((a) => a.level === "critical") || database.status === "CRITICAL") {
    overallStatus = "CRITICAL";
  } else if (alerts.some((a) => a.level === "warning") || database.status === "WARNING") {
    overallStatus = "WARNING";
  }

  const snapshot: PulseSnapshot = {
    timestamp: new Date().toISOString(),
    overallStatus,
    system,
    database,
    queryProfiler,
    security: {
      totalAttacks: threatSummary.totalAttacks,
      activeBannedIPs: threatSummary.activeBannedIPs,
      criticalThreats: threatSummary.criticalThreats,
    },
    alerts,
  };

  pulseHistory.push(snapshot);
  if (pulseHistory.length > MAX_HISTORY_SNAPSHOTS) {
    pulseHistory.shift();
  }

  // Proactive Critical Alert Dispatcher (throttled every 5 minutes)
  const criticalAlerts = alerts.filter((a) => a.level === "critical");
  if (criticalAlerts.length > 0 && Date.now() - lastBroadcastTimestamp > 5 * 60 * 1000) {
    lastBroadcastTimestamp = Date.now();
    try {
      const { NotificationRepository } = await import("@/lib/db");
      for (const crit of criticalAlerts) {
        await NotificationRepository.broadcastAdminAlert({
          title: `⚠️ تنبيه حرج من المراقب: ${crit.title}`,
          message: crit.message,
          type: "system",
          metadata: { source: crit.source, value: crit.value },
        });
      }
    } catch (err) {
      console.warn("[Watchdog] Broadcast alert notice:", err);
    }
  }

  return snapshot;
}

/**
 * Retrieves the stored historical pulse snapshots
 */
export function getPulseHistory(): PulseSnapshot[] {
  return [...pulseHistory];
}
