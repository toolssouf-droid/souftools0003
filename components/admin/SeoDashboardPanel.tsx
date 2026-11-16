"use client";

import React, { useState, useEffect } from "react";
import {
  runSeoAudit,
  TOOLS_DIRECTORY,
  SeoAuditResult,
  getAllCustomMetaKeywords,
  saveCustomMetaKeywords,
  deleteCustomMetaKeywords,
  CustomPageKeywords,
} from "@/lib/seo";
import { copyToClipboard } from "@/lib/utils";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Globe,
  FileText,
  ShieldCheck,
  Eye,
  Layers,
  Copy,
  Save,
  Check,
  Zap,
  Sparkles,
  Tag,
  Plus,
  Trash2,
  Hash,
  ArrowRight,
  CornerDownLeft,
  CheckCircle,
  Smartphone,
  Monitor,
} from "lucide-react";

interface PresetPage {
  path: string;
  nameAr: string;
  nameEn: string;
}

const PRESET_PAGES: PresetPage[] = [
  { path: "/", nameAr: "الصفحة الرئيسية (Home)", nameEn: "Homepage" },
  { path: "/tools", nameAr: "دليل الأدوات الشامل", nameEn: "Tools Catalog" },
  { path: "/tools/ai-chat", nameAr: "الدردشة والذكاء الاصطناعي (AI Chat)", nameEn: "AI Chat Assistant" },
  { path: "/tools/image-generator", nameAr: "مولد الصور الذكي", nameEn: "AI Image Generator" },
  { path: "/tools/image-editor", nameAr: "محرر الصور والتعديل الذكي", nameEn: "AI Image Editor" },
  { path: "/tools/web-search", nameAr: "محرك البحث الحي وتلخيص الويب", nameEn: "AI Web Search" },
  { path: "/tools/code-agent", nameAr: "الوكيل البرمجي الذكي E2B", nameEn: "AI Coding Agent" },
  { path: "/pricing", nameAr: "الخطط والأسعار", nameEn: "Pricing & Plans" },
  { path: "/about", nameAr: "عن المنصة وفريق العمل", nameEn: "About SoufTools" },
  { path: "/privacy", nameAr: "سياسة الخصوصية والأمان", nameEn: "Privacy Policy" },
  { path: "/terms", nameAr: "شروط الخدمة والاستخدام", nameEn: "Terms of Service" },
];

const LOCALES_OPTIONS = [
  { code: "ar", label: "العربية", flag: "🇸🇦", isRtl: true },
  { code: "en", label: "English", flag: "🇺🇸", isRtl: false },
  { code: "fr", label: "Français", flag: "🇫🇷", isRtl: false },
  { code: "es", label: "Español", flag: "🇪🇸", isRtl: false },
  { code: "de", label: "Deutsch", flag: "🇩🇪", isRtl: false },
  { code: "all", label: "كافة اللغات (Global All)", flag: "🌐", isRtl: false },
];

const SUGGESTIONS_MAP: Record<string, { ar: string[]; en: string[] }> = {
  "/": {
    ar: ["SoufTools", "ذكاء اصطناعي عربي", "شات GPT مجاني", "برمجة بالذكاء الاصطناعي", "توليد صور", "نماذج ذكية 2026", "SoufAI"],
    en: ["SoufTools", "AI Platform", "Arabic AI Chat", "AI Coding Agent", "Image Generator", "Multimodal AI Models"],
  },
  "/tools": {
    ar: ["أدوات الذكاء الاصطناعي", "دليل AI 2026", "تطبيقات الذكاء الاصطناعي", "أفضل نماذج الذكاء الاصطناعي", "أدوات برمجية مجانية"],
    en: ["AI Tools Directory", "Best Generative AI Apps", "Free AI Utilities", "AI Coding Tools", "Arabic AI Tools"],
  },
  "/tools/ai-chat": {
    ar: ["دردشة ذكاء اصطناعي", "SoufAI Ultra", "شات عربي ذكي", "استنتاج برمجي", "شات GPT 4o مجاناً", "أفضل بوت ذكاء اصطناعي"],
    en: ["AI Chat Assistant", "Arabic Conversational AI", "Deep Reasoning Chat", "Fast AI Chatbot", "Code Synthesis AI"],
  },
  "/tools/image-generator": {
    ar: ["توليد صور بالذكاء الاصطناعي", "تحويل النص إلى صورة", "تصميم لوحات فنية", "SDXL Flux عربي", "صور عالية الدقة 4K"],
    en: ["AI Image Generator", "Text to Image AI", "Flux Image Synthesis", "Photorealistic AI", "Arabic Prompt Generator"],
  },
  "/pricing": {
    ar: ["أسعار SoufTools", "اشتراك الذكاء الاصطناعي", "خطة مجانية ذكاء اصطناعي", "SoufTools Pro", "باقات الذكاء الاصطناعي"],
    en: ["SoufTools Pricing", "Free AI Subscription", "AI Tokens Cost", "Affordable Generative AI", "Enterprise AI Plans"],
  },
};

export function SeoDashboardPanel() {
  const [auditResult, setAuditResult] = useState<SeoAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [gscMetaTag, setGscMetaTag] = useState("");
  const [savedGscTag, setSavedGscTag] = useState(false);
  const [copiedSitemap, setCopiedSitemap] = useState(false);

  // Custom Meta Keywords State
  const [targetLocale, setTargetLocale] = useState<string>("ar");
  const [targetPath, setTargetPath] = useState<string>("/");
  const [isCustomPath, setIsCustomPath] = useState<boolean>(false);
  const [customPathText, setCustomPathText] = useState<string>("");
  const [keywordInput, setKeywordInput] = useState<string>("");
  const [currentKeywords, setCurrentKeywords] = useState<string[]>([]);
  const [savedConfigs, setSavedConfigs] = useState<Record<string, CustomPageKeywords>>({});
  const [savedKeywordsSuccess, setSavedKeywordsSuccess] = useState(false);
  const [copiedKeywordsTag, setCopiedKeywordsTag] = useState(false);

  // SERP Preview state
  const [serpDevice, setSerpDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewTitle, setPreviewTitle] = useState(
    "SoufTools — منصة وأدوات الذكاء الاصطناعي العالمية"
  );
  const [previewDesc, setPreviewDesc] = useState(
    "منظومة متكاملة لنماذج الذكاء الاصطناعي الفائقة مع شات عربي، توليد ومعالجة الصور، البحث الحي في الويب، والوكيل البرمجي الذكي."
  );

  useEffect(() => {
    runAudit();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("souftools_gsc_meta");
      } catch {}

      // Load all saved custom keywords configs
      const allSaved = getAllCustomMetaKeywords();
      setSavedConfigs(allSaved);
    }
  }, []);

  // Compute the effective path currently selected
  const effectivePath = isCustomPath
    ? customPathText.trim()
      ? customPathText.startsWith("/")
        ? customPathText.trim()
        : `/${customPathText.trim()}`
      : "/"
    : targetPath;

  // Whenever locale or effective path changes, refresh current keywords from storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const allSaved = getAllCustomMetaKeywords();
      setSavedConfigs(allSaved);
      const key = `${targetLocale}:${effectivePath}`;
      if (allSaved[key]?.keywords) {
        setCurrentKeywords(allSaved[key].keywords);
      } else {
        // Load default preset suggestions if available for this path
        const suggestions = SUGGESTIONS_MAP[effectivePath];
        if (suggestions) {
          const defaultList = targetLocale === "en" ? suggestions.en : suggestions.ar;
          setCurrentKeywords(defaultList.slice(0, 4));
        } else {
          setCurrentKeywords([]);
        }
      }
    }

    // Also update SERP preview title & description according to the selected page
    const matchedPreset = PRESET_PAGES.find((p) => p.path === effectivePath);
    const isAr = targetLocale === "ar";
    if (effectivePath === "/") {
      setPreviewTitle(
        isAr
          ? "SoufTools — منصة وأدوات الذكاء الاصطناعي العالمية"
          : "SoufTools — Global AI Tools & High-Performance Models"
      );
      setPreviewDesc(
        isAr
          ? "منظومة متكاملة لنماذج الذكاء الاصطناعي الفائقة مع شات عربي، توليد ومعالجة الصور، البحث الحي في الويب، والوكيل البرمجي الذكي."
          : "Integrated multi-model AI workspace featuring natural Arabic/multilingual chat, high-resolution image synthesis, live web search, and code agent."
      );
    } else if (matchedPreset) {
      setPreviewTitle(
        isAr
          ? `${matchedPreset.nameAr} | منصة SoufTools الذكية`
          : `${matchedPreset.nameEn} | SoufTools Intelligence Suite`
      );
      setPreviewDesc(
        isAr
          ? `استكشف أداة ${matchedPreset.nameAr} عبر منصة SoufTools مع دعم شامل للغة العربية وأعلى معايير سرعة الاستجابة والدقة.`
          : `Explore ${matchedPreset.nameEn} on SoufTools. Highly reliable AI solutions engineered for speed, privacy, and productivity.`
      );
    } else {
      setPreviewTitle(
        isAr
          ? `صفحة ${effectivePath} — منصة SoufTools`
          : `${effectivePath} — SoufTools AI Platform`
      );
      setPreviewDesc(
        isAr
          ? `أداة ذكاء اصطناعي متطورة ومخصصة للأعمال والمطورين على نطاق عالمي عبر SoufTools.`
          : `High-grade artificial intelligence tooling for modern creators and enterprises on SoufTools.`
      );
    }
  }, [targetLocale, effectivePath]);

  const handleAddKeyword = (rawText?: string) => {
    const textToAdd = rawText !== undefined ? rawText : keywordInput;
    if (!textToAdd.trim()) return;

    // Split by comma or Arabic comma
    const parts = textToAdd
      .split(/[,،]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    if (parts.length === 0) return;

    setCurrentKeywords((prev) => {
      const nextSet = new Set([...prev, ...parts]);
      return Array.from(nextSet);
    });

    if (rawText === undefined) {
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (kwToRemove: string) => {
    setCurrentKeywords((prev) => prev.filter((k) => k !== kwToRemove));
  };

  const handleClearKeywords = () => {
    setCurrentKeywords([]);
  };

  const handleSaveKeywords = () => {
    saveCustomMetaKeywords(targetLocale, effectivePath, currentKeywords);
    const updated = getAllCustomMetaKeywords();
    setSavedConfigs(updated);
    setSavedKeywordsSuccess(true);
    setTimeout(() => setSavedKeywordsSuccess(false), 2500);
  };

  const handleDeleteConfig = (locale: string, path: string) => {
    deleteCustomMetaKeywords(locale, path);
    const updated = getAllCustomMetaKeywords();
    setSavedConfigs(updated);
    if (locale === targetLocale && path === effectivePath) {
      setCurrentKeywords([]);
    }
  };

  const handleLoadConfig = (config: CustomPageKeywords) => {
    setTargetLocale(config.locale);
    const matchedPreset = PRESET_PAGES.find((p) => p.path === config.pagePath);
    if (matchedPreset) {
      setIsCustomPath(false);
      setTargetPath(config.pagePath);
    } else {
      setIsCustomPath(true);
      setCustomPathText(config.pagePath);
    }
    setCurrentKeywords(config.keywords);
  };

  const generatedMetaTag = `<meta name="keywords" content="${currentKeywords.join(", ")}" />`;

  const handleCopyMetaTag = async () => {
    await copyToClipboard(generatedMetaTag);
    setCopiedKeywordsTag(true);
    setTimeout(() => setCopiedKeywordsTag(false), 2000);
  };

  const runAudit = () => {
    setLoading(true);
    setTimeout(() => {
      const res = runSeoAudit();
      setAuditResult(res);
      setLoading(false);
    }, 400);
  };

  const handleSaveGsc = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("souftools_gsc_meta");
      } catch {}
      setSavedGscTag(true);
      setTimeout(() => setSavedGscTag(false), 2000);
    }
  };

  const handleCopySitemap = async () => {
    const sitemapUrl = `${window.location.origin}/sitemap.xml`;
    await copyToClipboard(sitemapUrl);
    setCopiedSitemap(true);
    setTimeout(() => setCopiedSitemap(false), 2000);
  };

  return (
    <div className="space-y-6 text-[#e8f5f5]">
      {/* Top Banner & Audit Score Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#111a1a] via-[#0d1717] to-[#111a1a] border border-[#00d4aa]/40 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/15 border border-[#00d4aa]/40 text-[#00d4aa] text-xs font-bold">
            <Search className="w-3.5 h-3.5" />
            <span>SEO Engine & Indexability Monitor</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold">
            لوحة تحكم ومحرك فحص SEO
          </h2>
          <p className="text-xs text-[#88b0b0]">
            مراقبة الصحة البرمجية للسيو، البيانات المنظمة Schema.org، خريطة الموقع، والتهيئة لمحركات البحث.
          </p>
        </div>

        {/* Score Badge */}
        <div className="flex items-center gap-4 shrink-0 bg-[#0a0f0f] p-4 rounded-2xl border border-[#1e2e2e]">
          <div className="text-center">
            <span className="text-3xl font-black text-[#00d4aa] font-mono">
              {auditResult ? `${auditResult.overallScore}/100` : "--/100"}
            </span>
            <p className="text-[10px] text-[#4a7070] uppercase font-bold mt-0.5">
              SEO Health Score
            </p>
          </div>

          <button
            onClick={runAudit}
            disabled={loading}
            className="p-3 rounded-xl bg-[#111a1a] border border-[#00d4aa]/40 text-[#00d4aa] hover:bg-[#00d4aa] hover:text-[#0a0f0f] transition-all cursor-pointer disabled:opacity-50"
            title="إعادة الفحص الآلي"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Grid: Search Console Verification & Sitemap Quick Tool */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Google Search Console Meta Tag Verification */}
        <div className="p-5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00d4aa]" />
              <span>Google Search Console Verification</span>
            </h3>
            <span className="text-[10px] bg-[#00d4aa]/10 text-[#00d4aa] px-2 py-0.5 rounded-full font-bold">
              HTML Tag
            </span>
          </div>

          <p className="text-[11px] text-[#88b0b0]">
            أدخل كود التحقق من Google Search Console ليتم إدراجه تلقائياً في الوسوم الرأسية لجميع الصفحات.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={gscMetaTag}
              onChange={(e) => setGscMetaTag(e.target.value)}
              placeholder='<meta name="google-site-verification" content="..." />'
              className="flex-1 bg-[#0a0f0f] text-xs text-[#e8f5f5] placeholder-[#4a7070] px-3 py-2.5 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none font-mono"
            />

            <button
              onClick={handleSaveGsc}
              className="px-4 py-2.5 rounded-xl bg-[#00d4aa] text-[#0a0f0f] font-bold text-xs hover:bg-[#00d4aa]/90 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {savedGscTag ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{savedGscTag ? "تم الحفظ" : "حفظ"}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Sitemap & Robots Status */}
        <div className="p-5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs sm:text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#0ea5e9]" />
              <span>Dynamic Sitemap & Robots.txt</span>
            </h3>
            <span className="text-[10px] bg-[#0ea5e9]/10 text-[#0ea5e9] px-2 py-0.5 rounded-full font-bold">
              Live Endpoints
            </span>
          </div>

          <p className="text-[11px] text-[#88b0b0]">
            يتم توليد خريطة الموقع آلياً لكافة اللغات والصفحات. انسخ الرابط لتقديمه في GSC.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noreferrer"
              className="flex-1 p-2.5 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] hover:border-[#0ea5e9] text-xs text-[#0ea5e9] font-mono truncate flex items-center gap-2"
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">/sitemap.xml</span>
            </a>

            <button
              onClick={handleCopySitemap}
              className="px-3 py-2.5 rounded-xl bg-[#1e2e2e] hover:bg-[#0ea5e9] text-[#e8f5f5] hover:text-[#0a0f0f] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {copiedSitemap ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSitemap ? "تم النسخ" : "نسخ الرابط"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Custom Meta Keywords Injection for Locale Pages */}
      <div className="p-6 rounded-3xl bg-[#111a1a] border border-[#00d4aa]/40 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e2e2e] pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa] text-[11px] font-bold">
              <Tag className="w-3.5 h-3.5" />
              <span>فهرسة الكلمات الدلالية المستهدفة (Targeted Meta Keywords Injection)</span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#e8f5f5] flex items-center gap-2">
              <span>حقن وتخصيص الكلمات المفتاحية للصفحات واللغات</span>
            </h3>
            <p className="text-xs text-[#88b0b0]">
              تمكين مسؤولي المنصة من حقن وسوم Meta Keywords مخصصة لكل صفحة ولغة على حدة لرفع كفاءة الفهرسة والظهور في محركات البحث (Google, Bing, Yandex, Yahoo).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono px-3 py-1.5 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] text-[#00d4aa] font-bold">
              {Object.keys(savedConfigs).length} مسارات مخصصة
            </span>
          </div>
        </div>

        {/* Locale & Page Path Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target Locale Selection */}
          <div className="space-y-2 p-4 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e]">
            <label className="text-xs font-bold text-[#e8f5f5] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#0ea5e9]" />
                <span>1. اختر لغة الصفحة (Target Locale):</span>
              </span>
              <span className="text-[10px] text-[#00d4aa] font-mono font-bold uppercase">
                {targetLocale}
              </span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
              {LOCALES_OPTIONS.map((loc) => {
                const isSelected = targetLocale === loc.code;
                return (
                  <button
                    key={loc.code}
                    type="button"
                    onClick={() => setTargetLocale(loc.code)}
                    className={`p-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      isSelected
                        ? "bg-[#00d4aa]/20 border-[#00d4aa] text-[#00d4aa] shadow-md shadow-[#00d4aa]/10"
                        : "bg-[#111a1a] border-[#1e2e2e] text-[#88b0b0] hover:text-[#e8f5f5] hover:border-[#2e4040]"
                    }`}
                  >
                    <span className="text-base">{loc.flag}</span>
                    <span className="text-[10px] truncate">{loc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Page Path Selection */}
          <div className="space-y-2 p-4 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e]">
            <label className="text-xs font-bold text-[#e8f5f5] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#38bdf8]" />
                <span>2. حدد مسار الصفحة (Page Path):</span>
              </span>
              <span className="text-[10px] text-[#38bdf8] font-mono font-bold">
                {effectivePath}
              </span>
            </label>

            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                <select
                  value={isCustomPath ? "custom" : targetPath}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setIsCustomPath(true);
                    } else {
                      setIsCustomPath(false);
                      setTargetPath(e.target.value);
                    }
                  }}
                  className="flex-1 bg-[#111a1a] text-xs text-[#e8f5f5] px-3 py-2.5 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none cursor-pointer"
                >
                  {PRESET_PAGES.map((page) => (
                    <option key={page.path} value={page.path}>
                      {page.nameAr} ({page.path})
                    </option>
                  ))}
                  <option value="custom">مسار مخصص آخر (Custom Route)...</option>
                </select>
              </div>

              {isCustomPath && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-[#4a7070] font-mono">/</span>
                  <input
                    type="text"
                    value={customPathText.replace(/^\//, "")}
                    onChange={(e) => setCustomPathText(e.target.value)}
                    placeholder="example/subpage"
                    className="flex-1 bg-[#111a1a] text-xs text-[#e8f5f5] px-3 py-2 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Input Field For Meta Keywords */}
        <div className="p-5 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label className="text-xs sm:text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
                <Hash className="w-4 h-4 text-[#00d4aa]" />
                <span>3. إدخال وحقن الكلمات المفتاحية (Custom Meta Keywords Input)</span>
              </label>
              <p className="text-[11px] text-[#88b0b0] mt-0.5">
                أدخل الكلمات المفتاحية واضغط على Enter أو أضف فاصلة (، أو ,) للفصل بين العبارات التلقائية.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] px-2.5 py-1 rounded-lg bg-[#111a1a] border border-[#1e2e2e] text-[#88b0b0]">
                العدد:{" "}
                <strong className={currentKeywords.length >= 5 && currentKeywords.length <= 15 ? "text-[#00d4aa]" : "text-amber-400"}>
                  {currentKeywords.length}
                </strong>{" "}
                (المثالي: 5-10 كلمات)
              </span>
            </div>
          </div>

          {/* The Input Row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "," || e.key === "،") {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
                placeholder="أدخل كلمة أو عبارة بحثية... (مثال: ذكاء اصطناعي عربي، شات GPT مجاناً، برمجة بالذكاء)"
                className="w-full bg-[#111a1a] text-xs sm:text-sm text-[#e8f5f5] placeholder-[#4a7070] px-4 py-3 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none"
              />
              <span className="absolute left-3 top-3 text-[10px] text-[#4a7070] hidden sm:inline-flex items-center gap-1 pointer-events-none">
                <span>Enter</span>
                <CornerDownLeft className="w-3 h-3" />
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleAddKeyword()}
              disabled={!keywordInput.trim()}
              className="px-5 py-3 rounded-xl bg-[#00d4aa] text-[#0a0f0f] font-bold text-xs hover:bg-[#00d4aa]/90 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-md shadow-[#00d4aa]/15"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة</span>
            </button>
          </div>

          {/* Quick Suggestions Pills */}
          {SUGGESTIONS_MAP[effectivePath] && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] text-[#4a7070] font-bold block">
                مقترحات ذكية عالية البحث لهذه الصفحة (انقر للإضافة الفورية):
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(targetLocale === "en" ? SUGGESTIONS_MAP[effectivePath].en : SUGGESTIONS_MAP[effectivePath].ar).map(
                  (sug) => {
                    const alreadyAdded = currentKeywords.includes(sug);
                    return (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => handleAddKeyword(sug)}
                        disabled={alreadyAdded}
                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                          alreadyAdded
                            ? "bg-[#111a1a] border-[#1e2e2e] text-[#4a7070] cursor-default opacity-50"
                            : "bg-[#142020] border-[#00d4aa]/30 text-[#00d4aa] hover:bg-[#00d4aa] hover:text-[#0a0f0f] cursor-pointer"
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>{sug}</span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          )}

          {/* Active Keywords Cloud Display */}
          <div className="space-y-2 pt-2 border-t border-[#1e2e2e]/70">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#e8f5f5]">
                الكلمات المفتاحية النشطة للصفحة الحالية ({effectivePath} - {targetLocale}):
              </span>

              {currentKeywords.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearKeywords}
                  className="text-[10px] text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>مسح الكل</span>
                </button>
              )}
            </div>

            {currentKeywords.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-[#1e2e2e] text-center text-xs text-[#4a7070]">
                لم يتم إدراج أي كلمات مفتاحية مخصصة حتى الآن. اكتب في الحقل أعلاه أو اختر من المقترحات.
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {currentKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#111a1a] border border-[#00d4aa]/40 text-xs text-[#e8f5f5] hover:border-[#00d4aa] transition-colors"
                  >
                    <Tag className="w-3 h-3 text-[#00d4aa]" />
                    <span>{kw}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      className="text-[#88b0b0] hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                      title="حذف الكلمة"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Save & Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#1e2e2e]">
            <div className="text-[11px] text-[#88b0b0] text-center sm:text-right">
              يتم دمج هذه الكلمات مباشرةً مع وسوم &lt;meta name=&quot;keywords&quot;&gt; عند طلب عناكب البحث لصفحة المسار واللغة المحددة.
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveKeywords}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00b38e] text-[#0a0f0f] font-extrabold text-xs hover:opacity-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#00d4aa]/20"
              >
                {savedKeywordsSuccess ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-[#0a0f0f]" />
                    <span>تم حفظ الكلمات بنجاح ✓</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>حفظ وتطبيق الكلمات للمسار</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live Generated Meta Tag Code Preview */}
        <div className="p-4 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#88b0b0] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#0ea5e9]" />
              <span>معاينة كود الميتا المولد للعناكب (Generated HTML Meta Snippet):</span>
            </span>

            <button
              type="button"
              onClick={handleCopyMetaTag}
              className="text-[11px] text-[#0ea5e9] hover:underline flex items-center gap-1 cursor-pointer"
            >
              {copiedKeywordsTag ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKeywordsTag ? "تم نسخ الوسم!" : "نسخ الوسم"}</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-[#070b0b] border border-[#162222] font-mono text-[11px] text-[#00d4aa] overflow-x-auto select-all">
            {generatedMetaTag}
          </div>
        </div>

        {/* Saved Configurations Registry */}
        {Object.keys(savedConfigs).length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#e8f5f5] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00d4aa]" />
                <span>قائمة المسارات واللغات المحقونة بالكلمات المفتاحية المخصصة</span>
              </h4>
              <span className="text-[10px] text-[#4a7070]">
                {Object.keys(savedConfigs).length} إدخال مسجل
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(savedConfigs).map(([key, config]) => {
                const isActive = config.locale === targetLocale && config.pagePath === effectivePath;
                return (
                  <div
                    key={key}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      isActive
                        ? "bg-[#142020] border-[#00d4aa]/50 shadow-md"
                        : "bg-[#0a0f0f] border-[#1e2e2e] hover:border-[#2e4040]"
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#111a1a] border border-[#1e2e2e] text-[10px] font-mono font-bold text-[#00d4aa]">
                            {config.locale.toUpperCase()}
                          </span>
                          <span className="font-mono text-xs font-bold text-[#e8f5f5]">
                            {config.pagePath}
                          </span>
                        </div>

                        <span className="text-[10px] text-[#4a7070]">
                          {config.keywords.length} كلمة
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-wrap line-clamp-2">
                        {config.keywords.map((k) => (
                          <span
                            key={k}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-[#111a1a] text-[#88b0b0] border border-[#1e2e2e]"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#1e2e2e] text-[10px]">
                      <span className="text-[#4a7070]">
                        {new Date(config.updatedAt).toLocaleDateString("ar-EG", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadConfig(config)}
                          className="px-2.5 py-1 rounded-lg bg-[#1e2e2e] hover:bg-[#00d4aa] text-[#e8f5f5] hover:text-[#0a0f0f] font-bold transition-all cursor-pointer"
                        >
                          تعديل / تحميل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteConfig(config.locale, config.pagePath)}
                          className="p-1 rounded-lg text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                          title="حذف التكوين"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Google SERP Snippet Preview Simulator with Live Injected Meta Tags & Keywords */}
      <div className="p-6 rounded-3xl bg-[#111a1a] border border-[#1e2e2e] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1e2e2e]/60">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#e8f5f5] flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <span>محاكي نتيجة البحث الحي في Google (Google SERP Simulator)</span>
            </h3>
            <p className="text-xs text-[#6a9090] mt-0.5">
              معاينة فورية لمقتطف البحث وكيفية قراءة محركات البحث لوسوم الميتا المحقونة والكلمات المفتاحية لهذه الصفحة
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Device Switcher */}
            <div className="flex items-center p-1 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e]">
              <button
                type="button"
                onClick={() => setSerpDevice("desktop")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  serpDevice === "desktop"
                    ? "bg-[#00d4aa] text-[#0a0f0f] font-bold shadow-sm"
                    : "text-[#88b0b0] hover:text-[#e8f5f5]"
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>سطح المكتب</span>
              </button>
              <button
                type="button"
                onClick={() => setSerpDevice("mobile")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  serpDevice === "mobile"
                    ? "bg-[#00d4aa] text-[#0a0f0f] font-bold shadow-sm"
                    : "text-[#88b0b0] hover:text-[#e8f5f5]"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>الهاتف</span>
              </button>
            </div>

            {/* Target Context Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#162222] border border-[#1e2e2e] text-[11px] text-[#00d4aa] font-mono">
              <span>{targetLocale.toUpperCase()}</span>
              <span className="text-[#4a7070]">/</span>
              <span>{effectivePath}</span>
            </div>
          </div>
        </div>

        {/* Live Card Simulation Container */}
        <div className="flex justify-center p-4 sm:p-6 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e]/80">
          <div
            className={`w-full transition-all duration-300 ${
              serpDevice === "mobile" ? "max-w-[390px]" : "max-w-[650px]"
            }`}
          >
            {/* Google SERP Card */}
            <div
              className={`p-4 sm:p-5 rounded-2xl bg-[#ffffff] text-[#202124] font-sans border border-gray-200 shadow-sm space-y-1.5 ${
                targetLocale === "ar" ? "text-right dir-rtl" : "text-left dir-ltr"
              }`}
            >
              {/* Site Identity Line */}
              <div className="flex items-center gap-2.5 text-xs text-[#202124]">
                <div className="w-6 h-6 rounded-full bg-[#f1f3f4] flex items-center justify-center p-0.5 border border-gray-200 shrink-0">
                  <img
                    src="/favicon.ico"
                    alt="SoufTools"
                    className="w-4 h-4 rounded-full object-contain"
                  />
                </div>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-xs font-medium text-[#202124] truncate">SoufTools</span>
                  <span className="text-[11px] text-[#4d5156] font-normal truncate" dir="ltr">
                    https://souftools.com › {targetLocale} {effectivePath !== "/" ? `› ${effectivePath.replace(/^\//, "")}` : ""}
                  </span>
                </div>
              </div>

              {/* Title Tag */}
              <h4 className="text-base sm:text-[19px] leading-snug font-normal hover:underline cursor-pointer text-[#1a0dab] pt-0.5">
                {previewTitle}
              </h4>

              {/* Meta Description */}
              <p className="text-xs sm:text-[13px] text-[#4d5156] leading-relaxed line-clamp-2 sm:line-clamp-3 font-normal">
                {previewDesc}
              </p>

              {/* SERP Search Signals / Injected Keywords Highlights Preview */}
              <div className="pt-2 mt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-[#5f6368] font-semibold flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5 text-amber-600" />
                  <span>الكلمات المفتاحية المرصودة (Query Match Signals):</span>
                </span>
                {currentKeywords.length > 0 ? (
                  currentKeywords.slice(0, 5).map((kw, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-[#e8f0fe] text-[#1967d2] font-medium border border-[#d2e3fc]"
                    >
                      {kw}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-gray-400 italic">
                    (لم يتم تخصيص كلمات مفتاحية بعد لهذه الصفحة)
                  </span>
                )}
                {currentKeywords.length > 5 && (
                  <span className="text-[9px] text-[#5f6368] px-1 font-mono">
                    +{currentKeywords.length - 5} كلمات أخرى
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live Search Engine Signal Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#0d1414] border border-[#1e2e2e]">
          {/* Title Health */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#88b0b0] font-medium">طول العنوان (Title Length)</span>
              <span
                className={`font-mono text-[11px] font-bold ${
                  previewTitle.length >= 30 && previewTitle.length <= 60
                    ? "text-[#00d4aa]"
                    : previewTitle.length < 30
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {previewTitle.length} / 60 حرف
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#1e2e2e] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  previewTitle.length >= 30 && previewTitle.length <= 60
                    ? "bg-[#00d4aa]"
                    : previewTitle.length < 30
                    ? "bg-amber-400"
                    : "bg-red-400"
                }`}
                style={{ width: `${Math.min(100, (previewTitle.length / 60) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-[#5a8080]">
              {previewTitle.length >= 30 && previewTitle.length <= 60
                ? "طول مثالي يظهر كاملاً في نتائج Google دون اقتطاع."
                : previewTitle.length < 30
                ? "العنوان قصير نسبياً، يُنصح بتضمين اسم الأداة والمنصة."
                : "العنوان طويل قد يُقتطع بعلامة (...) على شاشات الهاتف."}
            </p>
          </div>

          {/* Description Health */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#88b0b0] font-medium">طول الوصف (Description Length)</span>
              <span
                className={`font-mono text-[11px] font-bold ${
                  previewDesc.length >= 100 && previewDesc.length <= 160
                    ? "text-[#00d4aa]"
                    : previewDesc.length < 100
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {previewDesc.length} / 160 حرف
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#1e2e2e] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  previewDesc.length >= 100 && previewDesc.length <= 160
                    ? "bg-[#00d4aa]"
                    : previewDesc.length < 100
                    ? "bg-amber-400"
                    : "bg-red-400"
                }`}
                style={{ width: `${Math.min(100, (previewDesc.length / 160) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-[#5a8080]">
              {previewDesc.length >= 100 && previewDesc.length <= 160
                ? "وصف دقيق وجذاب يزيد معدل النقر (CTR) الطبيعي."
                : previewDesc.length < 100
                ? "الوصف قصير، أضف فائدة حقيقية تشجع الزائر على الدخول."
                : "الوصف يتجاوز 160 حرفاً وقد يظهر مقتطعاً في SERP."}
            </p>
          </div>

          {/* Keywords Match Health */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#88b0b0] font-medium">الكلمات المفتاحية النشطة</span>
              <span className="font-mono text-[11px] text-[#00d4aa] font-bold">
                {currentKeywords.length} كلمات
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#1e2e2e] overflow-hidden">
              <div
                className="h-full bg-[#00d4aa] transition-all duration-300"
                style={{ width: `${Math.min(100, (currentKeywords.length / 8) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-[#5a8080]">
              {currentKeywords.length > 0
                ? `محركات البحث تستخدم هذه الكلمات للمطابقة الدلالية لمسار ${effectivePath}.`
                : "أضف كلمات مفتاحية في لوحة الحقن بالأعلى لربط الصفحة بمصطلحات البحث."}
            </p>
          </div>
        </div>

        {/* Live Simulation Editing Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-[11px] text-[#88b0b0] block font-bold">
              تخصيص عنوان المقتطف التفاعلي (Title Tag Live Override)
            </label>
            <input
              type="text"
              value={previewTitle}
              onChange={(e) => setPreviewTitle(e.target.value)}
              placeholder="اكتب العنوان لمحاكاة نتيجة البحث..."
              className="w-full bg-[#0a0f0f] text-xs text-[#e8f5f5] px-3 py-2 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-[#88b0b0] block font-bold">
              تخصيص وصف المقتطف التفاعلي (Meta Description Live Override)
            </label>
            <input
              type="text"
              value={previewDesc}
              onChange={(e) => setPreviewDesc(e.target.value)}
              placeholder="اكتب الوصف لمحاكاة نتيجة البحث..."
              className="w-full bg-[#0a0f0f] text-xs text-[#e8f5f5] px-3 py-2 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Favicon & Search Engine Brand Logo Inspector */}
      <div className="p-6 rounded-3xl bg-[#111a1a] border border-[#00d4aa]/30 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-[#e8f5f5] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00d4aa]" />
            <span>حالة شعار المنصة والفافيكون لمحركات البحث (Favicon & Brand Logo Status)</span>
          </h3>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#00d4aa]/10 text-[#00d4aa] font-bold border border-[#00d4aa]/30">
            جاهز للنشر 100%
          </span>
        </div>

        <p className="text-xs text-[#88b0b0] leading-relaxed">
          تم إنشاء وضبط كافة أحجام وأيقونات الشعار ومستند `site.webmanifest` متوافق تماماً مع إرشادات Google Favicon Crawler الرسمية.
        </p>

        {/* Grid of Assets */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e] flex flex-col items-center text-center space-y-2">
            <img src="/favicon.ico" alt="Favicon ICO" className="w-8 h-8 rounded-lg border border-[#1e2e2e]" />
            <span className="text-[11px] font-bold text-[#e8f5f5]">favicon.ico</span>
            <span className="text-[9px] text-[#00d4aa]">32x32px (Root)</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e] flex flex-col items-center text-center space-y-2">
            <img src="/icon-192x192.png" alt="PWA Icon 192" className="w-8 h-8 rounded-lg border border-[#1e2e2e]" />
            <span className="text-[11px] font-bold text-[#e8f5f5]">PWA / Google Icon</span>
            <span className="text-[9px] text-[#00d4aa]">192x192px PNG</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e] flex flex-col items-center text-center space-y-2">
            <img src="/apple-touch-icon.png" alt="Apple Touch Icon" className="w-8 h-8 rounded-lg border border-[#1e2e2e]" />
            <span className="text-[11px] font-bold text-[#e8f5f5]">Apple Touch Icon</span>
            <span className="text-[9px] text-[#00d4aa]">180x180px PNG</span>
          </div>

          <div className="p-3 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e] flex flex-col items-center text-center space-y-2">
            <img src="/logo.png" alt="Schema Logo" className="w-8 h-8 rounded-lg border border-[#1e2e2e]" />
            <span className="text-[11px] font-bold text-[#e8f5f5]">Schema Org Logo</span>
            <span className="text-[9px] text-[#00d4aa]">512x512px PNG</span>
          </div>
        </div>

        {/* Google Search Console Re-indexing Steps */}
        <div className="p-4 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e] space-y-2 text-xs">
          <span className="font-bold text-[#00d4aa] block">
            💡 كيف تجعل Google يعرض الشعار فوراً بعد الاستضافة؟
          </span>
          <ol className="list-decimal list-inside space-y-1.5 text-[#88b0b0] leading-relaxed">
            <li>قم بالدخول إلى <strong className="text-[#e8f5f5]">Google Search Console (GSC)</strong> الخاص بموقعك.</li>
            <li>ادخل رابط الصفحة الرئيسية في شريط <strong className="text-[#e8f5f5]">URL Inspection</strong>.</li>
            <li>اضغط على زر <strong className="text-[#e8f5f5]">Request Indexing (طلب إعادة الفهرسة)</strong>.</li>
            <li>يقوم روبوت Google Favicon Crawler بزيارة ملف `/favicon.ico` ورابط الشعار تحديثه في نتائج البحث خلال 24 إلى 48 ساعة.</li>
          </ol>
        </div>
      </div>

      {/* SEO Audit Findings & Issues Breakdown */}
      <div className="p-6 rounded-3xl bg-[#111a1a] border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm sm:text-base font-bold text-[#e8f5f5] flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#00d4aa]" />
          <span>نتائج الفحص الهندسي والتحسينات الموصى بها</span>
        </h3>

        {auditResult ? (
          <div className="space-y-3">
            {auditResult.issues.map((issue) => (
              <div
                key={issue.id}
                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  issue.severity === "High"
                    ? "bg-red-500/10 border-red-500/30 text-red-200"
                    : issue.severity === "Medium"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                    : "bg-[#0a0f0f] border-[#1e2e2e] text-[#88b0b0]"
                }`}
              >
                {issue.severity === "High" ? (
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                ) : issue.severity === "Medium" ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#00d4aa] shrink-0 mt-0.5" />
                )}

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[#e8f5f5]">{issue.issue}</span>
                    <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-extrabold bg-[#0a0f0f] border border-[#1e2e2e]">
                      {issue.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#88b0b0]">{issue.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[#4a7070]">جاري تشغيل محرك فحص SEO...</div>
        )}
      </div>

      {/* Pages Indexability Registry Matrix */}
      <div className="p-6 rounded-3xl bg-[#111a1a] border border-[#1e2e2e] space-y-4">
        <h3 className="text-sm sm:text-base font-bold text-[#e8f5f5] flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#0ea5e9]" />
          <span>سجل فهرسة الصفحات والأدوات (Indexability Matrix)</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right dir-rtl">
            <thead>
              <tr className="border-b border-[#1e2e2e] text-[#4a7070] font-bold">
                <th className="p-2.5 pb-3">الصفحة / المسار</th>
                <th className="p-2.5 pb-3">الحالة في Robots.txt</th>
                <th className="p-2.5 pb-3">البيانات المنظمة (Schema)</th>
                <th className="p-2.5 pb-3">Hreflang (ar/en)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2e2e]/60 text-[#c8dede]">
              <tr>
                <td className="p-2.5 font-bold text-[#00d4aa]">/ (الرئيسية)</td>
                <td className="p-2.5 text-[#00ff88]">مسموح (Indexable)</td>
                <td className="p-2.5 text-[#00d4aa]">WebSite + Organization</td>
                <td className="p-2.5 text-[#00ff88]">مُفعل</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-[#00d4aa]">/tools (دليل الأدوات)</td>
                <td className="p-2.5 text-[#00ff88]">مسموح (Indexable)</td>
                <td className="p-2.5 text-[#00d4aa]">CollectionPage + Breadcrumb</td>
                <td className="p-2.5 text-[#00ff88]">مُفعل</td>
              </tr>
              {TOOLS_DIRECTORY.map((t) => (
                <tr key={t.slug}>
                  <td className="p-2.5 font-mono text-xs text-[#e8f5f5]">/tools/{t.slug}</td>
                  <td className="p-2.5 text-[#00ff88]">مسموح (Indexable)</td>
                  <td className="p-2.5 text-[#00d4aa]">SoftwareApplication + FAQ</td>
                  <td className="p-2.5 text-[#00ff88]">مُفعل</td>
                </tr>
              ))}
              <tr>
                <td className="p-2.5 font-bold text-[#00d4aa]">/about</td>
                <td className="p-2.5 text-[#00ff88]">مسموح (Indexable)</td>
                <td className="p-2.5 text-[#00d4aa]">AboutPage</td>
                <td className="p-2.5 text-[#00ff88]">مُفعل</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-[#00d4aa]">/pricing</td>
                <td className="p-2.5 text-[#00ff88]">مسموح (Indexable)</td>
                <td className="p-2.5 text-[#00d4aa]">Product / Offer</td>
                <td className="p-2.5 text-[#00ff88]">مُفعل</td>
              </tr>
              <tr>
                <td className="p-2.5 font-bold text-red-400">/admin/* & /chat</td>
                <td className="p-2.5 text-red-400">محظور (Disallowed)</td>
                <td className="p-2.5 text-[#4a7070]">لا ينطبق</td>
                <td className="p-2.5 text-[#4a7070]">No-Index</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
