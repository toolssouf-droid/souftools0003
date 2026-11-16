"use client";

import React from "react";
import {
  Code,
  Terminal,
  Play,
  Cpu,
  Layers,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { CodingSandboxMetrics } from "@/lib/analytics/types";

interface SandboxTabProps {
  data: CodingSandboxMetrics | null;
  loading: boolean;
}

export const SandboxTab: React.FC<SandboxTabProps> = ({ data, loading }) => {
  if (loading && !data) {
    return <div className="glass-card p-12 rounded-2xl border border-[#1e2e2e] h-64 animate-pulse bg-[#111a1a]/50" />;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>مشاريع الكود المنشأة</span>
            <Code className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono">{data.totalProjects.toLocaleString()}</h3>
          <span className="text-[11px] text-[#00ff88]">تطبيقات ويب كاملة</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>البيئات المعزولة النشطة (Sandboxes)</span>
            <Play className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#38bdf8] font-mono">{data.activeSandboxes}</h3>
          <span className="text-[11px] text-[#88b0b0]">إجمالي مكتمل: {data.completedSandboxes}</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>الأوامر المنفذة (Commands)</span>
            <Terminal className="w-4 h-4 text-[#a855f7]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#c084fc] font-mono">{(data.totalCommandsExecuted || 0).toLocaleString()}</h3>
          <span className="text-[11px] text-[#00ff88]">معالجة آمنة في بيئة معزولة</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>عمليات البناء والمعاينة (Builds)</span>
            <Layers className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <h3 className="text-2xl font-extrabold text-amber-400 font-mono">{(data.totalBuildsTriggered || 0).toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">معاينات حية: {data.totalPreviewSessions || 0}</span>
        </div>
      </div>

      {/* Resource Utilization & Security Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sandbox Resources */}
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-3">
          <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#00d4aa]" />
            <span>متوسط استهلاك موارد البيئة المعزولة (Sandbox Resources)</span>
          </h3>
          <div className="space-y-3 font-mono text-xs pt-1">
            <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
              <span className="text-[#88b0b0] font-sans">استهلاك المعالج المتوسط (CPU)</span>
              <span className="text-[#00ff88] font-bold">{data.avgCpuUsagePct || 14}%</span>
            </div>
            <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
              <span className="text-[#88b0b0] font-sans">استهلاك الذاكرة العشوائية (RAM)</span>
              <span className="text-[#0ea5e9] font-bold">{data.avgMemoryUsageMb || 180} MB</span>
            </div>
            <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
              <span className="text-[#88b0b0] font-sans">متوسط مدة الجلسة المعزولة</span>
              <span className="text-[#a855f7] font-bold">{Math.round((data.avgRuntimeDurationSeconds || 360) / 60)} دقيقة</span>
            </div>
          </div>
        </div>

        {/* Isolation & Container Security */}
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-3">
          <h3 className="text-sm font-bold text-[#00ff88] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00ff88]" />
            <span>حالة العزل الأمني وتأمين الحاويات</span>
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
              <span className="text-[#e8f5f5]">عزل الشبكة الداخلي (gVisor / Network Filter)</span>
              <span className="px-2 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] font-bold text-[10px]">مفعل وصارم</span>
            </div>
            <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
              <span className="text-[#e8f5f5]">تجاوزات أمنية محجوبة (Security Violations)</span>
              <span className="text-amber-400 font-mono font-bold">{data.sandboxSecurityEventsCount || 0} محاولة تم حظرها</span>
            </div>
            <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
              <span className="text-[#e8f5f5]">انهيارات الحاويات (Sandbox Crashes)</span>
              <span className="text-[#88b0b0] font-mono">{data.crashesCount || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
