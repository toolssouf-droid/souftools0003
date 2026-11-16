"use client";

import React, { useState, useEffect } from "react";
import { Activity, Users, Zap, Cpu, Database, Server, ShieldCheck, AlertCircle } from "lucide-react";
import { LiveSystemPulse } from "@/lib/analytics/types";

interface LiveMonitorBarProps {
  initialPulse?: LiveSystemPulse | null;
}

export const LiveMonitorBar: React.FC<LiveMonitorBarProps> = ({ initialPulse }) => {
  const [pulse, setPulse] = useState<LiveSystemPulse | null>(initialPulse || null);
  const [liveConnected, setLiveConnected] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchPulse = async () => {
      try {
        const res = await fetch("/api/v1/admin/analytics/live");
        if (res.ok && isMounted) {
          const json = await res.json();
          if (json.success && json.pulse) {
            setPulse(json.pulse);
            setLiveConnected(true);
          }
        }
      } catch (err) {
        if (isMounted) setLiveConnected(false);
      }
    };

    fetchPulse();
    const interval = setInterval(fetchPulse, 3000); // 3-second live heartbeat

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const p = pulse || {
    timestamp: new Date().toISOString(),
    onlineUsers: 1,
    requestsPerSec: 0,
    activeAgentTasks: 0,
    activeSandboxes: 0,
    serverCpuPct: 8,
    serverMemoryMb: 240,
    serverMemoryPct: 28,
    queueLength: 0,
    activeWorkers: 1,
    apiLatencyMs: 120,
    errorRatePct: 0,
    dbLatencyMs: 2,
    dbHealth: "healthy" as const,
  };

  return (
    <div className="glass-card p-2.5 sm:p-3 rounded-2xl border border-[#1e2e2e] bg-gradient-to-r from-[#111a1a] via-[#0d1414] to-[#111a1a] flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs w-full max-w-full overflow-hidden">
      {/* Live Badge */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${liveConnected ? "bg-[#00ff88]" : "bg-amber-400"} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 ${liveConnected ? "bg-[#00d4aa]" : "bg-amber-500"}`} />
        </span>
        <span className="font-extrabold text-[#e8f5f5] whitespace-nowrap text-[11px] sm:text-xs">
          المراقبة الحية:
        </span>
        <span className="px-1.5 py-0.5 rounded-md bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 text-[9px] sm:text-[10px] font-mono font-bold">
          {liveConnected ? "متصل لحظياً" : "إعادة الاتصال..."}
        </span>
      </div>

      {/* Real-time Metric Badges */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 font-mono text-[10px] sm:text-[11px]">
        {/* Online Users */}
        <div className="flex items-center gap-1.5 bg-[#0a0f0f] px-2 py-1 rounded-lg border border-[#1e2e2e]">
          <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#00d4aa] shrink-0" />
          <span className="text-[#88b0b0] font-sans">المتواجدون:</span>
          <span className="font-bold text-[#00ff88]">{p.onlineUsers}</span>
        </div>

        {/* Requests Per Second */}
        <div className="flex items-center gap-1.5 bg-[#0a0f0f] px-2 py-1 rounded-lg border border-[#1e2e2e]">
          <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0ea5e9] shrink-0" />
          <span className="text-[#88b0b0] font-sans">الطلبات:</span>
          <span className="font-bold text-[#38bdf8]">{p.requestsPerSec} req/s</span>
        </div>

        {/* Latency */}
        <div className="flex items-center gap-1.5 bg-[#0a0f0f] px-2 py-1 rounded-lg border border-[#1e2e2e]">
          <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#a855f7] shrink-0" />
          <span className="text-[#88b0b0] font-sans">الاستجابة:</span>
          <span className="font-bold text-[#c084fc]">{p.apiLatencyMs}ms</span>
        </div>

        {/* Server CPU & RAM */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#0a0f0f] px-2 py-1 rounded-lg border border-[#1e2e2e]">
          <Cpu className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#00d4aa] shrink-0" />
          <span className="text-[#88b0b0] font-sans">المعالج:</span>
          <span className="font-bold text-[#e8f5f5]">{p.serverCpuPct}%</span>
          <span className="text-[#4a7070]">|</span>
          <span className="text-[#88b0b0] font-sans">الذاكرة:</span>
          <span className="font-bold text-[#e8f5f5]">{p.serverMemoryPct}%</span>
        </div>

        {/* PostgreSQL Database Status */}
        <div className="flex items-center gap-1.5 bg-[#0a0f0f] px-2 py-1 rounded-lg border border-[#1e2e2e]">
          <Database className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#00ff88] shrink-0" />
          <span className="text-[#88b0b0] font-sans">قاعدة البيانات:</span>
          <span className="font-bold text-[#00ff88] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
            PostgreSQL ({p.dbLatencyMs}ms)
          </span>
        </div>
      </div>
    </div>
  );
};

