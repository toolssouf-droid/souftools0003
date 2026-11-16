/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import { SearchSource } from "@/lib/sourcesHelper";
import { Globe, ChevronDown, ChevronUp } from "lucide-react";
import { SourcePreviewModal } from "./SourcePreviewModal";

interface SoufSourcesListProps {
  sources?: SearchSource[];
}

export const SoufSourcesList: React.FC<SoufSourcesListProps> = ({ sources }) => {
  const [selectedSource, setSelectedSource] = useState<SearchSource | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  // Render maximum of 4 sources unless expanded
  const displayedSources = isExpanded ? sources : sources.slice(0, 4);

  return (
    <div className="mt-2.5 pt-2 border-t border-[#1e2e2e]/30 w-full flex items-center gap-2 flex-wrap text-right" dir="rtl">
      {/* Small clean prefix */}
      <span className="text-[11px] font-bold text-[#4a7070] shrink-0">
        المصادر المستعان بها:
      </span>

      {/* Row of tiny integrated sources */}
      <div className="flex items-center gap-1.5 flex-wrap dir-ltr">
        {displayedSources.map((source) => {
          const num = source.number || 1;
          
          // Generate high quality fallback favicon URL using Google S2 service if missing
          let favUrl = source.faviconUrl;
          if (!favUrl && source.url) {
            try {
              const domain = source.domain || new URL(source.url).hostname;
              favUrl = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
            } catch (e) {
              favUrl = "";
            }
          }

          return (
            <button
              key={source.id || source.url}
              type="button"
              onClick={() => setSelectedSource(source)}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#162222] hover:bg-[#00d4aa]/10 border border-[#203333] hover:border-[#00d4aa]/40 text-[#a3c2c2] hover:text-[#00d4aa] text-[10px] font-medium transition-all duration-150 cursor-pointer"
            >
              <div className="w-3.5 h-3.5 rounded-full overflow-hidden flex items-center justify-center bg-[#0a0f0f] shrink-0 border border-[#203333]">
                {favUrl ? (
                  <img
                    src={favUrl}
                    alt={source.siteName || "source"}
                    className="w-2.5 h-2.5 object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `<span class="text-[7.5px] text-[#00d4aa] font-bold font-sans">${(source.siteName || source.domain || 'W').charAt(0).toUpperCase()}</span>`;
                      }
                    }}
                  />
                ) : (
                  <Globe className="w-2.5 h-2.5 text-[#00d4aa]" />
                )}
              </div>
              <span className="truncate max-w-[80px]">
                {source.siteName || source.domain}
              </span>
              <span className="text-[9px] text-[#4a7070] font-mono font-bold">
                [{num}]
              </span>
            </button>
          );
        })}

        {/* Small Toggle Expand/Collapse Button */}
        {sources.length > 4 && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#162222] hover:bg-[#00d4aa]/10 border border-[#203333] hover:border-[#00d4aa]/40 text-[#a3c2c2] hover:text-[#00d4aa] text-[9px] font-bold transition-all duration-150 cursor-pointer shadow-sm"
          >
            {isExpanded ? (
              <>
                <span>عرض أقل</span>
                <ChevronUp className="w-2.5 h-2.5 text-[#00d4aa]" />
              </>
            ) : (
              <>
                <span>المزيد (+{sources.length - 4})</span>
                <ChevronDown className="w-2.5 h-2.5 text-[#00d4aa]" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Popover/Modal on Source click */}
      <SourcePreviewModal
        source={selectedSource}
        isOpen={!!selectedSource}
        onClose={() => setSelectedSource(null)}
      />
    </div>
  );
};
