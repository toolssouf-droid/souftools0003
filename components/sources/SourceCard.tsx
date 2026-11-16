"use client";

import React, { useState } from "react";
import { SearchSource } from "@/lib/sourcesHelper";
import { SourceTypeBadge } from "./SourceTypeBadge";
import { SourcePreviewModal } from "./SourcePreviewModal";
import { useChatStore } from "@/store/chatStore";
import {
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Globe,
  ChevronLeft,
} from "lucide-react";

interface SourceCardProps {
  source: SearchSource;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { savedSources, toggleSaveSource } = useChatStore();

  const isSaved = savedSources.some((s) => s.url === source.url);

  return (
    <>
      <div
        onClick={() => setIsPreviewOpen(true)}
        className="group relative p-3.5 sm:p-4 rounded-2xl bg-[#0f1717] hover:bg-[#131f1f] border border-[#1e2e2e] hover:border-[#00d4aa]/40 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-[#00d4aa]/10 flex flex-col justify-between gap-3 min-w-0 w-full"
      >
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {/* Index Badge */}
            <span className="w-5 h-5 rounded-lg bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
              [{source.number}]
            </span>

            {/* Favicon */}
            <div className="w-5 h-5 rounded-md bg-[#1e2e2e] flex items-center justify-center overflow-hidden shrink-0">
              {source.faviconUrl ? (
                <img
                  src={source.faviconUrl}
                  alt={source.siteName}
                  className="w-3.5 h-3.5 object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                <Globe className="w-3.5 h-3.5 text-[#00d4aa]" />
              )}
            </div>

            {/* Site Name & Domain */}
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-xs font-bold text-[#e8f5f5] truncate">
                {source.siteName}
              </span>
              <span className="text-[10px] text-[#4a7070] font-mono truncate dir-ltr">
                ({source.domain})
              </span>
            </div>
          </div>

          <SourceTypeBadge
            type={source.type}
            isOfficial={source.isOfficial}
          />
        </div>

        {/* Title */}
        <h4 className="text-xs sm:text-sm font-bold text-[#e8f5f5] group-hover:text-[#00d4aa] transition-colors line-clamp-2 leading-snug">
          {source.title}
        </h4>

        {/* Short Snippet */}
        {source.snippet && (
          <p className="text-[11px] text-[#8aa3a3] line-clamp-2 leading-relaxed">
            {source.snippet}
          </p>
        )}

        {/* Footer Actions */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-between gap-2 pt-2 border-t border-[#1e2e2e]/60 text-[11px]"
        >
          {/* Domain tag */}
          <span className="text-[#4a7070] font-mono text-[10px] truncate dir-ltr">
            {source.domain}
          </span>

          <div className="flex items-center gap-2">
            {/* Bookmark button */}
            <button
              onClick={() => toggleSaveSource(source)}
              className={`p-1.5 rounded-lg border transition-all ${
                isSaved
                  ? "bg-[#00d4aa]/20 border-[#00d4aa] text-[#00d4aa]"
                  : "bg-[#1e2e2e]/40 border-[#2a3f3f] text-[#a3c2c2] hover:text-[#00d4aa]"
              }`}
              title={isSaved ? "إزالة من المحفوظات" : "حفظ المصدر"}
            >
              {isSaved ? (
                <BookmarkCheck className="w-3.5 h-3.5 text-[#00d4aa]" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Direct Open Button */}
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00d4aa]/10 hover:bg-[#00d4aa] text-[#00d4aa] hover:text-[#0a0f0f] border border-[#00d4aa]/30 text-[11px] font-bold transition-all"
            >
              <span>فتح المصدر ↗</span>
            </a>
          </div>
        </div>
      </div>

      {/* Modal Preview */}
      <SourcePreviewModal
        source={source}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </>
  );
};
