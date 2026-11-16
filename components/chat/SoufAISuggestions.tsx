"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  X,
  Check,
  Send,
  Sparkles,
  HelpCircle,
  Target,
  CheckSquare,
  Square,
  ArrowLeft,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { SoufAISuggestionItem } from "@/store/chatStore";
import { isRtlLocale } from "@/lib/i18n";

interface SoufAISuggestionsProps {
  suggestions?: SoufAISuggestionItem[];
  questionTitle?: string;
  alreadySelected?: string[];
  onSelectSuggestions: (selectedItems: SoufAISuggestionItem[], customAnswer?: string) => void;
  locale?: string;
  isGenerating?: boolean;
}

export const SoufAISuggestions: React.FC<SoufAISuggestionsProps> = ({
  suggestions = [],
  questionTitle,
  alreadySelected = [],
  onSelectSuggestions,
  locale = "ar",
  isGenerating = false,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [isClosed, setIsClosed] = useState(false);

  if (isClosed || !suggestions || suggestions.length === 0) return null;

  const isRtl = isRtlLocale(locale);
  const hasSubmittedBefore = alreadySelected && alreadySelected.length > 0;

  // Determine if this set of options leans towards Multiple Choice vs Single Choice
  const isMultipleChoiceMode = suggestions.some(
    (s) => s.type === "multichoice" || (s.description && s.description.includes("أكثر"))
  );

  const toggleOption = (item: SoufAISuggestionItem) => {
    if (isGenerating || hasSubmittedBefore) return;

    if (isMultipleChoiceMode) {
      setSelectedIds((prev) =>
        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
      );
    } else {
      setSelectedIds([item.id]);
      handleSend([item]);
    }
  };

  const handleSend = (overrideSelected?: SoufAISuggestionItem[] | any) => {
    if (isGenerating || hasSubmittedBefore) return;

    const isOverrideArray = Array.isArray(overrideSelected);
    const trimmedCustom = customInput.trim();
    const selectedObjs = isOverrideArray ? overrideSelected : suggestions.filter((s) => selectedIds.includes(s.id));

    if (selectedObjs.length === 0 && !trimmedCustom) return;

    onSelectSuggestions(selectedObjs, trimmedCustom);
    setCustomInput("");
  };

  const mainTitle =
    questionTitle ||
    suggestions[0]?.questionTitle ||
    (isMultipleChoiceMode
      ? isRtl
        ? "ما هي المجالات التي تود استكشافها؟ (اختر أكثر من واحد)"
        : "Which topics would you like to explore? (Select multiple)"
      : isRtl
      ? "ما هو الخيار الذي تود التركيز عليه؟"
      : "Which option would you like to focus on?");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="my-5 mx-auto max-w-lg w-full relative group"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Outer Glowing Neon Border Glassmorphism Modal Frame (Exact SoufTools Identity from Images 3 & 4) */}
      <div className="relative rounded-3xl p-5 bg-[#071414]/95 backdrop-blur-2xl border-2 border-[#00ff88]/60 shadow-[0_0_40px_rgba(0,255,136,0.22)] space-y-4 overflow-hidden select-none">
        {/* Subtle Ambient Radial Backlight Accent */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-[#00ff88]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#00d4aa]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-[#1e3e3b]/60 relative z-10">
          {/* Close Button */}
          <button
            type="button"
            onClick={() => setIsClosed(true)}
            className="w-7 h-7 rounded-xl bg-[#0e2220] hover:bg-[#163632] border border-[#1e3e3b] text-[#4a7070] hover:text-[#00ff88] transition-colors flex items-center justify-center cursor-pointer"
            title={isRtl ? "إغلاق النافذة" : "Close modal"}
          >
            <X className="w-4 h-4" />
          </button>

          {/* SoufTools Branding Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0d2824] border border-[#00ff88]/40 shadow-sm shadow-[#00ff88]/10">
            <Zap className="w-3.5 h-3.5 text-[#00ff88] fill-[#00ff88] animate-pulse" />
            <span className="text-xs font-black text-[#00ff88] tracking-wide">SoufTools</span>
            <Target className="w-3 h-3 text-[#00d4aa]" />
          </div>
        </div>

        {/* Question Title Header */}
        <div className="space-y-1 text-center sm:text-right relative z-10">
          <h3 className="text-base sm:text-lg font-black text-[#e8f5f5] leading-snug tracking-tight">
            {mainTitle}
          </h3>
          <p className="text-[11px] text-[#00d4aa] font-bold flex items-center gap-1 justify-center sm:justify-start">
            <Sparkles className="w-3 h-3 text-[#00ff88]" />
            <span>
              {hasSubmittedBefore
                ? isRtl
                  ? "تم تسجيل إجابتك واستجابة الوكيل الذكي بنجاح"
                  : "Your selection has been submitted"
                : isMultipleChoiceMode
                ? isRtl
                  ? "يمكنك تحديد أكثر من اختيار ثم الضغط على إرسال"
                  : "You can select multiple options then click Submit"
                : isRtl
                ? "اختر الإجابة المناسبة لك أو اكتب إجابتك الخاصة"
                : "Select your preferred choice or type your answer"}
            </span>
          </p>
        </div>

        {/* Submitted Status Banner */}
        {hasSubmittedBefore && (
          <div className="p-3 rounded-2xl bg-[#0d2824] border border-[#00ff88] flex items-center justify-between text-xs text-[#00ff88] shadow-inner relative z-10">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#00ff88] shrink-0" />
              <span className="font-bold">
                {isRtl ? "إجابتك المسجلة:" : "Your Selected Answer:"}{" "}
                <span className="text-white font-extrabold">{alreadySelected.join(" + ")}</span>
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#071414] border border-[#00ff88]/30 text-[#00d4aa]">
              {isRtl ? "تم الإرسال" : "Submitted"}
            </span>
          </div>
        )}

        {/* Interactive Options List (Images 1, 2, 3 & 4 Layout) */}
        {!hasSubmittedBefore && (
          <div className="space-y-2.5 relative z-10 pt-1">
            {suggestions.map((item, index) => {
              const isSelected = selectedIds.includes(item.id);
              const optionNumber = index + 1;

              return (
                <motion.div
                  key={item.id || `opt_${index}`}
                  whileHover={{ scale: isGenerating ? 1 : 1.015 }}
                  whileTap={{ scale: isGenerating ? 1 : 0.985 }}
                  onClick={() => toggleOption(item)}
                  className={`p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 text-right shadow-md ${
                    isSelected
                      ? "bg-[#00d4aa] border-[#00ff88] text-[#0a0f0f] shadow-[0_0_20px_rgba(0,212,170,0.4)] ring-2 ring-[#00ff88]/80"
                      : "bg-[#091a18] hover:bg-[#0d2220] border-[#1e3e3b] text-[#e8f5f5] hover:border-[#00d4aa]/60"
                  } ${isGenerating ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {/* Option Label Text */}
                  <div className="flex-1 space-y-0.5">
                    <div
                      className={`text-sm font-extrabold leading-snug ${
                        isSelected ? "text-[#0a0f0f]" : "text-[#e8f5f5]"
                      }`}
                    >
                      {item.title}
                    </div>
                    {item.description && (
                      <div
                        className={`text-[11px] line-clamp-1 ${
                          isSelected ? "text-[#072420] font-bold" : "text-[#4a7070]"
                        }`}
                      >
                        {item.description}
                      </div>
                    )}
                  </div>

                  {/* Indicator: Numbered Pill or Checkbox */}
                  {isMultipleChoiceMode ? (
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                        isSelected
                          ? "bg-[#0a0f0f] text-[#00ff88] border-[#0a0f0f]"
                          : "bg-[#071414] border-[#1e3e3b] text-[#4a7070]"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#2a4d48]" />
                      )}
                    </div>
                  ) : (
                    <div
                      className={`w-8 h-8 rounded-xl font-mono text-xs font-black flex items-center justify-center shrink-0 border transition-all ${
                        isSelected
                          ? "bg-[#0a0f0f] text-[#00ff88] border-[#0a0f0f] shadow-inner scale-105"
                          : "bg-[#0d2824] border-[#1e3e3b] text-[#00d4aa]"
                      }`}
                    >
                      {optionNumber}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Custom Input & Submit Action Bar ("اكتب إجابتك..." + "إرسال") */}
        {!hasSubmittedBefore && (
          <div className="pt-2 border-t border-[#1e3e3b]/60 relative z-10 flex items-center gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              disabled={isGenerating}
              placeholder={isRtl ? "اكتب إجابتك..." : "Type your own answer..."}
              className="flex-1 bg-[#091a18] border border-[#1e3e3b] focus:border-[#00ff88] focus:bg-[#0c2421] text-xs text-[#e8f5f5] placeholder-[#4a7070] px-4 py-3 rounded-2xl outline-none transition-all"
              dir={isRtl ? "rtl" : "ltr"}
            />

            <motion.button
              whileHover={{ scale: isGenerating ? 1 : 1.03 }}
              whileTap={{ scale: isGenerating ? 1 : 0.97 }}
              type="button"
              onClick={handleSend}
              disabled={isGenerating || (selectedIds.length === 0 && !customInput.trim())}
              className="px-6 py-3 rounded-2xl bg-[#00d4aa] hover:bg-[#00ff88] active:bg-[#00d4aa] text-[#0a0f0f] font-black text-xs shadow-lg shadow-[#00d4aa]/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 border border-[#00ff88] shrink-0"
            >
              <span>{isRtl ? "إرسال" : "Submit"}</span>
              <Send className="w-3.5 h-3.5 text-[#0a0f0f] shrink-0" />
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
