"use client";

import React, { useState } from "react";
import {
  Download,
  Maximize2,
  Copy,
  RotateCw,
  Check,
  Sparkles,
  AlertCircle,
  X,
  Loader2,
  Share2,
  Info,
} from "lucide-react";
import { downloadImage, copyToClipboard } from "@/lib/utils";

export interface ImageResultData {
  success: boolean;
  imageUrl?: string;
  images?: string[];
  prompt: string;
  providerUsed?: string;
  latencyMs?: number;
  optionsUsed?: {
    aspectRatio?: string;
    width?: number;
    height?: number;
    quality?: string;
    numImages?: number;
    style?: string;
  };
  steps?: string[];
  error?: string;
}

interface ImageResultWidgetProps {
  data: ImageResultData;
  onRegeneratePrompt?: (newPrompt: string) => void;
}

export const ImageResultWidget: React.FC<ImageResultWidgetProps> = ({
  data,
  onRegeneratePrompt,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentData, setCurrentData] = useState<ImageResultData>(data);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const imagesList =
    currentData.images && currentData.images.length > 0
      ? currentData.images
      : currentData.imageUrl
      ? [currentData.imageUrl]
      : [];

  const activeImageUrl = imagesList[selectedImageIndex] || currentData.imageUrl;

  const handleDownload = async () => {
    if (!activeImageUrl || downloading) return;
    setDownloading(true);
    try {
      const filename = `soufimage_${Date.now()}.png`;
      await downloadImage(activeImageUrl, filename);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!activeImageUrl) return;
    await copyToClipboard(activeImageUrl);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const handleCopyPrompt = async () => {
    if (!currentData.prompt) return;
    await copyToClipboard(currentData.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!currentData.prompt) return;

    if (onRegeneratePrompt) {
      onRegeneratePrompt(currentData.prompt);
      return;
    }

    setIsRegenerating(true);
    try {
      const res = await fetch("/api/tools/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentData.prompt }),
      });
      const resultData = await res.json().catch(() => null);
      if (resultData) {
        setCurrentData(resultData);
        setSelectedImageIndex(0);
      }
    } catch (err) {
      console.error("Regenerate error:", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!currentData.success || imagesList.length === 0) {
    return (
      <div
        className="w-full max-w-xl my-3 p-4 rounded-2xl bg-red-950/20 border border-red-500/20 text-red-200 shadow-sm backdrop-blur-md"
        dir="rtl"
      >
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-sm text-red-300">
              تعذر إنشاء الصورة
            </h4>
            <p className="text-xs text-red-400/80 mt-1">
              {currentData.error || "حدث خطأ أثناء معالجة الصورة، يرجى المحاولة مرة أخرى."}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => handleRegenerate()}
                disabled={isRegenerating}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-xs text-red-200 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCw className="w-3.5 h-3.5" />
                )}
                إعادة المحاولة
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl my-3 group select-none" dir="rtl">
      {/* Modern Seamless Card - ChatGPT & Gemini Aesthetic */}
      <div className="relative rounded-2xl overflow-hidden bg-[#0c1318]/90 border border-[#1e2e2e]/70 hover:border-[#00d4aa]/40 shadow-xl transition-all duration-300">
        {/* Visual Canvas */}
        <div className="relative w-full overflow-hidden flex items-center justify-center bg-black/40 min-h-[260px]">
          {isRegenerating && (
            <div className="absolute inset-0 z-20 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-2.5 text-[#00d4aa]">
              <Loader2 className="w-8 h-8 animate-spin text-[#00d4aa]" />
              <span className="text-xs font-semibold text-[#e8f5f5]">
                جاري توليد الصورة...
              </span>
            </div>
          )}

          {!imageLoaded && !isRegenerating && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0d161d] text-[#4a7070]">
              <Loader2 className="w-6 h-6 animate-spin text-[#00d4aa]" />
            </div>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImageUrl}
            alt="AI Generated Artwork"
            onLoad={() => setImageLoaded(true)}
            onClick={() => setIsFullscreen(true)}
            className={`w-full max-h-[580px] object-contain cursor-zoom-in transition-all duration-300 group-hover:scale-[1.008] ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
          />

          {/* Floating Action Overlay - Gemini / ChatGPT Minimal Pill Style */}
          <div className="absolute top-3 left-3 z-10 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 flex items-center gap-1.5 p-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-lg">
            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
              title="عرض ملء الشاشة"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="p-1.5 rounded-lg text-white/80 hover:text-[#00d4aa] hover:bg-white/15 transition-colors cursor-pointer"
              title="تحميل الصورة بدقة عالية"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleCopyLink}
              className="p-1.5 rounded-lg text-white/80 hover:text-[#00d4aa] hover:bg-white/15 transition-colors cursor-pointer"
              title="نسخ رابط الصورة"
            >
              {shared ? (
                <Check className="w-4 h-4 text-[#00d4aa]" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                showDetails
                  ? "text-[#00d4aa] bg-white/15"
                  : "text-white/80 hover:text-white hover:bg-white/15"
              }`}
              title="معلومات الصورة"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Floating Action on Bottom Right */}
          <div className="absolute bottom-3 right-3 z-10 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200">
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white/90 hover:text-[#00d4aa] text-xs font-medium transition-all shadow-lg flex items-center gap-1.5 cursor-pointer"
              title="إعادة توليد صورة مختلفة"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        </div>

        {/* Multi-Image Thumbnails Bar if multiple variations exist */}
        {imagesList.length > 1 && (
          <div className="flex items-center justify-center gap-2 p-2 bg-[#091014] border-t border-[#1e2e2e]/50 overflow-x-auto">
            {imagesList.map((img, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedImageIndex(idx);
                  setImageLoaded(false);
                }}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  selectedImageIndex === idx
                    ? "border-[#00d4aa] scale-105 shadow-md shadow-[#00d4aa]/20"
                    : "border-[#1e2e2e] opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt={`Variation ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Optional Collapsible Details View (Hidden by default - Only on User Click) */}
        {showDetails && (
          <div className="p-3 bg-[#080e12] border-t border-[#1e2e2e]/70 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between gap-2 text-[#8db3b3]">
              <span className="font-semibold text-[#e8f5f5] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00d4aa]" />
                تفاصيل التوليد
              </span>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 text-[11px] text-[#00d4aa] hover:underline cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                نسخ
              </button>
            </div>
            <p className="mt-1.5 text-[#8db3b3] text-[11px] font-mono leading-relaxed bg-[#0c141a] p-2 rounded-lg border border-[#1e2e2e]/50 line-clamp-3">
              {currentData.prompt}
            </p>
          </div>
        )}
      </div>

      {/* Fullscreen Modal Lightbox - Ultra Minimal & Cinematic */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200"
          dir="rtl"
        >
          {/* Top Bar */}
          <div className="w-full max-w-5xl flex items-center justify-between gap-3 z-10">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-semibold backdrop-blur-md">
                عرض بدقة كاملة
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 rounded-xl bg-[#00d4aa] hover:bg-[#00ff88] text-[#0a0f0f] font-bold text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>تحميل الصورة</span>
              </button>

              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Central Image View */}
          <div className="flex-1 w-full max-w-5xl flex items-center justify-center p-2 my-auto overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImageUrl}
              alt="Fullscreen View"
              className="max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl transition-all"
            />
          </div>

          {/* Bottom Actions Bar */}
          <div className="w-full max-w-xl text-center py-1">
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {shared ? <Check className="w-3.5 h-3.5 text-[#00d4aa]" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>نسخ الرابط</span>
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                <span>إعادة التوليد</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
