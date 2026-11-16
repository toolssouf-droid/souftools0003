/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState } from "react";
import { SearchSource } from "@/lib/sourcesHelper";
import { SourcePreviewModal } from "./SourcePreviewModal";

interface InlineCitationBadgeProps {
  num: number;
  sources?: SearchSource[];
}

export const InlineCitationBadge: React.FC<InlineCitationBadgeProps> = ({
  num,
  sources,
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const matchedSource = sources?.find((s) => s.number === num) || {
    id: `src_${num}`,
    number: num,
    title: `مصدر معلومات [${num}]`,
    snippet: `مصدر توثيق رقم ${num} لمزيد من الفحص والاستكشاف.`,
    url: `#`,
    domain: `soufsources.dev`,
    siteName: `مصدر [${num}]`,
    isOfficial: true,
    type: "website" as const,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsPreviewOpen(true)}
        className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md bg-[#162222] hover:bg-[#00d4aa]/15 border border-[#203333] hover:border-[#00d4aa]/40 text-[#00d4aa] text-[10px] font-mono font-bold transition-all duration-150 cursor-pointer align-baseline shadow-sm"
        title={matchedSource.siteName || matchedSource.domain}
      >
        {!imgError && matchedSource.faviconUrl ? (
          <img
            src={matchedSource.faviconUrl}
            alt={matchedSource.siteName}
            className="w-2.5 h-2.5 rounded-full object-contain shrink-0"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa]" />
        )}
        <span>[{num}]</span>
      </button>

      {/* Mini Popover Preview on Click */}
      <SourcePreviewModal
        source={matchedSource}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </>
  );
};
