"use client";

import React from "react";
import { SourceType } from "@/lib/sourcesHelper";
import {
  Globe,
  FileText,
  BookOpen,
  GitBranch,
  Newspaper,
  GraduationCap,
  Building2,
  Database,
  Video,
  ShieldCheck,
} from "lucide-react";

interface SourceTypeBadgeProps {
  type: SourceType;
  isOfficial?: boolean;
  size?: "sm" | "md";
}

export const SourceTypeBadge: React.FC<SourceTypeBadgeProps> = ({
  type,
  isOfficial = false,
  size = "sm",
}) => {
  const getBadgeConfig = () => {
    switch (type) {
      case "github":
        return {
          label: "GitHub",
          icon: <GitBranch className="w-3 h-3 text-[#e8f5f5]" />,
          bg: "bg-[#1f2937]/80 text-[#e8f5f5] border-gray-700",
        };
      case "documentation":
        return {
          label: "توثيق رسمي",
          icon: <BookOpen className="w-3 h-3 text-[#38bdf8]" />,
          bg: "bg-[#0284c7]/15 text-[#38bdf8] border-[#0284c7]/30",
        };
      case "academic":
        return {
          label: "بحث علمي",
          icon: <GraduationCap className="w-3 h-3 text-[#a855f7]" />,
          bg: "bg-[#a855f7]/15 text-[#c084fc] border-[#a855f7]/30",
        };
      case "news":
        return {
          label: "أخبار",
          icon: <Newspaper className="w-3 h-3 text-[#f59e0b]" />,
          bg: "bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/30",
        };
      case "official":
        return {
          label: "جهة رسمية",
          icon: <Building2 className="w-3 h-3 text-[#10b981]" />,
          bg: "bg-[#10b981]/15 text-[#34d399] border-[#10b981]/30",
        };
      case "dataset":
        return {
          label: "بيانات",
          icon: <Database className="w-3 h-3 text-[#ec4899]" />,
          bg: "bg-[#ec4899]/15 text-[#f472b6] border-[#ec4899]/30",
        };
      case "video":
        return {
          label: "فيديو",
          icon: <Video className="w-3 h-3 text-[#ef4444]" />,
          bg: "bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30",
        };
      case "article":
        return {
          label: "مقال",
          icon: <FileText className="w-3 h-3 text-[#00d4aa]" />,
          bg: "bg-[#00d4aa]/15 text-[#00d4aa] border-[#00d4aa]/30",
        };
      case "website":
      default:
        return {
          label: "موقع",
          icon: <Globe className="w-3 h-3 text-[#a3c2c2]" />,
          bg: "bg-[#1e2e2e]/60 text-[#a3c2c2] border-[#2a3f3f]",
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-medium ${config.bg}`}
      >
        {config.icon}
        <span>{config.label}</span>
      </span>

      {isOfficial && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30 text-[10px] font-bold">
          <ShieldCheck className="w-3 h-3 text-[#34d399]" />
          <span>✓ مصدر رسمي</span>
        </span>
      )}
    </div>
  );
};
