"use client";

import React, { useState } from "react";
import {
  Wrench,
  Search,
  BookOpen,
  Calculator,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
} from "lucide-react";
import { ToolsMetrics } from "@/lib/analytics/types";

interface ToolsTabProps {
  data: ToolsMetrics | null;
  loading: boolean;
}

export const ToolsTab: React.FC<ToolsTabProps> = ({ data, loading }) => {
  const [searchTerm, setSearchTerm] = useState("");

  if (loading && !data) {
    return <div className="glass-card p-12 rounded-2xl border border-[#1e2e2e] h-64 animate-pulse bg-[#111a1a]/50" />;
  }

  if (!data) return null;

  const filteredTools = data.tools.filter(
    (t) =>
      t.toolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.toolId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>إجمالي استدعاءات الأدوات</span>
            <Wrench className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono">{data.totalToolCalls.toLocaleString()}</h3>
          <span className="text-[11px] text-[#00ff88]">تكاملات حية نشطة</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>مستخدمون فريدون للأدوات</span>
            <TrendingUp className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#00d4aa] font-mono">{data.uniqueToolUsers.toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">استفادوا من الأدوات</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>معدل النجاح الإجمالي</span>
            <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#00ff88] font-mono">{data.overallSuccessRate}%</h3>
          <span className="text-[11px] text-[#88b0b0]">مع التبديل التلقائي الاحتياطي</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>متوسط زمن تنفيذ الأداة</span>
            <Zap className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#38bdf8] font-mono">{data.overallAvgLatencyMs}ms</h3>
          <span className="text-[11px] text-[#88b0b0]">استجابة متوازية سريعة</span>
        </div>
      </div>

      {/* Top vs Least Used Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-3">
          <h3 className="text-sm font-bold text-[#00ff88] flex items-center gap-2">
            <span>الأدوات الأكثر استخداماً (Top Tools)</span>
          </h3>
          <div className="space-y-2 text-xs">
            {data.topTools.map((t, i) => (
              <div key={i} className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
                <span className="font-bold text-[#e8f5f5]">{t.toolName}</span>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-[#88b0b0]">{t.requests} طلب</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] font-bold">{t.sharePct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-3">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <span>الأدوات الأقل استخداماً (Least Used)</span>
          </h3>
          <div className="space-y-2 text-xs">
            {data.leastUsedTools.map((t, i) => (
              <div key={i} className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
                <span className="font-bold text-[#e8f5f5]">{t.toolName}</span>
                <span className="font-mono text-[#88b0b0]">{t.requests} طلب</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Tool Table */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-[#e8f5f5]">جدول أداء جميع الأدوات والخدمات</h3>
            <p className="text-xs text-[#88b0b0]">معدلات الاستدعاء، المستخدمين الفريدين، والسرعة وزمن P95.</p>
          </div>
          <input
            type="text"
            placeholder="بحث في الأدوات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-1.5 bg-[#111a1a] text-xs text-[#e8f5f5] placeholder-[#4a7070] rounded-xl border border-[#1e2e2e] outline-none focus:border-[#00d4aa]"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-bold">
                <th className="pb-3 pr-2">اسم الأداة</th>
                <th className="pb-3">التصنيف</th>
                <th className="pb-3">الطلبات</th>
                <th className="pb-3">المستخدمون</th>
                <th className="pb-3">معدل النجاح</th>
                <th className="pb-3">متوسط السرعة</th>
                <th className="pb-3">P95 Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e2e]/60 font-mono">
              {filteredTools.map((t, i) => (
                <tr key={i} className="hover:bg-[#111a1a]/50 transition-colors">
                  <td className="py-3 pr-2 font-sans font-bold text-[#e8f5f5] flex items-center gap-2">
                    <Wrench className="w-3.5 h-3.5 text-[#00d4aa]" />
                    <span>{t.toolName}</span>
                  </td>
                  <td className="py-3 text-[#88b0b0] font-sans">{t.category}</td>
                  <td className="py-3 text-[#38bdf8] font-bold">{t.requests}</td>
                  <td className="py-3 text-[#e8f5f5]">{t.uniqueUsers}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      t.successRate >= 99 ? "bg-[#00ff88]/15 text-[#00ff88]" : "bg-amber-500/15 text-amber-400"
                    }`}>
                      {t.successRate}%
                    </span>
                  </td>
                  <td className="py-3 text-[#00d4aa]">{t.avgLatencyMs}ms</td>
                  <td className="py-3 text-[#a855f7]">{t.p95LatencyMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
