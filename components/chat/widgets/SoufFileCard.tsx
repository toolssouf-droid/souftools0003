"use client";

import React, { useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  FileArchive,
  Presentation,
  Eye,
  Download,
  MoreHorizontal,
  Check,
  Copy,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { SoufFileItem, SoufFileCategory } from "@/lib/files/soufFileType";
import { triggerFileDownload } from "@/lib/files/soufFileStorage";
import { copyToClipboard } from "@/lib/utils";

interface SoufFileCardProps {
  file: SoufFileItem;
  onPreview: (file: SoufFileItem) => void;
  onSelectEditPrompt?: (file: SoufFileItem, prompt: string) => void;
  isRtl?: boolean;
}

function getCategoryConfig(category: SoufFileCategory, ext: string) {
  switch (category) {
    case "document":
      if (ext === "pdf") {
        return {
          icon: FileText,
          color: "#ef4444",
          bg: "bg-[#ef4444]/10",
          border: "border-[#ef4444]/30",
          glow: "shadow-[#ef4444]/10",
          label: "PDF",
        };
      }
      return {
        icon: FileText,
        color: "#3b82f6",
        bg: "bg-[#3b82f6]/10",
        border: "border-[#3b82f6]/30",
        glow: "shadow-[#3b82f6]/10",
        label: ext.toUpperCase(),
      };
    case "data":
      if (ext === "xlsx" || ext === "xls") {
        return {
          icon: FileSpreadsheet,
          color: "#10b981",
          bg: "bg-[#10b981]/10",
          border: "border-[#10b981]/30",
          glow: "shadow-[#10b981]/10",
          label: "EXCEL",
        };
      }
      if (ext === "csv") {
        return {
          icon: FileSpreadsheet,
          color: "#14b8a6",
          bg: "bg-[#14b8a6]/10",
          border: "border-[#14b8a6]/30",
          glow: "shadow-[#14b8a6]/10",
          label: "CSV",
        };
      }
      return {
        icon: FileCode,
        color: "#a855f7",
        bg: "bg-[#a855f7]/10",
        border: "border-[#a855f7]/30",
        glow: "shadow-[#a855f7]/10",
        label: ext.toUpperCase(),
      };
    case "code":
      return {
        icon: FileCode,
        color: "#f59e0b",
        bg: "bg-[#f59e0b]/10",
        border: "border-[#f59e0b]/30",
        glow: "shadow-[#f59e0b]/10",
        label: ext.toUpperCase(),
      };
    case "image":
      return {
        icon: FileImage,
        color: "#06b6d4",
        bg: "bg-[#06b6d4]/10",
        border: "border-[#06b6d4]/30",
        glow: "shadow-[#06b6d4]/10",
        label: ext.toUpperCase(),
      };
    case "presentation":
      return {
        icon: Presentation,
        color: "#f97316",
        bg: "bg-[#f97316]/10",
        border: "border-[#f97316]/30",
        glow: "shadow-[#f97316]/10",
        label: "SLIDES",
      };
    case "archive":
      return {
        icon: FileArchive,
        color: "#8b5cf6",
        bg: "bg-[#8b5cf6]/10",
        border: "border-[#8b5cf6]/30",
        glow: "shadow-[#8b5cf6]/10",
        label: "ZIP",
      };
    default:
      return {
        icon: FileText,
        color: "#00d4aa",
        bg: "bg-[#00d4aa]/10",
        border: "border-[#00d4aa]/30",
        glow: "shadow-[#00d4aa]/10",
        label: ext.toUpperCase(),
      };
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const SoufFileCard: React.FC<SoufFileCardProps> = ({
  file,
  onPreview,
  onSelectEditPrompt,
  isRtl = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const cfg = getCategoryConfig(file.category, file.extension);
  const IconComp = cfg.icon;

  const handleCopy = async () => {
    await copyToClipboard(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMenu(false);
  };

  const handleDownload = () => {
    triggerFileDownload(file);
    setShowMenu(false);
  };

  return (
    <div
      id={`souf-file-card-${file.id}`}
      dir={isRtl ? "rtl" : "ltr"}
      className="group relative my-2 w-full max-w-lg rounded-2xl border border-[#1e2e2e]/80 bg-gradient-to-br from-[#0e1717]/95 via-[#0a1212]/95 to-[#060c0c]/98 p-3 shadow-md backdrop-blur-xl transition-all duration-300 hover:border-[#00d4aa]/40 hover:shadow-lg hover:shadow-[#00d4aa]/5"
    >
      {/* Main Single-Row Layout */}
      <div className="flex items-center justify-between gap-3">
        {/* File Icon + Name & Extension */}
        <div
          onClick={() => onPreview(file)}
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer select-none"
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${cfg.border} ${cfg.bg} shadow-sm transition-transform group-hover:scale-105`}
            style={{ color: cfg.color }}
          >
            <IconComp className="h-5 w-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4
                className="truncate text-xs sm:text-sm font-bold text-[#e8f5f5] transition-colors group-hover:text-[#00d4aa]"
                title={file.name}
              >
                {file.name}
              </h4>

              {/* Version Pill */}
              <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-1.5 py-0.2 text-[9px] font-mono font-bold text-[#00d4aa]">
                <Layers className="h-2 w-2" />
                v{file.version || 1}
              </span>
            </div>

            {/* Clean Minimal Type & Size */}
            <div className="flex items-center gap-1.5 text-[10px] text-[#5e7e7e] font-mono mt-0.5">
              <span className="font-bold uppercase tracking-wide" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
              <span>•</span>
              <span>{formatBytes(file.size)}</span>
            </div>
          </div>
        </div>

        {/* Action Controls: Preview Button + Three Dots Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Primary Preview Button */}
          <button
            id={`btn-preview-${file.id}`}
            type="button"
            onClick={() => onPreview(file)}
            className="flex items-center gap-1.5 rounded-xl border border-[#00d4aa]/40 bg-[#00d4aa]/15 px-3 py-1.5 text-xs font-bold text-[#00d4aa] transition-all hover:bg-[#00d4aa] hover:text-[#0a0f0f] active:scale-95 shadow-sm"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>معاينة</span>
          </button>

          {/* Three Dots Options Menu */}
          <div className="relative">
            <button
              id={`btn-more-${file.id}`}
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#1e2e2e] bg-[#101b1b] text-[#709090] transition-colors hover:border-[#00d4aa]/40 hover:text-[#00d4aa] active:scale-95"
              title="خيارات وتفاصيل إضافية"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {/* Dropdown Menu Containing all extra info & actions */}
            {showMenu && (
              <div
                className="absolute left-0 top-full z-50 mt-1.5 w-52 rounded-xl border border-[#1e2e2e] bg-[#0c1616] p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95"
                onMouseLeave={() => setShowMenu(false)}
              >
                {/* File Details Summary in Menu */}
                <div className="border-b border-[#1e2e2e]/60 px-2 py-1.5 text-[10px] text-[#6b8b8b]">
                  <div className="font-bold text-[#d8e8e8] truncate">{file.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5 font-mono">
                    <span>{formatBytes(file.size)}</span>
                    {file.metadata?.lineCount ? (
                      <>
                        <span>•</span>
                        <span>{file.metadata.lineCount} سطر</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Download Action */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[#a0b0b0] hover:bg-[#152323] hover:text-[#00d4aa] transition-colors mt-1"
                >
                  <Download className="h-3.5 w-3.5 text-[#00d4aa]" />
                  <span>تنزيل الملف</span>
                </button>

                {/* Copy Content Action */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[#a0b0b0] hover:bg-[#152323] hover:text-[#e8f5f5] transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-[#00ff88]" />
                      <span className="text-[#00ff88]">تم نسخ المحتوى</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>نسخ محتوى الملف</span>
                    </>
                  )}
                </button>

                {/* Expand Full Preview Action */}
                <button
                  type="button"
                  onClick={() => {
                    onPreview(file);
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[#a0b0b0] hover:bg-[#152323] hover:text-[#e8f5f5] transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>فتح المعاينة الكاملة</span>
                </button>

                {file.versions && file.versions.length > 1 && (
                  <div className="border-t border-[#1e2e2e]/50 mt-1 pt-1.5 px-2.5 text-[10px] text-[#507070]">
                    يحتوي {file.versions.length} إصدارات تاريخية
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle SoufAI Note if exists */}
      {file.summary && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[#070e0e]/60 px-2 py-1 text-[11px] text-[#809b9b]">
          <Sparkles className="h-3 w-3 shrink-0 text-[#00d4aa]" />
          <span className="truncate">{file.summary}</span>
        </div>
      )}
    </div>
  );
};
