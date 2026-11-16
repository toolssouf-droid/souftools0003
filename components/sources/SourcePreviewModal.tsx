/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SearchSource } from "@/lib/sourcesHelper";
import { Globe, ExternalLink, X } from "lucide-react";

interface SourcePreviewModalProps {
  source: SearchSource | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SourcePreviewModal: React.FC<SourcePreviewModalProps> = ({
  source,
  isOpen,
  onClose,
}) => {
  const [imgError, setImgError] = useState(false);

  if (!isOpen || !source) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
        {/* Invisible/Transparent Backdrop click-away trigger */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 cursor-default"
        />

        {/* Ultra-compact ChatGPT-like Popover card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="relative w-full max-w-[280px] bg-[#0d1313] border border-[#203333] hover:border-[#00d4aa]/40 rounded-xl shadow-2xl overflow-hidden flex flex-col z-10 text-right p-3.5 space-y-3"
          dir="rtl"
        >
          {/* Header Row: Favicon & Site Name & Close Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-md bg-[#162222] border border-[#203333] flex items-center justify-center overflow-hidden shrink-0">
                {!imgError && source.faviconUrl ? (
                  <img
                    src={source.faviconUrl}
                    alt={source.siteName}
                    className="w-3.5 h-3.5 object-contain"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-[#00d4aa]" />
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-[#e8f5f5] truncate block">
                  {source.siteName || source.domain}
                </span>
                <span className="text-[9px] text-[#4a7070] font-mono block truncate dir-ltr text-right">
                  {source.domain}
                </span>
              </div>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[#4a7070] hover:text-[#e8f5f5] hover:bg-[#1a2929] rounded-md transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Simple Truncated Title */}
          <div className="text-xs font-medium text-[#a3c2c2] leading-relaxed line-clamp-2">
            {source.title}
          </div>

          {/* Direct Open Link Button */}
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-[#162222] hover:bg-[#00d4aa]/15 border border-[#203333] hover:border-[#00d4aa]/40 text-[#00d4aa] text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <span>فتح المصدر</span>
            <ExternalLink className="w-3 h-3 stroke-[2.5]" />
          </a>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
