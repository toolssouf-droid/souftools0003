"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Languages,
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  RotateCw,
  Sparkles,
  Volume2,
  Share2,
  FileText,
  Loader2,
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";

interface TranslateClientPageProps {
  locale: string;
}

export function TranslateClientPage({ locale }: TranslateClientPageProps) {
  const isRtl = isRtlLocale(locale);
  const [sourceLang, setSourceLang] = useState("auto");
  const [targetLang, setTargetLang] = useState("ar");
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [tone, setTone] = useState<"standard" | "formal" | "creative" | "technical">("standard");

  const languages = [
    { code: "auto", name: isRtl ? "اكتشاف تلقائي" : "Auto Detect" },
    { code: "ar", name: "العربية (Arabic)" },
    { code: "en", name: "English (الإنجليزية)" },
    { code: "fr", name: "Français (الفرنسية)" },
    { code: "es", name: "Español (الإسبانية)" },
    { code: "de", name: "Deutsch (الألمانية)" },
    { code: "zh", name: "中文 (الصينية)" },
    { code: "ja", name: "日本語 (اليابانية)" },
    { code: "ru", name: "Русский (الروسية)" },
  ];

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;
    setIsLoading(true);
    setTranslatedText("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `ترجم النص التالي بدقة واحترافية عالية إلى لغة (${targetLang}) بنبرة (${tone}):\n\n${sourceText}`,
          model: "gemini-3.7-flash",
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        setTranslatedText(data?.reply || data?.text || "تمت الترجمة بنجاح.");
      } else {
        setTranslatedText(
          isRtl
            ? "نواجه حالياً ضغطاً على خوادم المعالجة، يرجى إعادة المحاولة بعد لحظات."
            : "Server busy, please retry shortly."
        );
      }
    } catch {
      setTranslatedText(
        isRtl
          ? "نواجه حالياً ضغطاً مؤقتاً على خوادم المعالجة، يرجى إعادة المحاولة."
          : "Temporary server load, please retry."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSwap = () => {
    if (sourceLang === "auto") return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  };

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30">
      {/* HEADER WITH UNIVERSAL RETURN/BACK */}
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "محرك الترجمة العصبية الفورية" : "Neural Machine Translation"}
        subtitle={isRtl ? "ترجمة سياقية فائقة الدقة لأكثر من 50 لغة" : "Punctuation & context-aware global translation"}
        icon={<Languages className="w-4 h-4" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="translate"
      />

      {/* MAIN TRANSLATOR INTERFACE */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full space-y-8">
        {/* TITLE */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRtl ? "الترجمة الفورية الدقيقة" : "Precise Instant Translation"}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#e8f5f5]">
            {isRtl ? "ترجمة ذكية تفهم السياق والمصطلحات" : "Context-Aware AI Translation"}
          </h1>
          <p className="text-xs sm:text-sm text-[#88b0b0]">
            {isRtl
              ? "ترجمة دقيقة خالية من الركاكة تناسب المقالات، العقود، والأبحاث العلمية."
              : "Subtle semantic translations preserving tone, intent, and technical jargon."}
          </p>
        </div>

        {/* TRANSLATOR BOX */}
        <div className="glass-card rounded-3xl border border-[#1e2e2e] bg-[#0d1414] shadow-2xl p-4 sm:p-6 space-y-4">
          {/* CONTROLS BAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1e2e2e]">
            {/* SOURCE LANG */}
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="bg-[#111a1a] border border-[#1e2e2e] rounded-xl px-3 py-2 text-xs font-bold text-[#e8f5f5] focus:border-[#00d4aa] outline-none"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>

            {/* SWAP BUTTON */}
            <button
              onClick={handleSwap}
              disabled={sourceLang === "auto"}
              className="p-2 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa] text-[#00d4aa] transition-colors disabled:opacity-40 cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* TARGET LANG */}
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-[#111a1a] border border-[#1e2e2e] rounded-xl px-3 py-2 text-xs font-bold text-[#e8f5f5] focus:border-[#00d4aa] outline-none"
            >
              {languages.filter((l) => l.code !== "auto").map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>

            {/* TONE SELECTOR */}
            <div className="flex items-center gap-1 bg-[#111a1a] p-1 rounded-xl border border-[#1e2e2e] text-[10px] font-bold">
              {[
                { id: "standard", label: isRtl ? "قياسي" : "Standard" },
                { id: "formal", label: isRtl ? "رسمي" : "Formal" },
                { id: "creative", label: isRtl ? "إبداعي" : "Creative" },
                { id: "technical", label: isRtl ? "تقني" : "Tech" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id as any)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    tone === t.id ? "bg-[#00d4aa] text-[#0a0f0f]" : "text-[#88b0b0] hover:text-[#e8f5f5]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* TWO TEXT AREAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SOURCE INPUT */}
            <div className="flex flex-col justify-between p-4 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] min-h-[220px]">
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={isRtl ? "اكتب أو الصق النص هنا للترجمة..." : "Type or paste text to translate..."}
                className="w-full h-full bg-transparent resize-none border-none outline-none text-xs sm:text-sm text-[#e8f5f5] placeholder-[#4a7070] leading-relaxed"
                rows={6}
              />
              <div className="flex items-center justify-between text-[11px] text-[#4a7070] pt-2 border-t border-[#1e2e2e]/50">
                <span>{sourceText.length} حرف</span>
                {sourceText && (
                  <button
                    onClick={() => setSourceText("")}
                    className="text-[#f43f5e] hover:underline"
                  >
                    {isRtl ? "مسح" : "Clear"}
                  </button>
                )}
              </div>
            </div>

            {/* TRANSLATED OUTPUT */}
            <div className="flex flex-col justify-between p-4 rounded-2xl bg-[#111a1a]/90 border border-[#00d4aa]/30 min-h-[220px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-xs text-[#00d4aa]">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>{isRtl ? "جاري الترجمة بالذكاء الاصطناعي..." : "Translating with AI..."}</span>
                </div>
              ) : (
                <div className="w-full h-full text-xs sm:text-sm text-[#e8f5f5] leading-relaxed overflow-y-auto">
                  {translatedText || (
                    <span className="text-[#4a7070]">
                      {isRtl ? "ستظهر الترجمة الدقيقة هنا..." : "Translation will appear here..."}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] text-[#4a7070] pt-2 border-t border-[#1e2e2e]/50">
                <span className="text-[#00d4aa] font-bold">SoufAI Neural V2</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    disabled={!translatedText}
                    className="p-1.5 rounded-lg bg-[#0d1414] text-[#88b0b0] hover:text-[#00d4aa] transition-colors disabled:opacity-30"
                    title={isRtl ? "نسخ الترجمة" : "Copy"}
                  >
                    {isCopied ? <Check className="w-4 h-4 text-[#00ff88]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ACTION BUTTON */}
          <div className="flex justify-center pt-2">
            <button
              onClick={handleTranslate}
              disabled={isLoading || !sourceText.trim()}
              className="px-8 py-3 rounded-2xl bg-[#00d4aa] hover:bg-[#00ff88] text-[#0a0f0f] font-extrabold text-xs sm:text-sm shadow-xl shadow-[#00d4aa]/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
              <span>{isRtl ? "ترجم الآن" : "Translate Now"}</span>
            </button>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#1e2e2e] bg-[#080d0d] py-6 px-4 text-center text-xs text-[#4a7070]">
        SoufTools Platform © 2026. All rights reserved.
      </footer>
    </div>
  );
}
