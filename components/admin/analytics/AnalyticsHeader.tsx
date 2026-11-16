"use client";

import React from "react";
import {
  Calendar,
  RefreshCw,
  Download,
  ChevronDown,
  Clock,
  Filter,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { AnalyticsTimeRange } from "@/lib/analytics/types";

interface AnalyticsHeaderProps {
  activeTab: string;
  timeRange: AnalyticsTimeRange;
  setTimeRange: (range: AnalyticsTimeRange) => void;
  customStartDate: string;
  setCustomStartDate: (val: string) => void;
  customEndDate: string;
  setCustomEndDate: (val: string) => void;
  comparePrevious: boolean;
  setComparePrevious: (val: boolean) => void;
  loading: boolean;
  onRefresh: () => void;
  onExport: (format: "csv" | "json") => void;
  isExporting: boolean;
}

export const AnalyticsHeader: React.FC<AnalyticsHeaderProps> = ({
  activeTab,
  timeRange,
  setTimeRange,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  comparePrevious,
  setComparePrevious,
  loading,
  onRefresh,
  onExport,
  isExporting,
}) => {
  const [exportOpen, setExportOpen] = React.useState(false);
  const [customOpen, setCustomOpen] = React.useState(false);

  const ranges: { id: AnalyticsTimeRange; label: string }[] = [
    { id: "today", label: "اليوم (24h)" },
    { id: "7d", label: "آخر 7 أيام" },
    { id: "30d", label: "آخر 30 يوماً" },
    { id: "90d", label: "آخر 90 يوماً" },
    { id: "custom", label: "مخصص" },
  ];

  return (
    <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Title & Description */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00d4aa] animate-pulse" />
            <h2 className="text-base sm:text-lg font-extrabold text-[#e8f5f5]">
              مركز الإحصائيات وتحليل البيانات الشامل (Enterprise Analytics)
            </h2>
          </div>
          <p className="text-xs text-[#88b0b0]">
            تحليلات فورية ودقيقة مرتبطة بقاعدة بيانات PostgreSQL ومحرك SoufTools الخاص بدون أي بيانات وهمية.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Time Range Selector */}
          <div className="flex items-center bg-[#111a1a] p-1 rounded-xl border border-[#1e2e2e] overflow-x-auto max-w-full no-scrollbar">
            {ranges.map((r) => {
              const active = timeRange === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setTimeRange(r.id);
                    if (r.id === "custom") {
                      setCustomOpen(true);
                    } else {
                      setCustomOpen(false);
                    }
                  }}
                  className={`px-2.5 py-1.5 sm:px-3 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20 font-extrabold"
                      : "text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#1e2e2e]/50"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Comparison Toggle */}
            <button
              onClick={() => setComparePrevious(!comparePrevious)}
              className={`px-2.5 py-2 sm:px-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                comparePrevious
                  ? "bg-[#00d4aa]/15 border-[#00d4aa]/50 text-[#00d4aa]"
                  : "bg-[#111a1a] border-[#1e2e2e] text-[#88b0b0] hover:text-[#e8f5f5]"
              }`}
              title="مقارنة مؤشرات النمو بالفترة السابقة"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="hidden md:inline">مقارنة بالفترة السابقة</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa] text-[#88b0b0] hover:text-[#00d4aa] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#00d4aa]" : ""}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative shrink-0">
              <button
                onClick={() => setExportOpen(!exportOpen)}
                disabled={isExporting}
                className="px-2.5 py-2 sm:px-3 rounded-xl bg-[#00d4aa] hover:bg-[#00b894] text-[#0a0f0f] text-xs font-extrabold shadow-md shadow-[#00d4aa]/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير</span>
                <ChevronDown className="w-3 h-3" />
              </button>

              {exportOpen && (
                <div
                  className="absolute left-0 mt-2 w-44 rounded-xl bg-[#111a1a] border border-[#1e2e2e] shadow-2xl p-1.5 z-50 space-y-1 text-right"
                  onClick={() => setExportOpen(false)}
                >
                  <button
                    onClick={() => onExport("csv")}
                    className="w-full text-right px-3 py-2 rounded-lg text-xs font-bold text-[#e8f5f5] hover:bg-[#1e2e2e] hover:text-[#00d4aa] transition-colors flex items-center justify-between"
                  >
                    <span>تقرير CSV كامل</span>
                    <span className="text-[10px] text-[#4a7070] font-mono">.csv</span>
                  </button>
                  <button
                    onClick={() => onExport("json")}
                    className="w-full text-right px-3 py-2 rounded-lg text-xs font-bold text-[#e8f5f5] hover:bg-[#1e2e2e] hover:text-[#00d4aa] transition-colors flex items-center justify-between"
                  >
                    <span>بيانات JSON خام</span>
                    <span className="text-[10px] text-[#4a7070] font-mono">.json</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Date Range Picker Accordion */}
      {timeRange === "custom" && (
        <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex flex-wrap items-center gap-3 animate-fade-in text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#00d4aa]" />
            <span className="text-[#88b0b0]">من تاريخ:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-[#0a0f0f] text-[#e8f5f5] border border-[#1e2e2e] rounded-lg px-2.5 py-1 text-xs outline-none focus:border-[#00d4aa]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#88b0b0]">إلى تاريخ:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-[#0a0f0f] text-[#e8f5f5] border border-[#1e2e2e] rounded-lg px-2.5 py-1 text-xs outline-none focus:border-[#00d4aa]"
            />
          </div>
          <button
            onClick={onRefresh}
            className="px-3 py-1 bg-[#00d4aa]/20 border border-[#00d4aa]/40 text-[#00d4aa] hover:bg-[#00d4aa] hover:text-[#0a0f0f] rounded-lg font-bold text-xs transition-colors cursor-pointer"
          >
            تطبيق النطاق
          </button>
        </div>
      )}
    </div>
  );
};
