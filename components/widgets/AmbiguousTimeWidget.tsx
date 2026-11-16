"use client";

import React from "react";
import { motion } from "motion/react";
import { MapPin, Sparkles, Navigation } from "lucide-react";
import { useChatStore } from "@/store/chatStore";

interface AmbiguousTimeWidgetProps {
  data: {
    countryName?: string;
    questionPrompt?: string;
    suggestedCities?: { nameAr: string; nameEn: string; query: string }[];
  };
  isRtl?: boolean;
}

export const AmbiguousTimeWidget: React.FC<AmbiguousTimeWidgetProps> = ({ data, isRtl = true }) => {
  // No-op

  const handleCityClick = (query: string) => {
    // Fill input or trigger message directly via form submit
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = query;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      // Trigger submit button click if available
      const submitBtn = textarea.closest("form")?.querySelector("button[type='submit']") as HTMLButtonElement;
      if (submitBtn) {
        submitBtn.click();
      }
    }
  };

  const cities = data.suggestedCities || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-3.5 p-4 rounded-2xl border border-[#eab308]/40 bg-gradient-to-b from-[#181408] to-[#0c0a04] shadow-lg max-w-lg mx-auto text-[#e8f5f5]"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-2.5 mb-2.5 text-[#eab308]">
        <MapPin className="w-5 h-5 shrink-0" />
        <h4 className="font-bold text-sm sm:text-base">
          {data.countryName
            ? `تحديد المنطقة الزمنية (${data.countryName})`
            : "اختر المدينة المطلوبة"}
        </h4>
      </div>

      <p className="text-xs sm:text-sm text-[#d0c090] mb-3.5 leading-relaxed">
        {data.questionPrompt || "تحتوي هذه الدولة على مناطق زمنية متعددة. الرجاء اختيار المدينة لتحديد التوقيت المباشر الدقيق:"}
      </p>

      <div className="flex flex-wrap gap-2 pt-1">
        {cities.map((c, idx) => (
          <button
            key={`city-chip-${idx}`}
            onClick={() => handleCityClick(c.query)}
            className="px-3.5 py-2 rounded-xl bg-[#28200c] hover:bg-[#382d12] border border-[#eab308]/50 text-[#fff5d0] hover:text-[#ffffff] text-xs font-semibold transition-all duration-200 flex items-center gap-2 shadow-sm hover:scale-105 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-[#eab308]" />
            <span>{c.nameAr}</span>
            {c.nameEn && (
              <span className="text-[10px] text-[#a09060] font-mono">({c.nameEn})</span>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
};
