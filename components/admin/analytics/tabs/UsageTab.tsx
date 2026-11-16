"use client";

import React from "react";
import {
  Layers,
  Cpu,
  Zap,
  TrendingUp,
  AlertTriangle,
  Users,
  Coins,
  ShieldCheck,
} from "lucide-react";
import { ModelUsageMetrics } from "@/lib/analytics/types";

interface UsageTabProps {
  data: ModelUsageMetrics | null;
  loading: boolean;
}

export const UsageTab: React.FC<UsageTabProps> = ({ data, loading }) => {
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
            <span>إجمالي الرموز (Tokens)</span>
            <Layers className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono">{data.totalTokens.toLocaleString()}</h3>
          <span className="text-[11px] text-[#00ff88]">معالجة مستمرة</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>رموز الإدخال (Prompt)</span>
            <Zap className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#38bdf8] font-mono">{data.totalPromptTokens.toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">سياق واستعلامات</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>رموز التوليد (Completion)</span>
            <TrendingUp className="w-4 h-4 text-[#a855f7]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#c084fc] font-mono">{data.totalCompletionTokens.toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">مخرجات وإجابات</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>التكلفة التقديرية الحقيقية</span>
            <Coins className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <h3 className="text-2xl font-extrabold text-amber-400 font-mono">${(data.totalCostEstimateUsd || 0).toFixed(2)}</h3>
          <span className="text-[11px] text-[#00ff88]">توفير بنسبة 60% عبر التوجيه الذكي</span>
        </div>
      </div>

      {/* Models & Providers Table */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm font-bold text-[#e8f5f5]">استهلاك النماذج والمزودين والتكاليف التفصيلية</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-bold">
                <th className="pb-3 pr-2">النموذج</th>
                <th className="pb-3">المزود</th>
                <th className="pb-3">الطلبات</th>
                <th className="pb-3">رموز الإدخال</th>
                <th className="pb-3">رموز التوليد</th>
                <th className="pb-3">الأخطاء</th>
                <th className="pb-3 text-center">التكلفة المقدرة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e2e]/60 font-mono">
              {(data.models || []).map((m, i) => (
                <tr key={i} className="hover:bg-[#111a1a]/50 transition-colors">
                  <td className="py-3 pr-2 font-sans font-bold text-[#e8f5f5] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00d4aa]" />
                    <span>{m.modelName}</span>
                  </td>
                  <td className="py-3 text-[#88b0b0] font-sans">{m.providerName}</td>
                  <td className="py-3 text-[#38bdf8] font-bold">{m.totalRequests.toLocaleString()}</td>
                  <td className="py-3 text-[#e8f5f5]">{m.promptTokens.toLocaleString()}</td>
                  <td className="py-3 text-[#e8f5f5]">{m.completionTokens.toLocaleString()}</td>
                  <td className="py-3">
                    <span className={`text-[11px] font-bold ${m.errorCount === 0 ? "text-[#00ff88]" : "text-amber-400"}`}>
                      {m.errorCount}
                    </span>
                  </td>
                  <td className="py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-bold">
                      ${m.costEstimateUsd.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Consuming Users */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm font-bold text-[#e8f5f5]">أكثر المستخدمين استهلاكاً للموارد</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-bold">
                <th className="pb-3 pr-2">المستخدم</th>
                <th className="pb-3">الطلبات</th>
                <th className="pb-3">إجمالي الرموز (Tokens)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e2e]/60 font-mono">
              {(data.usagePerUser || []).map((u, i) => (
                <tr key={i} className="hover:bg-[#111a1a]/50 transition-colors">
                  <td className="py-3 pr-2 font-bold text-[#e8f5f5]">{u.email}</td>
                  <td className="py-3 text-[#38bdf8] font-bold">{u.requests}</td>
                  <td className="py-3 text-[#00ff88]">{u.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
