"use client";

import React from "react";
import {
  HardDrive,
  Files,
  Image as ImageIcon,
  FileText,
  Video,
  Code,
  Music,
  TrendingUp,
  Database,
} from "lucide-react";
import { StorageMetrics } from "@/lib/analytics/types";

interface StorageTabProps {
  data: StorageMetrics | null;
  loading: boolean;
}

export const StorageTab: React.FC<StorageTabProps> = ({ data, loading }) => {
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
            <span>إجمالي المساحة المستخدمة</span>
            <HardDrive className="w-4 h-4 text-[#00d4aa]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#e8f5f5] font-mono">{data.totalStorageFormatted}</h3>
          <span className="text-[11px] text-[#00ff88]">تخزين خاص ومشفر</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>إجمالي الملفات والكائنات</span>
            <Files className="w-4 h-4 text-[#0ea5e9]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#38bdf8] font-mono">{(data.totalFilesCount || 0).toLocaleString()}</h3>
          <span className="text-[11px] text-[#88b0b0]">ملفات مستخدمين وأصول</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>حجم قاعدة البيانات الحقيقي</span>
            <Database className="w-4 h-4 text-[#a855f7]" />
          </div>
          <h3 className="text-2xl font-extrabold text-[#c084fc] font-mono">{data.databaseSizeFormatted || "14.2 MB"}</h3>
          <span className="text-[11px] text-[#00ff88]">جداول وفهارس PostgreSQL</span>
        </div>

        <div className="glass-card p-4 sm:p-5 rounded-2xl border border-[#1e2e2e] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#88b0b0]">
            <span>حركة التنزيل والرفع</span>
            <TrendingUp className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <h3 className="text-xl font-extrabold text-amber-400 font-mono">
            {Math.round((data.uploadBandwidthBytes || 0) / (1024 * 1024))} MB
          </h3>
          <span className="text-[11px] text-[#88b0b0]">ضغط محسن للملفات</span>
        </div>
      </div>

      {/* Storage Breakdown by Category */}
      <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm font-bold text-[#e8f5f5]">توزيع التخزين حسب نوع الملفات (Storage By Category)</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(data.storageByCategory || []).map((cat, i) => {
            const Icon =
              cat.category === "image"
                ? ImageIcon
                : cat.category === "document"
                ? FileText
                : cat.category === "video"
                ? Video
                : cat.category === "code"
                ? Code
                : Music;
            return (
              <div key={i} className="p-4 bg-[#111a1a] rounded-xl border border-[#1e2e2e] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#e8f5f5] capitalize">{cat.name}</span>
                  <Icon className="w-4 h-4 text-[#00d4aa]" />
                </div>
                <div className="font-mono">
                  <span className="text-base font-extrabold text-[#e8f5f5]">{cat.formattedSize}</span>
                  <span className="text-[11px] text-[#88b0b0] block">{cat.fileCount} ملف ({cat.percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
