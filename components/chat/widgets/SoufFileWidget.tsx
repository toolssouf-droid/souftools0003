"use client";

import React, { useState } from "react";
import { Layers, Sparkles } from "lucide-react";
import { SoufFileItem, SoufFileWidgetData } from "@/lib/files/soufFileType";
import { SoufFileCard } from "./SoufFileCard";
import { SoufFilePreviewModal } from "./SoufFilePreviewModal";

interface SoufFileWidgetProps {
  data: SoufFileWidgetData | any;
  isRtl?: boolean;
  onRequestEditPrompt?: (prompt: string) => void;
}

export const SoufFileWidget: React.FC<SoufFileWidgetProps> = ({
  data,
  isRtl = true,
  onRequestEditPrompt,
}) => {
  const [activePreviewFile, setActivePreviewFile] = useState<SoufFileItem | null>(null);

  if (!data) return null;

  const activeFile: SoufFileItem | undefined = data.activeFile || data.file;
  const files: SoufFileItem[] = data.files || (activeFile ? [activeFile] : []);

  if (files.length === 0) return null;

  const handlePreview = (fileToPreview: SoufFileItem) => {
    setActivePreviewFile(fileToPreview);
  };

  const handleRequestEdit = (file: SoufFileItem, prompt: string, version: number) => {
    const formattedPrompt = `[طلب تعديل على ملف: ${file.name} - الإصدار الحالي: v${version}]:\n${prompt}`;
    if (onRequestEditPrompt) {
      onRequestEditPrompt(formattedPrompt);
    } else {
      // Dispatch event to global chat input if available
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("souf-chat-set-prompt", { detail: { prompt: formattedPrompt, autoSend: true } })
        );
      }
    }
  };

  return (
    <div className="w-full my-2 flex flex-col gap-2">
      {/* Batch Header if multiple files */}
      {files.length > 1 && (
        <div className="flex items-center gap-2 px-1 text-xs font-bold text-[#00d4aa]">
          <Layers className="h-4 w-4" />
          <span>تم إنشاء وتجهيز {files.length} ملفات جاهزة للمعاينة والتنزيل:</span>
        </div>
      )}

      {/* Render Cards */}
      <div className={`grid gap-2 ${files.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {files.map((f) => (
          <SoufFileCard
            key={f.id}
            file={f}
            onPreview={handlePreview}
            onSelectEditPrompt={(file, p) => handleRequestEdit(file, p, file.version)}
            isRtl={isRtl}
          />
        ))}
      </div>

      {/* In-App Preview Modal */}
      <SoufFilePreviewModal
        file={activePreviewFile}
        isOpen={Boolean(activePreviewFile)}
        onClose={() => setActivePreviewFile(null)}
        onRequestEdit={handleRequestEdit}
        isRtl={isRtl}
      />
    </div>
  );
};
