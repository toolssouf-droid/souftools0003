"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  Sparkles,
  Sliders,
  Download,
  Share2,
  RefreshCw,
  Zap,
  Layers,
  Loader2,
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";

interface ImagesClientPageProps {
  locale: string;
}

export function ImagesClientPage({ locale }: ImagesClientPageProps) {
  const isRtl = isRtlLocale(locale);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [style, setStyle] = useState("cyberpunk");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  const samplePrompts = [
    isRtl ? "بوابة زمردية ثلاثية الأبعاد تنبض بالطاقة في سماء ليلية مستقبلية" : "3D emerald cyber portal glowing with energy in a futuristic sky",
    isRtl ? "بلورة ذكاء اصطناعي مشعة فوق مدينة فاس ومكناس الرقمية" : "Luminous AI crystal floating over futuristic Moroccan cyber-city",
    isRtl ? "شريحة عصبية ثلاثية الأبعاد بأسلوب نيون متقدم وألوان سيبرانية" : "3D neural microchip with neon circuit traces and cybernetic glow",
  ];

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    setIsLoading(true);

    // Dynamic generation simulation
    setTimeout(() => {
      setIsLoading(false);
      setGeneratedImages([
        `https://picsum.photos/seed/${encodeURIComponent(prompt + "1")}/800/800`,
        `https://picsum.photos/seed/${encodeURIComponent(prompt + "2")}/800/800`,
      ]);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30">
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "استوديو الصور والفيديو وتوليد المشاهد" : "Vision & Generative Imagery Studio"}
        subtitle={isRtl ? "تحويل الأفكار إلى تصاميم بصرية فائقة الدقة" : "Neural image synthesis and creative renders"}
        icon={<ImageIcon className="w-4 h-4" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="images"
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRtl ? "توليد الصور والفيديو" : "Image & Video Generation"}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#e8f5f5]">
            {isRtl ? "تحويل الأفكار إلى تصاميم بصرية فائقة الجمال" : "AI Neural Vision & Image Synthesis"}
          </h1>
          <p className="text-xs sm:text-sm text-[#88b0b0]">
            {isRtl
              ? "اكتب وصفك النصي واختر النمط ونسبة العرض للحصول على لوحات فنية وأصول رقمية فورية."
              : "Describe your creative vision and render high-resolution assets in seconds."}
          </p>
        </div>

        {/* PROMPT & CONTROLS BOX */}
        <div className="glass-card rounded-3xl border border-[#1e2e2e] bg-[#0d1414] shadow-2xl p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#e8f5f5] flex items-center justify-between">
              <span>{isRtl ? "الوصف النصي للصورة" : "Image Prompt"}</span>
              <span className="text-[10px] text-[#00d4aa]">{isRtl ? "دعم كامل للغة العربية" : "Full Arabic Support"}</span>
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={isRtl ? "صف ما ترغب في رؤيته بالتفصيل..." : "Describe what you want to create in detail..."}
                className="w-full bg-[#111a1a] border border-[#1e2e2e] focus:border-[#00d4aa] rounded-2xl p-4 text-xs sm:text-sm text-[#e8f5f5] placeholder-[#4a7070] resize-none outline-none leading-relaxed"
                rows={3}
              />
            </div>

            {/* QUICK SUGGESTIONS */}
            <div className="flex flex-wrap gap-2 pt-1">
              {samplePrompts.map((sp, idx) => (
                <button
                  key={idx}
                  onClick={() => setPrompt(sp)}
                  className="text-[10px] px-3 py-1 rounded-lg bg-[#111a1a] border border-[#1e2e2e] text-[#88b0b0] hover:text-[#00d4aa] hover:border-[#00d4aa]/40 transition-colors"
                >
                  ⚡ {sp.slice(0, 35)}...
                </button>
              ))}
            </div>
          </div>

          {/* SETTINGS (RATIO & STYLE) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1e2e2e]">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#88b0b0]">{isRtl ? "أبعاد الصورة (Aspect Ratio)" : "Aspect Ratio"}</label>
              <div className="flex gap-2">
                {["1:1", "16:9", "9:16", "4:3"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setAspectRatio(r)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      aspectRatio === r ? "bg-[#00d4aa] text-[#0a0f0f] border-[#00d4aa]" : "bg-[#111a1a] text-[#88b0b0] border-[#1e2e2e]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#88b0b0]">{isRtl ? "النمط البصري (Art Style)" : "Art Style"}</label>
              <div className="flex gap-2">
                {[
                  { id: "cyberpunk", name: isRtl ? "سايبر 3D" : "Cyber 3D" },
                  { id: "realistic", name: isRtl ? "واقعي" : "Photoreal" },
                  { id: "anime", name: isRtl ? "أنيمي" : "Anime" },
                  { id: "oil", name: isRtl ? "فني" : "Artistic" },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      style === s.id ? "bg-[#0ea5e9] text-white border-[#0ea5e9]" : "bg-[#111a1a] text-[#88b0b0] border-[#1e2e2e]"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex justify-center pt-3">
            <button
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="px-8 py-3 rounded-2xl bg-[#00d4aa] hover:bg-[#00ff88] text-[#0a0f0f] font-extrabold text-xs sm:text-sm shadow-xl shadow-[#00d4aa]/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isRtl ? "توليد الصورة الآن" : "Generate Visual"}</span>
            </button>
          </div>
        </div>

        {/* RESULTS GRID */}
        {generatedImages.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-[#e8f5f5] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00d4aa]" />
              <span>{isRtl ? "النتائج المولدة بدقة فائقة" : "Rendered Results"}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {generatedImages.map((src, i) => (
                <div key={i} className="rounded-2xl border border-[#1e2e2e] bg-[#111a1a] p-3 space-y-3">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-black/50">
                    <img src={src} alt="Generated visual" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#88b0b0]">{aspectRatio} • {style}</span>
                    <a
                      href={src}
                      download={`souftools-${i}.jpg`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 flex items-center gap-1 hover:bg-[#00d4aa] hover:text-[#0a0f0f] transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isRtl ? "تحميل" : "Download"}</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#1e2e2e] bg-[#080d0d] py-6 px-4 text-center text-xs text-[#4a7070]">
        SoufTools Platform © 2026. All rights reserved.
      </footer>
    </div>
  );
}
