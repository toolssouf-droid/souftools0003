"use client";

import React from "react";
import {
  Bot,
  Cpu,
  Zap,
  Activity,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Search,
  Code,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { SoufAIMetrics } from "@/lib/analytics/types";

interface AiTabProps {
  data: SoufAIMetrics | null;
  loading: boolean;
}

export const AiTab: React.FC<AiTabProps> = ({ data, loading }) => {
  if (loading && !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="glass-card p-5 rounded-2xl border border-[#1e2e2e] h-24 bg-[#111a1a]/50" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* 4 AI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>إجمالي الرسائل المعالجة</span>
            <Bot className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono">{data.totalMessages.toLocaleString()}</h3>
          <span className="text-[11px] text-[#00ff88]">استجابات فورية بدون انقطاع</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>مهام الوكيل الذكي (Agent Tasks)</span>
            <Sparkles className="w-4 h-4 text-[#a855f7]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#c084fc] font-mono">{data.totalAgentTasks.toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">متوسط {data.avgStepsPerTask} خطوات لكل مهمة</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>إجمالي استدعاءات الأدوات</span>
            <Cpu className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#38bdf8] font-mono">{data.totalToolCalls.toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">بحث ويب، كود، حساب، قراءة</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>معدل النجاح (Success Rate)</span>
            <CheckCircle2 className="w-4 h-4 text-[#00ff88]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#00ff88] font-mono">{data.successRatePct}%</h3>
          <span className="text-[11px] text-[#00d4aa]">متوسط الاستجابة: {data.avgResponseTimeMs}ms</span>
        </div>
      </div>

      {/* Routing Distribution (Direct vs Tool vs Agent) */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[#e8f5f5]">توزيع التوجيه الذكي (Routing Architecture Distribution)</h3>
            <p className="text-xs text-[#88b0b0]">
              كيف يوجّه المحرك كل طلب: رد مباشر (DIRECT)، استدعاء أداة (TOOL)، أو مهمة وكيل متسلسلة (AGENT).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2 py-1 rounded bg-[#00d4aa]/15 text-[#00d4aa] font-bold">DIRECT: {data.routingDistribution.direct.percentage}%</span>
            <span className="px-2 py-1 rounded bg-[#0ea5e9]/15 text-[#0ea5e9] font-bold">TOOL: {data.routingDistribution.tool.percentage}%</span>
            <span className="px-2 py-1 rounded bg-[#a855f7]/15 text-[#a855f7] font-bold">AGENT: {data.routingDistribution.agent.percentage}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#111a1a] h-4 rounded-xl overflow-hidden flex p-0.5 border border-[#1e2e2e]">
          <div
            className="bg-[#00d4aa] h-full rounded-lg transition-all"
            style={{ width: `${data.routingDistribution.direct.percentage}%` }}
            title={`مباشر: ${data.routingDistribution.direct.count}`}
          />
          <div
            className="bg-[#0ea5e9] h-full rounded-lg transition-all mx-0.5"
            style={{ width: `${data.routingDistribution.tool.percentage}%` }}
            title={`أدوات: ${data.routingDistribution.tool.count}`}
          />
          <div
            className="bg-[#a855f7] h-full rounded-lg transition-all"
            style={{ width: `${data.routingDistribution.agent.percentage}%` }}
            title={`وكيل: ${data.routingDistribution.agent.count}`}
          />
        </div>

        {/* 3 Description Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e]">
            <span className="text-[#00d4aa] font-bold block mb-1">الرد المباشر (DIRECT)</span>
            <span className="text-[#88b0b0]">ردود محادثة فورية سريعة بدون استهلاك أدوات إضافية.</span>
          </div>
          <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e]">
            <span className="text-[#0ea5e9] font-bold block mb-1">استدعاء الأدوات (TOOL)</span>
            <span className="text-[#88b0b0]">تنفيذ بحث فوري في الويب أو تشغيل كود ثم الرد مباشرة.</span>
          </div>
          <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e]">
            <span className="text-[#a855f7] font-bold block mb-1">سلسلة الوكيل (AGENT)</span>
            <span className="text-[#88b0b0]">تخطيط، تفكير، وتعدد الخطوات لإنهاء مهمة مركبة.</span>
          </div>
        </div>
      </div>

      {/* Model Breakdown Table */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm font-bold text-[#e8f5f5]">استهلاك النماذج ومعدل السرعة (Models Breakdown)</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-bold">
                <th className="pb-3 pr-2">النموذج</th>
                <th className="pb-3">المزود</th>
                <th className="pb-3">الطلبات</th>
                <th className="pb-3">الرموز (Tokens)</th>
                <th className="pb-3">متوسط السرعة</th>
                <th className="pb-3 text-center">النسبة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e2e]/60 font-mono">
              {data.modelBreakdown.map((m, i) => (
                <tr key={i} className="hover:bg-[#111a1a]/50 transition-colors">
                  <td className="py-3 pr-2 font-sans font-bold text-[#e8f5f5] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00d4aa]" />
                    <span>{m.modelName}</span>
                  </td>
                  <td className="py-3 text-[#88b0b0] font-sans">{m.provider}</td>
                  <td className="py-3 text-[#38bdf8] font-bold">{m.requests.toLocaleString()}</td>
                  <td className="py-3 text-[#e8f5f5]">{(m.promptTokens + m.completionTokens).toLocaleString()}</td>
                  <td className="py-3 text-[#00ff88]">{m.avgLatencyMs}ms</td>
                  <td className="py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-[#00d4aa]/15 text-[#00d4aa] text-[11px] font-bold">
                      {m.percentage}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Most Used Capabilities & Error Taxonomy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Capabilities */}
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-3">
          <h3 className="text-sm font-bold text-[#e8f5f5]">أكثر القدرات طلباً (Capabilities)</h3>
          <div className="space-y-2.5 text-xs">
            {data.mostUsedCapabilities.map((cap, i) => (
              <div key={i} className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
                <span className="font-bold text-[#e8f5f5]">{cap.name}</span>
                <span className="font-mono text-[#00d4aa] font-extrabold">{cap.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Error Classification */}
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-3">
          <h3 className="text-sm font-bold text-[#e8f5f5]">تصنيف الاستثناءات والأخطاء (Error Taxonomy)</h3>
          <div className="space-y-2.5 text-xs">
            {data.errorClassification.map((err, i) => (
              <div key={i} className="p-3 bg-[#111a1a] rounded-xl border border-amber-500/20 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-400 font-mono">{err.type}</span>
                  <span className="text-[10px] text-[#88b0b0]">تكرر: {err.count} مرة</span>
                </div>
                <p className="text-[11px] text-[#88b0b0] leading-relaxed">{err.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
