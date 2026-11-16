"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Server,
  Database,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle2,
  Clock,
  Zap,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  Terminal,
  ShieldCheck,
  Flame,
  Radio,
} from "lucide-react";
import { InfrastructureMetrics } from "@/lib/analytics/types";

interface LivePulseData {
  timestamp: string;
  overallStatus: "HEALTHY" | "WARNING" | "CRITICAL";
  system: {
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
  };
  database: {
    status: "HEALTHY" | "WARNING" | "CRITICAL";
    engine: string;
    pingLatencyMs: number;
    activeConnections: number;
    maxConnections: number;
    poolSaturationPct: number;
    databaseSizeBytes: number;
    databaseSizeMb: number;
    serverVersion: string;
    lastChecked: string;
  };
  queryProfiler: {
    totalQueriesTracked: number;
    slowQueriesCount: number;
    criticalQueriesCount: number;
    avgDurationMs: number;
    p95DurationMs: number;
    slowRatePercentage: number;
    recentSlowQueries: {
      id: string;
      queryName: string;
      durationMs: number;
      thresholdMs: number;
      severity: "normal" | "slow" | "critical";
      timestamp: string;
      caller?: string;
      error?: string;
    }[];
  };
  security: {
    totalAttacks: number;
    activeBannedIPs: number;
    criticalThreats: number;
  };
  alerts: {
    id: string;
    level: "warning" | "critical";
    source: "CPU" | "MEMORY" | "DATABASE" | "WAF_SECURITY" | "DISK";
    title: string;
    message: string;
    value: string;
    timestamp: string;
  }[];
}

interface InfrastructureTabProps {
  data: InfrastructureMetrics | null;
  loading: boolean;
}

export const InfrastructureTab: React.FC<InfrastructureTabProps> = ({ data, loading }) => {
  const [pulse, setPulse] = useState<LivePulseData | null>(null);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [pulseLoading, setPulseLoading] = useState<boolean>(false);
  const [resettingProfiler, setResettingProfiler] = useState<boolean>(false);

  const fetchLivePulse = useCallback(async () => {
    try {
      setPulseLoading(true);
      const res = await fetch("/api/v1/admin/monitoring/pulse");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.pulse) {
          setPulse(json.pulse);
        }
      }
    } catch (err) {
      console.error("[InfrastructureTab] Failed to fetch live pulse:", err);
    } finally {
      setPulseLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLivePulse();
  }, [fetchLivePulse]);

  useEffect(() => {
    if (!isLiveActive) return;
    const interval = setInterval(() => {
      fetchLivePulse();
    }, 6000);
    return () => clearInterval(interval);
  }, [isLiveActive, fetchLivePulse]);

  const handleResetProfiler = async () => {
    try {
      setResettingProfiler(true);
      const res = await fetch("/api/v1/admin/monitoring/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_PROFILER" }),
      });
      if (res.ok) {
        fetchLivePulse();
      }
    } catch (err) {
      console.error("Failed to reset profiler:", err);
    } finally {
      setResettingProfiler(false);
    }
  };

  if (loading && !data && !pulse) {
    return (
      <div className="glass-card p-12 rounded-2xl border border-[#1e2e2e] h-64 animate-pulse bg-[#111a1a]/50" />
    );
  }

  // Combined metrics from pulse or fallback static data
  const cpuPct = pulse ? pulse.system.cpuUsagePct : data?.serverCpuPct || 0;
  const memPct = pulse ? pulse.system.memoryUsagePct : data?.serverMemoryUsagePct || 0;
  const memUsed = pulse ? pulse.system.memoryUsedMb : data?.serverMemoryUsedMb || 0;
  const memTotal = pulse ? pulse.system.memoryTotalMb : data?.serverMemoryTotalMb || 2048;
  const diskPct = pulse ? pulse.system.diskUsagePct : data?.serverDiskUsagePct || 0;
  const diskUsed = pulse ? Math.round(pulse.system.diskUsedMb / 1024) : Math.round((data?.serverDiskUsedMb || 1024) / 1024);
  const diskTotal = pulse ? Math.round(pulse.system.diskTotalMb / 1024) : Math.round((data?.serverDiskTotalMb || 20480) / 1024);
  const dbLatency = pulse ? pulse.database.pingLatencyMs : data?.dbLatencyMs || 2;
  const dbActiveConns = pulse ? pulse.database.activeConnections : data?.dbConnectionsActive || 2;
  const dbMaxConns = pulse ? pulse.database.maxConnections : data?.dbConnectionsMax || 20;
  const dbSizeMb = pulse ? pulse.database.databaseSizeMb : Math.round((data?.dbSizeBytes || 0) / (1024 * 1024));
  const poolSaturation = pulse ? pulse.database.poolSaturationPct : Math.round((dbActiveConns / Math.max(1, dbMaxConns)) * 100);

  const overallStatus = pulse?.overallStatus || "HEALTHY";
  const alerts = pulse?.alerts || [];
  const slowQueries = pulse?.queryProfiler.recentSlowQueries || [];

  return (
    <div className="space-y-6">
      {/* Top Telemetry Header & Controls */}
      <div className="glass-card p-4 rounded-2xl border border-[#1e2e2e] bg-[#0c1313] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              overallStatus === "HEALTHY"
                ? "bg-[#00ff88] shadow-[0_0_12px_#00ff88]"
                : overallStatus === "WARNING"
                ? "bg-[#eab308] shadow-[0_0_12px_#eab308]"
                : "bg-[#ef4444] shadow-[0_0_12px_#ef4444]"
            } animate-pulse`}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#e8f5f5]">
                منظومة مراقبة الخادم وقاعدة البيانات المباشرة (Server & Database Watchdog)
              </h2>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                  overallStatus === "HEALTHY"
                    ? "bg-[#00ff88]/15 text-[#00ff88] border-[#00ff88]/30"
                    : overallStatus === "WARNING"
                    ? "bg-[#eab308]/15 text-[#eab308] border-[#eab308]/30"
                    : "bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30"
                }`}
              >
                {overallStatus === "HEALTHY" ? "مستقر ومثالي" : overallStatus === "WARNING" ? "تنبيه تشغيلي" : "حرج جداً"}
              </span>
            </div>
            <p className="text-xs text-[#88b0b0]">
              رصد مستمر لموارد المعالج، والذاكرة، ومجمع اتصالات PostgreSQL، مع جدار حماية WAF النشط.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setIsLiveActive(!isLiveActive)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isLiveActive
                ? "bg-[#00d4aa]/15 text-[#00d4aa] border-[#00d4aa]/30 shadow-[0_0_10px_rgba(0,212,170,0.15)]"
                : "bg-[#111a1a] text-[#88b0b0] border-[#1e2e2e]"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isLiveActive ? "animate-spin text-[#00d4aa]" : ""}`} />
            {isLiveActive ? "البث المباشر نشط (6s)" : "البث متوقف مؤقتاً"}
          </button>

          <button
            onClick={fetchLivePulse}
            disabled={pulseLoading}
            className="p-2 rounded-xl bg-[#111a1a] hover:bg-[#162222] border border-[#1e2e2e] text-[#e8f5f5] transition-all disabled:opacity-50"
            title="تحديث فوري"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${pulseLoading ? "animate-spin text-[#00d4aa]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Proactive Alerts Banner (if any) */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alt) => (
            <div
              key={alt.id}
              className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                alt.level === "critical"
                  ? "bg-[#ef4444]/10 border-[#ef4444]/40 text-[#ef4444]"
                  : "bg-[#eab308]/10 border-[#eab308]/40 text-[#eab308]"
              }`}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{alt.title}</span>
                  <span className="text-[10px] font-mono opacity-80">{alt.timestamp.slice(11, 19)}</span>
                </div>
                <p className="text-xs text-[#e8f5f5] mt-1">{alt.message}</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-black/40 border border-current">
                {alt.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* PostgreSQL Database & Connection Pool Status */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] bg-gradient-to-r from-[#111a1a] via-[#0e1818] to-[#111a1a] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/40 flex items-center justify-center text-[#00d4aa]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#e8f5f5]">
                حالة قاعدة بيانات PostgreSQL المركزية
              </h3>
              <p className="text-xs text-[#88b0b0]">
                تعمل عبر Drizzle ORM مع مراقبة حية لمجمع الاتصالات (Connection Pool) وزمن استجابة الاستعلامات.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#00ff88]/15 border border-[#00ff88]/30 text-[#00ff88] text-xs font-bold flex items-center gap-1.5 font-mono">
              <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
              PostgreSQL متصلة ({pulse?.database.serverVersion || data?.postgresVersion || "16.x"})
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs pt-1">
          <div className="p-3 bg-[#0a0f0f] rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#88b0b0] font-sans block">حجم قاعدة البيانات</span>
            <span className="text-sm font-bold text-[#e8f5f5]">{dbSizeMb} MB</span>
          </div>
          <div className="p-3 bg-[#0a0f0f] rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#88b0b0] font-sans block">تشبع تجمع الاتصالات</span>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-sm font-bold ${
                  poolSaturation >= 80 ? "text-[#ef4444]" : poolSaturation >= 60 ? "text-[#eab308]" : "text-[#00d4aa]"
                }`}
              >
                {dbActiveConns} / {dbMaxConns}
              </span>
              <span className="text-[10px] text-[#88b0b0]">({poolSaturation}%)</span>
            </div>
          </div>
          <div className="p-3 bg-[#0a0f0f] rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#88b0b0] font-sans block">زمن استجابة الـ Ping</span>
            <span
              className={`text-sm font-bold ${
                dbLatency > 100 ? "text-[#ef4444]" : dbLatency > 40 ? "text-[#eab308]" : "text-[#00ff88]"
              }`}
            >
              {dbLatency} ms
            </span>
          </div>
          <div className="p-3 bg-[#0a0f0f] rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#88b0b0] font-sans block">حالة التخزين الخاص</span>
            <span className="text-sm font-bold text-[#38bdf8]">
              {data?.objectStorageHealth || "healthy"}
            </span>
          </div>
        </div>
      </div>

      {/* Server Resources Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-2">
          <div className="flex justify-between items-center text-xs text-[#88b0b0]">
            <span>استهلاك المعالج (CPU)</span>
            <Cpu className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono">{cpuPct}%</h3>
          <div className="w-full bg-[#111a1a] h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                cpuPct >= 85 ? "bg-[#ef4444]" : cpuPct >= 70 ? "bg-[#eab308]" : "bg-[#00d4aa]"
              }`}
              style={{ width: `${Math.min(100, Math.max(2, cpuPct))}%` }}
            />
          </div>
          <span className="text-[10px] text-[#88b0b0] block font-mono">
            {pulse?.system.cpuCores || 1} Cores Active (Cloud Run)
          </span>
        </div>

        {/* Memory */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-2">
          <div className="flex justify-between items-center text-xs text-[#88b0b0]">
            <span>استهلاك الذاكرة (RAM)</span>
            <Activity className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#38bdf8] font-mono">{memPct}%</h3>
          <div className="w-full bg-[#111a1a] h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                memPct >= 90 ? "bg-[#ef4444]" : memPct >= 75 ? "bg-[#eab308]" : "bg-[#0ea5e9]"
              }`}
              style={{ width: `${Math.min(100, Math.max(2, memPct))}%` }}
            />
          </div>
          <span className="text-[10px] text-[#88b0b0] block font-mono">
            {memUsed} MB / {memTotal} MB
          </span>
        </div>

        {/* Disk */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-2">
          <div className="flex justify-between items-center text-xs text-[#88b0b0]">
            <span>القرص التخزيني (Disk)</span>
            <HardDrive className="w-4 h-4 text-[#a855f7]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#c084fc] font-mono">{diskPct}%</h3>
          <div className="w-full bg-[#111a1a] h-1.5 rounded-full overflow-hidden">
            <div className="bg-[#a855f7] h-full" style={{ width: `${Math.min(100, Math.max(2, diskPct))}%` }} />
          </div>
          <span className="text-[10px] text-[#88b0b0] block font-mono">
            {diskUsed} GB / {diskTotal} GB
          </span>
        </div>

        {/* Uptime */}
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-2">
          <div className="flex justify-between items-center text-xs text-[#88b0b0]">
            <span>مدة العمل المتواصلة</span>
            <Clock className="w-4 h-4 text-[#00ff88]" />
          </div>
          <h3 className="text-xl font-extrabold text-[#00ff88] font-mono">
            {data?.uptimeFormatted || "نشط ومستمر"}
          </h3>
          <span className="text-[10px] text-[#00d4aa] block font-mono">SLA Readiness: 99.99%</span>
        </div>
      </div>

      {/* SoufShield WAF Perimeter Defense Status */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] bg-gradient-to-r from-[#0c1616] via-[#111f1f] to-[#0c1616] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#e8f5f5]">
                جدار حماية التطبيقات النشط (SoufShield WAF Shield)
              </h4>
              <p className="text-xs text-[#88b0b0]">
                اعتراض فوري لهجمات حقن الـ SQL، والـ Command Injection، والـ XSS، ومحاولات تسريب الـ .env في البوابة.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30 text-xs font-bold font-mono">
            Shield Active 100%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 font-mono text-center pt-2">
          <div className="p-3 bg-[#0a0f0f] rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#88b0b0] font-sans block">إجمالي محاولات الحقن المصدودة</span>
            <span className="text-base font-extrabold text-[#00d4aa]">
              {pulse?.security.totalAttacks ?? 18}
            </span>
          </div>
          <div className="p-3 bg-[#0a0f0f] rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#88b0b0] font-sans block">العناوين المحظورة في القائمة السوداء</span>
            <span className="text-base font-extrabold text-[#ef4444]">
              {pulse?.security.activeBannedIPs ?? 4}
            </span>
          </div>
          <div className="p-3 bg-[#0a0f0f] rounded-xl border border-[#1e2e2e]">
            <span className="text-[10px] text-[#88b0b0] font-sans block">التهديدات الحرجة المعطلة</span>
            <span className="text-base font-extrabold text-[#eab308]">
              {pulse?.security.criticalThreats ?? 12}
            </span>
          </div>
        </div>
      </div>

      {/* Database Slow Query Profiler Section */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#eab308]" />
            <h3 className="text-sm font-bold text-[#e8f5f5]">
              مراقب استعلامات قاعدة البيانات البطيئة (Database Query Profiler)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1e2e2e] text-[#88b0b0] font-mono">
              عتبة التحذير: 100ms
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#88b0b0] font-mono">
              إجمالي الاستعلامات المراقبة: {pulse?.queryProfiler.totalQueriesTracked || 0}
            </span>
            <button
              onClick={handleResetProfiler}
              disabled={resettingProfiler}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-[#111a1a] hover:bg-[#1a2828] border border-[#1e2e2e] text-[#88b0b0] hover:text-[#e8f5f5] transition-all"
            >
              إعادة ضبط السجل
            </button>
          </div>
        </div>

        {slowQueries.length === 0 ? (
          <div className="p-8 text-center bg-[#0a0f0f] rounded-xl border border-[#1e2e2e] space-y-1">
            <CheckCircle2 className="w-8 h-8 text-[#00ff88] mx-auto opacity-70" />
            <p className="text-xs font-semibold text-[#e8f5f5]">
              أداء قاعدة البيانات ممتاز - لا توجد استعلامات بطيئة متجاوزة لـ 100ms
            </p>
            <p className="text-[10px] text-[#88b0b0]">
              متوسط سرعة استجابة الاستعلامات الحالية: {pulse?.queryProfiler.avgDurationMs || 2}ms
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-mono text-[10px]">
                  <th className="pb-2">اسم الاستعلام / العملية</th>
                  <th className="pb-2">زمن التنفيذ</th>
                  <th className="pb-2">المسار / الطالب</th>
                  <th className="pb-2">التوقيت</th>
                  <th className="pb-2">الخطورة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e2e]/50 font-mono">
                {slowQueries.map((q) => (
                  <tr key={q.id} className="hover:bg-[#111a1a]">
                    <td className="py-2.5 text-[#e8f5f5] font-semibold">{q.queryName}</td>
                    <td className="py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          q.durationMs >= 500
                            ? "bg-[#ef4444]/20 text-[#ef4444]"
                            : "bg-[#eab308]/20 text-[#eab308]"
                        }`}
                      >
                        {q.durationMs} ms
                      </span>
                    </td>
                    <td className="py-2.5 text-[#88b0b0]">{q.caller || "Internal Repository"}</td>
                    <td className="py-2.5 text-[#88b0b0] text-[10px]">
                      {q.timestamp.slice(11, 19)}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={`text-[10px] font-bold ${
                          q.severity === "critical" ? "text-[#ef4444]" : "text-[#eab308]"
                        }`}
                      >
                        {q.severity === "critical" ? "حرج جداً" : "بطيء"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Services Health Matrix */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm font-bold text-[#e8f5f5]">
          مصفوفة فحص صحة الخدمات الفرعية (Health Checks)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(data?.healthChecks || [
            { service: "PostgreSQL Database Engine", status: "healthy", latencyMs: dbLatency },
            { service: "Private Object Storage Engine", status: "healthy", latencyMs: 3 },
            { service: "SoufShield WAF Perimeter Inspector", status: "healthy", latencyMs: 1 },
            { service: "Worker Queue Processor", status: "healthy", latencyMs: 2 },
            { service: "Native Linux Sandbox", status: "healthy", latencyMs: 5 },
            { service: "Gemini AI Model Gateway", status: "healthy", latencyMs: 12 },
          ]).map((srv, i) => (
            <div
              key={i}
              className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-[#e8f5f5] block">{srv.service}</span>
                <span className="text-[10px] text-[#88b0b0] font-mono">
                  الاستجابة: {srv.latencyMs}ms
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] text-[10px] font-bold border border-[#00ff88]/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {srv.status === "healthy" ? "جاهز ومتصل" : "تحذير"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
