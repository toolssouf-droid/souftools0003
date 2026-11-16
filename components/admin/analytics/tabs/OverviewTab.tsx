"use client";

import React, { useState } from "react";
import {
  Users,
  MessageSquare,
  Bot,
  Wrench,
  Image as ImageIcon,
  Search,
  Zap,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  Clock,
  Layers,
  Cpu,
  BarChart3,
  Flame,
} from "lucide-react";
import { OverviewMetrics, MetricComparison } from "@/lib/analytics/types";

interface OverviewTabProps {
  data: OverviewMetrics | null;
  loading: boolean;
  comparePrevious: boolean;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ data, loading, comparePrevious }) => {
  const [activeSeries, setActiveSeries] = useState<"requests" | "messages" | "agentTasks" | "errors">("requests");

  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="glass-card p-5 rounded-2xl border border-[#1e2e2e] h-28 bg-[#111a1a]/50" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const renderComparisonBadge = (comp: MetricComparison) => {
    if (!comparePrevious) return null;
    const isPositive = comp.growthPct > 0;
    const isZero = comp.growthPct === 0;

    return (
      <div
        className={`flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-md font-mono ${
          isZero
            ? "bg-[#1e2e2e] text-[#88b0b0]"
            : isPositive
            ? "bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30"
            : "bg-red-500/15 text-red-400 border border-red-500/30"
        }`}
      >
        {isZero ? <Minus className="w-3 h-3" /> : isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        <span>{isPositive ? `+${comp.growthPct}%` : `${comp.growthPct}%`}</span>
      </div>
    );
  };

  const kpis = [
    { label: "إجمالي المستخدمين", comp: data.totalUsers, icon: Users, color: "#00d4aa" },
    { label: "المستخدمون النشطون", comp: data.activeUsers, icon: CheckCircle2, color: "#00ff88" },
    { label: "إجمالي المحادثات", comp: data.conversations, icon: MessageSquare, color: "#0ea5e9" },
    { label: "إجمالي الرسائل", comp: data.messages, icon: Activity, color: "#38bdf8" },
    { label: "مهام الوكيل الذكي (Nodaba)", comp: data.agentTasks, icon: Bot, color: "#a855f7" },
    { label: "استدعاءات الأدوات (Tools)", comp: data.toolCalls, icon: Wrench, color: "#f59e0b" },
    { label: "عمليات البحث في الويب", comp: data.webSearches, icon: Search, color: "#06b6d4" },
    { label: "توليد وتعديل الصور", comp: data.imageGenerations, icon: ImageIcon, color: "#ec4899" },
  ];

  const maxSeriesVal = Math.max(...data.activityTimeSeries.map((p) => p[activeSeries]), 1);

  return (
    <div className="space-y-6">
      {/* 8 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] hover:border-[#00d4aa]/40 transition-all space-y-2 relative overflow-hidden group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#88b0b0] font-medium">{kpi.label}</span>
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{
                    backgroundColor: `${kpi.color}15`,
                    border: `1px solid ${kpi.color}35`,
                    color: kpi.color,
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-2 pt-1">
                <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono tracking-tight">
                  {kpi.comp.current.toLocaleString()}
                </h3>
                {renderComparisonBadge(kpi.comp)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Activity Chart & Latency/Reliability Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Activity Chart (2 cols) */}
        <div className="lg:col-span-2 glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#00d4aa]" />
              <h3 className="text-sm font-bold text-[#e8f5f5]">
                منحنى النشاط الحقيقي عبر الزمن (Activity Volume)
              </h3>
            </div>

            {/* Series Filter Tabs */}
            <div className="flex items-center gap-1 bg-[#111a1a] p-1 rounded-xl border border-[#1e2e2e] text-[11px] font-bold">
              {[
                { id: "requests", label: "الطلبات" },
                { id: "messages", label: "الرسائل" },
                { id: "agentTasks", label: "المهام" },
                { id: "errors", label: "الأخطاء" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSeries(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    activeSeries === tab.id
                      ? "bg-[#00d4aa] text-[#0a0f0f] font-extrabold"
                      : "text-[#88b0b0] hover:text-[#e8f5f5]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Visual Bars */}
          <div className="pt-4 space-y-2">
            <div className="h-44 flex items-end gap-1.5 sm:gap-2 px-2 pt-4 border-b border-[#1e2e2e]/80">
              {data.activityTimeSeries.map((point, i) => {
                const val = point[activeSeries];
                const heightPct = Math.max(8, Math.round((val / maxSeriesVal) * 100));
                return (
                  <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="absolute -top-9 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[#111a1a] text-[#e8f5f5] text-[10px] font-mono px-2 py-1 rounded-md border border-[#1e2e2e] shadow-xl whitespace-nowrap z-20">
                      {point.label}: {val.toLocaleString()}
                    </div>
                    {/* Bar */}
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        activeSeries === "errors"
                          ? "bg-red-500/80 hover:bg-red-400"
                          : activeSeries === "agentTasks"
                          ? "bg-[#a855f7]/80 hover:bg-[#c084fc]"
                          : "bg-gradient-to-t from-[#00d4aa]/40 to-[#00d4aa] hover:to-[#00ff88]"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            {/* Timeline X-Labels */}
            <div className="flex justify-between text-[10px] text-[#4a7070] font-mono px-1">
              <span>{data.activityTimeSeries[0]?.label || "البداية"}</span>
              <span>
                {data.activityTimeSeries[Math.floor(data.activityTimeSeries.length / 2)]?.label || "المنتصف"}
              </span>
              <span>
                {data.activityTimeSeries[data.activityTimeSeries.length - 1]?.label || "الآن"}
              </span>
            </div>
          </div>

          {/* Hourly Stats Row */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t border-[#1e2e2e] text-xs font-mono">
            <div className="p-2 bg-[#111a1a] rounded-xl border border-[#1e2e2e]/50">
              <span className="text-[10px] text-[#4a7070] block font-sans">ذروة الطلبات/ساعة</span>
              <span className="text-sm font-bold text-[#00ff88]">{data.peakRequestsPerHour} req/h</span>
            </div>
            <div className="p-2 bg-[#111a1a] rounded-xl border border-[#1e2e2e]/50">
              <span className="text-[10px] text-[#4a7070] block font-sans">متوسط الطلبات/ساعة</span>
              <span className="text-sm font-bold text-[#0ea5e9]">{data.avgRequestsPerHour} req/h</span>
            </div>
            <div className="p-2 bg-[#111a1a] rounded-xl border border-[#1e2e2e]/50">
              <span className="text-[10px] text-[#4a7070] block font-sans">أدنى طلبات/ساعة</span>
              <span className="text-sm font-bold text-[#88b0b0]">{data.minRequestsPerHour} req/h</span>
            </div>
          </div>
        </div>

        {/* Latency & Quality Metrics (1 col) */}
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#00ff88]" />
              <h3 className="text-sm font-bold text-[#e8f5f5]">الأداء وزمن الاستجابة (SLA)</h3>
            </div>
            <p className="text-[11px] text-[#88b0b0]">
              قياسات دقيقة لزمن استجابة الخادم وسرعة النماذج عبر Drizzle ORM.
            </p>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {/* Avg Latency */}
            <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#88b0b0] font-sans block">متوسط زمن الاستجابة</span>
                <span className="text-base font-bold text-[#00d4aa]">{data.avgLatencyMs.current}ms</span>
              </div>
              <Activity className="w-5 h-5 text-[#00d4aa]" />
            </div>

            {/* P95 Latency */}
            <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#88b0b0] font-sans block">مستوى 95% (P95 Latency)</span>
                <span className="text-base font-bold text-[#a855f7]">{data.p95LatencyMs.current}ms</span>
              </div>
              <Cpu className="w-5 h-5 text-[#a855f7]" />
            </div>

            {/* Success Rate */}
            <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#88b0b0] font-sans block">معدل النجاح (Success Rate)</span>
                <span className="text-base font-bold text-[#00ff88]">{data.successRate.current}%</span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-[#00ff88]" />
            </div>

            {/* Tokens In/Out */}
            <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] space-y-1.5">
              <span className="text-[11px] text-[#88b0b0] font-sans block">إجمالي استهلاك الرموز (Tokens)</span>
              <div className="flex justify-between text-xs">
                <span className="text-[#38bdf8]">إدخال: {data.promptTokens.current.toLocaleString()}</span>
                <span className="text-[#00ff88]">توليد: {data.completionTokens.current.toLocaleString()}</span>
              </div>
              <div className="w-full bg-[#0a0f0f] h-2 rounded-full overflow-hidden flex">
                <div className="bg-[#38bdf8] h-full" style={{ width: "45%" }} />
                <div className="bg-[#00ff88] h-full" style={{ width: "55%" }} />
              </div>
            </div>
          </div>

          <div className="p-2.5 bg-[#00d4aa]/10 rounded-xl border border-[#00d4aa]/30 text-[11px] text-[#00d4aa] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>وقت تشغيل الخادم المستمر: {data.serverUptimeFormatted}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
