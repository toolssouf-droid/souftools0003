"use client";

import React from "react";
import {
  Image as ImageIcon,
  Sparkles,
  Eye,
  FileScan,
  CheckCircle2,
  Clock,
  Layers,
  BarChart2,
} from "lucide-react";
import { ImageVisionMetrics } from "@/lib/analytics/types";

interface ImagesTabProps {
  data: ImageVisionMetrics | null;
  loading: boolean;
}

export const ImagesTab: React.FC<ImagesTabProps> = ({ data, loading }) => {
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
            <span>توليد الصور الجديدة</span>
            <ImageIcon className="w-4 h-4 text-[#ec4899]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono">{(data.generatedImages || 0).toLocaleString()}</h3>
          <span className="text-[11px] text-[#00ff88]">Imagen 3.0 & Flux</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>تعديل وتحسين الصور</span>
            <Sparkles className="w-4 h-4 text-[#a855f7]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#c084fc] font-mono">{(data.editedImages || 0).toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">إزالة خلفيات وتعديل</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>تحليل الرؤية (Vision)</span>
            <Eye className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#38bdf8] font-mono">{(data.visionRequests || 0).toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">فهم المخططات والصور</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>استخراج النصوص (OCR)</span>
            <FileScan className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#00d4aa] font-mono">{(data.ocrRequests || 0).toLocaleString()}</h3>
          <span className="text-[11px] text-[#00ff88]">دعم كامل للغة العربية</span>
        </div>
      </div>

      {/* Model Performance Comparison */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm font-bold text-[#e8f5f5]">مقارنة أداء نماذج توليد ومعالجة الصور</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#1e2e2e] text-[#88b0b0] font-bold">
                <th className="pb-3 pr-2">النموذج</th>
                <th className="pb-3">المزود</th>
                <th className="pb-3">الطلبات</th>
                <th className="pb-3">متوسط زمن التوليد</th>
                <th className="pb-3 text-center">معدل النجاح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e2e]/60 font-mono">
              {(data.providerModelBreakdown || []).map((m, i) => (
                <tr key={i} className="hover:bg-[#111a1a]/50 transition-colors">
                  <td className="py-3 pr-2 font-sans font-bold text-[#e8f5f5] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#ec4899]" />
                    <span>{m.model}</span>
                  </td>
                  <td className="py-3 text-[#88b0b0] font-sans">{m.provider}</td>
                  <td className="py-3 text-[#38bdf8] font-bold">{m.count}</td>
                  <td className="py-3 text-[#00d4aa]">{(m.avgLatencyMs / 1000).toFixed(1)}s</td>
                  <td className="py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-[#00ff88]/15 text-[#00ff88] font-bold">
                      {m.successRatePct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
