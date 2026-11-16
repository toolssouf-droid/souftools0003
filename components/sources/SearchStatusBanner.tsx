/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Loader2 } from "lucide-react";
import { SoufGlobeIcon, SoufSparklesIcon } from "@/components/ui/BrandIcons";
import { SearchSource } from "@/lib/sourcesHelper";

interface SearchStatusBannerProps {
  isSearching: boolean;
  searchQuery?: string;
  sources?: SearchSource[];
  searchCount?: number;
}

export const SearchStatusBanner: React.FC<SearchStatusBannerProps> = ({
  isSearching,
  searchQuery = "",
  sources = [],
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);

  // Generate dynamic steps based on the current searchQuery
  const getDynamicSteps = () => {
    const topic = searchQuery
      .replace(/ابحث عن|أخبار|سعر|معلومات عن|أحدث|البحث في الويب/gi, "")
      .trim() || "الموضوع المطلوب";

    const shortTopic = topic.length > 25 ? topic.slice(0, 22) + "..." : topic;

    // Default base steps
    const steps = [
      { text: `🔎 يبحث في الويب عن: ${shortTopic}...`, icon: SoufGlobeIcon },
      { text: `📄 يفتح مصادر موثوقة بخصوص ${shortTopic}...`, icon: SoufGlobeIcon },
    ];

    // Contextual page reading
    const lowerQuery = searchQuery.toLowerCase();
    if (lowerQuery.includes("react") || searchQuery.includes("رياكت")) {
      steps.push({ text: "📄 يقرأ React Documentation المباشر...", icon: SoufGlobeIcon });
    } else if (lowerQuery.includes("next") || searchQuery.includes("نكست")) {
      steps.push({ text: "📄 يقرأ Next.js Official Documentation...", icon: SoufGlobeIcon });
    } else if (lowerQuery.includes("github") || searchQuery.includes("جيت")) {
      steps.push({ text: "📄 يراجع مستودعات وسجلات GitHub المباشرة...", icon: SoufGlobeIcon });
    } else if (lowerQuery.includes("wikipedia") || searchQuery.includes("ويكيبيديا")) {
      steps.push({ text: "📄 يفتح ويحلل مقالات ويكيبيديا الرسمية...", icon: SoufGlobeIcon });
    } else {
      steps.push({ text: `👁 يقرأ صفحات الويب المباشرة لـ ${shortTopic}...`, icon: SoufGlobeIcon });
    }

    steps.push(
      { text: `🧠 يحلل محتوى الصفحات والمطابقة لـ ${shortTopic}...`, icon: SoufSparklesIcon },
      { text: "🔍 يتحقق من دقة وصحة المعلومات ومقارنتها...", icon: SoufSparklesIcon },
      { text: "✍️ يكتب ويصوغ الإجابة النهائية الموثقة...", icon: SoufSparklesIcon }
    );

    return steps;
  };

  const dynamicSteps = getDynamicSteps();

  useEffect(() => {
    if (!isSearching) {
      setIsDone(true);
      const timer = setTimeout(() => {
        setIsDone(false);
      }, 5000);
      return () => clearTimeout(timer);
    }

    setIsDone(false);
    setStepIndex(0);

    const interval = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < dynamicSteps.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [isSearching, dynamicSteps.length]);

  if (!isSearching && !isDone) return null;

  const currentStatus = dynamicSteps[stepIndex] || dynamicSteps[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="w-full py-2.5 px-1 flex items-center justify-between text-right gap-3"
        dir="rtl"
      >
        <div className="flex items-center gap-2">
          {/* ChatGPT-style clean pulsing status indicator */}
          <div className="flex items-center justify-center shrink-0 w-5 h-5 rounded-full bg-[#00d4aa]/10 text-[#00d4aa]">
            <Loader2 className="w-3 h-3 animate-spin stroke-[2.5]" />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-[#00d4aa] animate-pulse">
              {isDone ? "✅ اكتملت مراجعة المصادر وكتابة الإجابة" : currentStatus.text}
            </span>
            {searchQuery && !isDone && (
              <span className="text-[11px] text-[#4a7070] font-mono truncate max-w-xs">
                ({searchQuery.slice(0, 35)}...)
              </span>
            )}
          </div>
        </div>

        {/* Real Live Sources - Extremely Small pills (ChatGPT style) */}
        {sources && sources.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[50%] scrollbar-none py-0.5">
            {sources.map((src, idx) => (
              <a
                key={src.id || idx}
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#111a1a] hover:bg-[#00d4aa]/10 border border-[#1e2e2e] text-[10px] text-[#a3c2c2] hover:text-[#00d4aa] transition-all font-medium whitespace-nowrap"
              >
                {src.faviconUrl ? (
                  <img
                    src={src.faviconUrl}
                    alt={src.siteName || src.domain}
                    className="w-2.5 h-2.5 rounded-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <SoufGlobeIcon size={10} />
                )}
                <span>{src.siteName || src.domain}</span>
              </a>
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
