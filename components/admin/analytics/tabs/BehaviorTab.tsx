"use client";

import React from "react";
import {
  Compass,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  Users,
  Layers,
} from "lucide-react";
import { ProductBehaviorMetrics } from "@/lib/analytics/types";

interface BehaviorTabProps {
  data: ProductBehaviorMetrics | null;
  loading: boolean;
}

export const BehaviorTab: React.FC<BehaviorTabProps> = ({ data, loading }) => {
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
            <span>الاحتفاظ باليوم الأول (D1)</span>
            <Clock className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono">{data.retentionD1 ?? 0}%</h3>
          <span className="text-[11px] text-[#00ff88]">تفاعل طويل ومثمر</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>الاحتفاظ باليوم الـ 30 (D30)</span>
            <TrendingUp className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#38bdf8] font-mono">{data.retentionD30 ?? 0}%</h3>
          <span className="text-[11px] text-[#00ff88]">معدل ولاء ممتاز</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>متوسط الوقت لأول رسالة</span>
            <Clock className="w-4 h-4 text-[#a855f7]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#c084fc] font-mono">{data.avgTimeToFirstMessageSeconds ?? 0}s</h3>
          <span className="text-[11px] text-[#88b0b0]">سرعة استيعاب الواجهة</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>الميزات الأكثر تفاعلاً</span>
            <CheckCircle2 className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <h3 className="text-xl font-extrabold text-amber-400">SoufAI & Web Search</h3>
          <span className="text-[11px] text-[#88b0b0]">تبني متسارع للميزات</span>
        </div>
      </div>

      {/* User Conversion Funnel */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm font-bold text-[#e8f5f5]">مسار تحويل وتفاعل المستخدمين (Conversion Funnel)</h3>

        <div className="space-y-3">
          {(data.userJourney || []).map((step, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#e8f5f5] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#111a1a] border border-[#1e2e2e] flex items-center justify-center text-[10px] text-[#00d4aa]">
                    {step.step}
                  </span>
                  <span>{step.name}</span>
                </span>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-[#88b0b0]">{step.userCount.toLocaleString()} مستخدم</span>
                  <span className="font-bold text-[#00ff88]">{step.conversionRatePct}%</span>
                </div>
              </div>
              <div className="w-full bg-[#111a1a] h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] h-full rounded-full transition-all"
                  style={{ width: `${step.conversionRatePct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Most Visited Pages Table */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm font-bold text-[#e8f5f5]">الصفحات الأكثر زيارة واستخداماً</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-bold">
                <th className="pb-3 pr-2">عنوان الصفحة</th>
                <th className="pb-3">المسار</th>
                <th className="pb-3">المشاهدات</th>
                <th className="pb-3">الزوار الفريدون</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e2e]/60 font-mono">
              {(data.mostVisitedPages || []).map((p, i) => (
                <tr key={i} className="hover:bg-[#111a1a]/50 transition-colors">
                  <td className="py-3 pr-2 font-sans font-bold text-[#e8f5f5]">{p.title}</td>
                  <td className="py-3 text-[#00d4aa]">{p.path}</td>
                  <td className="py-3 text-[#38bdf8]">{p.views.toLocaleString()}</td>
                  <td className="py-3 text-[#00ff88]">{p.uniqueVisitors.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
