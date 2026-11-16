"use client";

import React from "react";
import {
  Search,
  Globe,
  FileText,
  Clock,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { WebResearchMetrics } from "@/lib/analytics/types";

interface ResearchTabProps {
  data: WebResearchMetrics | null;
  loading: boolean;
}

export const ResearchTab: React.FC<ResearchTabProps> = ({ data, loading }) => {
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
            <span>إجمالي عمليات البحث</span>
            <Search className="w-4 h-4 text-[#06b6d4]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono">{data.totalSearches.toLocaleString()}</h3>
          <span className="text-[11px] text-[#00ff88]">تغطية حية لمحركات البحث</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>المصادر المستخرجة</span>
            <Globe className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#00d4aa] font-mono">{(data.extractedSourcesCount || 0).toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">استخلاص محتوى نقي</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>الصفحات المقروءة كاملة</span>
            <FileText className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#38bdf8] font-mono">{(data.readPagesCount || 0).toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">تحليل نصوص عميق</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>متوسط مدة جلسة البحث</span>
            <Clock className="w-4 h-4 text-[#a855f7]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#c084fc] font-mono">{Math.round((data.avgResearchDurationMs || 3000) / 1000)}s</h3>
          <span className="text-[11px] text-[#00ff88]">توازي فائق السرعة</span>
        </div>
      </div>

      {/* Top Domains & Queries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Domains */}
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-3">
          <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#00d4aa]" />
            <span>أكثر المواقع والمصادر المرجعية زيارة</span>
          </h3>
          <div className="space-y-2 text-xs">
            {(data.topDomains || []).map((d, i) => (
              <div key={i} className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
                <span className="font-mono text-[#e8f5f5]">{d.domain}</span>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-[#88b0b0]">{d.count} مرة</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#00d4aa]/15 text-[#00d4aa] font-bold">{d.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Search Queries */}
        <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-3">
          <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
            <Search className="w-4 h-4 text-[#0ea5e9]" />
            <span>سجل استعلامات البحث الأخيرة</span>
          </h3>
          <div className="space-y-2 text-xs font-mono">
            {(data.recentSearchQueries || []).map((q, i) => (
              <div key={i} className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-sans font-bold text-[#e8f5f5]">{q.query}</span>
                  <span className="text-[#00ff88] text-[11px]">{q.durationMs}ms</span>
                </div>
                <div className="flex justify-between text-[10px] text-[#88b0b0]">
                  <span>المصادر: {q.sourcesCount}</span>
                  <span>{new Date(q.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
