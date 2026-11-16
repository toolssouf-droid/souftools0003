"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Download,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Search,
  Layers,
  Sparkles,
  Send,
  FileText,
  FileSpreadsheet,
  FileCode,
  FileImage,
  Presentation,
  Play,
  RefreshCw,
  Monitor,
  Tablet,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Code2,
  Eye,
} from "lucide-react";
import { SoufFileItem, SoufFileVersion } from "@/lib/files/soufFileType";
import { triggerFileDownload } from "@/lib/files/soufFileStorage";
import { copyToClipboard } from "@/lib/utils";

interface SoufFilePreviewModalProps {
  file: SoufFileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestEdit?: (file: SoufFileItem, prompt: string, version: number) => void;
  isRtl?: boolean;
}

export const SoufFilePreviewModal: React.FC<SoufFilePreviewModalProps> = ({
  file,
  isOpen,
  onClose,
  onRequestEdit,
  isRtl = true,
}) => {
  const [selectedVersion, setSelectedVersion] = useState<number>(file?.version || 1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [codeSearchQuery, setCodeSearchQuery] = useState("");

  // Image controls
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  // HTML view mode
  const [htmlTab, setHtmlTab] = useState<"preview" | "code">("preview");
  const [htmlViewport, setHtmlViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [htmlKey, setHtmlKey] = useState(0);

  // Presentation slide index
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);

  // Sync selected version when file changes
  useEffect(() => {
    if (file) {
      setSelectedVersion(file.version || 1);
      setImageZoom(1);
      setImageRotation(0);
      setCurrentSlideIdx(0);
    }
  }, [file]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  // Active content based on chosen version
  const activeVersionObj =
    file.versions?.find((v) => v.version === selectedVersion) ||
    file.versions?.[file.versions.length - 1];
  const activeContent = activeVersionObj ? activeVersionObj.content : file.content;

  const handleCopy = async () => {
    await copyToClipboard(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    triggerFileDownload(file, selectedVersion);
  };

  const handleSendEdit = (customText?: string) => {
    const textToSend = customText || editPrompt;
    if (!textToSend.trim()) return;
    if (onRequestEdit) {
      onRequestEdit(file, textToSend.trim(), selectedVersion);
    }
    setEditPrompt("");
    onClose();
  };

  // Toggle true fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch {}
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {}
    }
  };

  return (
    <AnimatePresence>
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md ${
          isFullscreen ? "p-0" : "p-2 sm:p-4 md:p-6"
        }`}
      >
        <motion.div
          initial={{ opacity: 0, scale: isFullscreen ? 1 : 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          dir={isRtl ? "rtl" : "ltr"}
          className={`relative flex flex-col w-full bg-[#091111] shadow-2xl overflow-hidden transition-all ${
            isFullscreen
              ? "fixed inset-0 z-50 h-screen w-screen max-w-none max-h-none rounded-none border-none"
              : "h-[88vh] max-w-5xl rounded-2xl border border-[#1e2e2e]"
          }`}
        >
          {/* ------------------------------------------------------------- */}
          {/* TOP HEADER BAR */}
          {/* ------------------------------------------------------------- */}
          <div className="flex items-center justify-between border-b border-[#1e2e2e] bg-[#0c1616] px-4 py-2.5 shrink-0 gap-3">
            {/* Left: Icon, File Name, Version Dropdown */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa] shrink-0">
                <FileText className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-extrabold text-[#e8f5f5]" title={file.name}>
                    {file.name}
                  </h3>

                  {/* Version Picker */}
                  {file.versions && file.versions.length > 1 ? (
                    <div className="flex items-center gap-1">
                      <select
                        aria-label="اختر إصدار الملف"
                        value={selectedVersion}
                        onChange={(e) => setSelectedVersion(Number(e.target.value))}
                        className="rounded-lg border border-[#00d4aa]/40 bg-[#111e1e] px-2 py-0.5 text-[11px] font-mono font-bold text-[#00d4aa] focus:outline-none cursor-pointer"
                      >
                        {file.versions.map((v) => (
                          <option key={v.version} value={v.version} className="bg-[#0a1515] text-[#e8f5f5]">
                            v{v.version} {v.version === file.version ? "(الأحدث)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="rounded-full border border-[#00d4aa]/30 bg-[#00d4aa]/10 px-2 py-0.5 text-[10px] font-mono font-bold text-[#00d4aa]">
                      v1
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[#557575] font-mono mt-0.5">
                  <span className="uppercase font-bold text-[#00d4aa]">{file.extension}</span>
                  <span>•</span>
                  <span>{(activeVersionObj?.size ? activeVersionObj.size / 1024 : file.size / 1024).toFixed(1)} KB</span>
                  {activeVersionObj?.summary && (
                    <>
                      <span>•</span>
                      <span className="text-[#809999] truncate max-w-[200px]">{activeVersionObj.summary}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions (Copy, Download, Fullscreen, Close) */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Copy */}
              <button
                type="button"
                onClick={handleCopy}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#1e2e2e] bg-[#111c1c] text-[#709090] transition-colors hover:border-[#00d4aa]/40 hover:text-[#00d4aa]"
                title="نسخ محتوى الملف"
              >
                {copied ? <Check className="h-4 w-4 text-[#00ff88]" /> : <Copy className="h-4 w-4" />}
              </button>

              {/* Download */}
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-xl border border-[#00d4aa]/40 bg-[#00d4aa]/15 px-3 py-1.5 text-xs font-bold text-[#00d4aa] transition-all hover:bg-[#00d4aa] hover:text-[#0a0f0f]"
                title="تنزيل الملف على جهازك"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">تنزيل</span>
              </button>

              {/* Fullscreen Toggle */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-colors ${
                  isFullscreen
                    ? "border-[#00d4aa] bg-[#00d4aa]/20 text-[#00d4aa]"
                    : "border-[#1e2e2e] bg-[#111c1c] text-[#709090] hover:border-[#00d4aa]/40 hover:text-[#00d4aa]"
                }`}
                title={isFullscreen ? "تصغير النافذة" : "ملء الشاشة بالكامل"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={() => {
                  if (isFullscreen && document.fullscreenElement) {
                    try { document.exitFullscreen().catch(() => {}); } catch {}
                  }
                  onClose();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#1e2e2e] bg-[#111c1c] text-[#709090] transition-colors hover:border-red-500/40 hover:text-red-400"
                title="إغلاق المعاينة (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* BODY: ADAPTIVE PREVIEW RENDERERS */}
          {/* ------------------------------------------------------------- */}
          <div className={`flex-1 overflow-auto bg-[#070d0d] relative ${isFullscreen ? "p-0" : "p-3 sm:p-5"}`}>
            {/* 1. PDF RENDERER */}
            {file.extension === "pdf" && (
              <PdfRenderer content={activeContent} title={file.title || file.name} />
            )}

            {/* 2. IMAGE RENDERER */}
            {file.category === "image" && (
              <ImageRenderer
                content={activeContent}
                zoom={imageZoom}
                rotation={imageRotation}
                onZoomIn={() => setImageZoom((z) => Math.min(z + 0.25, 3))}
                onZoomOut={() => setImageZoom((z) => Math.max(z - 0.25, 0.5))}
                onRotate={() => setImageRotation((r) => (r + 90) % 360)}
                onReset={() => {
                  setImageZoom(1);
                  setImageRotation(0);
                }}
              />
            )}

            {/* 3. CODE RENDERER */}
            {file.category === "code" && file.extension !== "html" && (
              <CodeRenderer
                content={activeContent}
                extension={file.extension}
                searchQuery={codeSearchQuery}
                onSearchChange={setCodeSearchQuery}
              />
            )}

            {/* 4. HTML RENDERER (Sandboxed Live Iframe + Source Code) */}
            {file.extension === "html" && (
              <HtmlRenderer
                content={activeContent}
                tab={htmlTab}
                viewport={htmlViewport}
                htmlKey={htmlKey}
                isFullscreen={isFullscreen}
                onTabChange={setHtmlTab}
                onViewportChange={setHtmlViewport}
                onRefresh={() => setHtmlKey((k) => k + 1)}
              />
            )}

            {/* 5. CSV & TABULAR DATA RENDERER */}
            {file.extension === "csv" && <CsvRenderer content={activeContent} />}

            {/* 6. XLSX SPREADSHEET RENDERER */}
            {(file.extension === "xlsx" || file.extension === "xls") && (
              <XlsxRenderer content={activeContent} />
            )}

            {/* 7. DOCX / WORD DOCUMENT RENDERER */}
            {(file.extension === "docx" || file.extension === "doc") && (
              <DocxRenderer content={activeContent} title={file.title || file.name} />
            )}

            {/* 8. PPTX / PRESENTATION RENDERER */}
            {(file.extension === "pptx" || file.extension === "ppt") && (
              <PresentationRenderer
                content={activeContent}
                title={file.title || file.name}
                currentSlide={currentSlideIdx}
                onSlideChange={setCurrentSlideIdx}
              />
            )}

            {/* 9. JSON RENDERER */}
            {file.extension === "json" && <JsonRenderer content={activeContent} />}

            {/* 10. MARKDOWN & TXT RENDERER */}
            {(file.extension === "md" || file.extension === "txt" || file.category === "document") &&
              file.extension !== "pdf" &&
              file.extension !== "docx" &&
              file.extension !== "doc" && <MarkdownRenderer content={activeContent} />}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* BOTTOM INTERACTIVE EDIT BAR (Ask SoufAI to Edit this File) */}
          {/* ------------------------------------------------------------- */}
          <div className="border-t border-[#1e2e2e] bg-[#0a1414] p-3 shrink-0">
            {/* Quick Prompt Suggestions */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none text-xs">
              <span className="flex items-center gap-1 text-[11px] font-bold text-[#00d4aa] shrink-0">
                <Sparkles className="h-3.5 w-3.5" />
                اطلب تعديل:
              </span>
              {[
                "أضف جدولاً أو رسماً تحليلياً",
                "ترجم المحتوى إلى اللغة الإنجليزية",
                "صحح الأخطاء وحسّن الصياغة",
                "لخص النقاط الجوهرية في بداية الملف",
                "أضف قسماً للتوصيات والخطوات القادمة",
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendEdit(suggestion)}
                  className="shrink-0 rounded-lg border border-[#1e2e2e] bg-[#101b1b] px-2.5 py-1 text-[11px] text-[#90abab] transition-colors hover:border-[#00d4aa]/40 hover:text-[#00d4aa]"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendEdit();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                placeholder="اكتب توجيهاً لـ SoufAI لتعديل هذا الملف وإنشاء إصدار جديد (v2)..."
                className="flex-1 rounded-xl border border-[#1e2e2e] bg-[#070e0e] px-3.5 py-2 text-xs text-[#e8f5f5] placeholder-[#406060] focus:border-[#00d4aa] focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!editPrompt.trim()}
                className="flex items-center gap-1.5 rounded-xl border border-[#00d4aa]/40 bg-[#00d4aa] px-4 py-2 text-xs font-bold text-[#0a0f0f] transition-all hover:bg-[#00ffcc] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
                <span>إرسال التعديل</span>
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

/* ========================================================================= */
/* SPECIFIC SUB-RENDERERS                                                    */
/* ========================================================================= */

/** 1. PDF Renderer */
function PdfRenderer({ content, title }: { content: string; title: string }) {
  // If content is real PDF binary or data URL
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    try {
      if (content.startsWith("%PDF")) {
        const blob = new Blob([content], { type: "application/pdf" });
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      }
    } catch {}
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [content]);

  if (blobUrl) {
    return (
      <div className="h-full w-full rounded-xl overflow-hidden border border-[#1e2e2e] bg-[#1a2020]">
        <iframe src={blobUrl} title={title} className="h-full w-full border-none" />
      </div>
    );
  }

  // Fallback styled document presentation
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-[#1e2e2e] bg-[#ffffff] p-8 text-[#1a1a1a] shadow-2xl font-serif leading-relaxed">
      <div className="border-b-2 border-[#00876c] pb-4 mb-6">
        <h1 className="text-2xl font-bold text-[#00876c]">{title}</h1>
        <p className="text-xs text-[#666] mt-1 font-sans">وثيقة صادرة عبر منصة SoufTools الذكية</p>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-loose">
        {content.replace(/%PDF-[\s\S]*?stream/g, "").replace(/endstream[\s\S]*/g, "") || content}
      </div>
    </div>
  );
}

/** 2. Image Renderer */
function ImageRenderer({
  content,
  zoom,
  rotation,
  onZoomIn,
  onZoomOut,
  onRotate,
  onReset,
}: {
  content: string;
  zoom: number;
  rotation: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRotate: () => void;
  onReset: () => void;
}) {
  const isSvg = content.trim().startsWith("<svg");
  const imgSrc = isSvg
    ? `data:image/svg+xml;utf8,${encodeURIComponent(content)}`
    : content;

  return (
    <div className="flex flex-col h-full items-center justify-center">
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-xl border border-[#1e2e2e] bg-[#0e1818]/90 px-3 py-1.5 shadow-xl backdrop-blur-md">
        <button
          onClick={onZoomIn}
          className="p-1 text-[#a0b8b8] hover:text-[#00d4aa]"
          title="تكبير"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="text-xs font-mono text-[#00d4aa] px-1">{Math.round(zoom * 100)}%</span>
        <button
          onClick={onZoomOut}
          className="p-1 text-[#a0b8b8] hover:text-[#00d4aa]"
          title="تصغير"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="h-3 w-[1px] bg-[#1e2e2e] mx-1" />
        <button
          onClick={onRotate}
          className="p-1 text-[#a0b8b8] hover:text-[#00d4aa]"
          title="تدوير 90 درجة"
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <button
          onClick={onReset}
          className="text-[10px] text-[#709090] hover:text-[#00d4aa] px-1 font-mono"
        >
          إعادة تعيين
        </button>
      </div>

      {/* Image Container with checkerboard background */}
      <div className="flex-1 w-full flex items-center justify-center overflow-auto p-8 rounded-xl bg-[#060a0a] border border-[#1a2525] bg-[radial-gradient(#152020_1px,transparent_1px)] [background-size:16px_16px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt="File Preview"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: "transform 0.15s ease-out",
          }}
          className="max-h-[70vh] max-w-[85vw] object-contain rounded-lg shadow-2xl"
        />
      </div>
    </div>
  );
}

/** 3. Code Renderer with line numbers & search */
function CodeRenderer({
  content,
  extension,
  searchQuery,
  onSearchChange,
}: {
  content: string;
  extension: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}) {
  const lines = useMemo(() => content.split("\n"), [content]);

  return (
    <div className="flex flex-col h-full rounded-xl border border-[#1e2e2e] bg-[#0a1212] overflow-hidden">
      {/* Code Header Toolbar */}
      <div className="flex items-center justify-between border-b border-[#1e2e2e] bg-[#0e1818] px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-[#f59e0b]" />
          <span className="font-mono text-[#f59e0b] font-bold uppercase">{extension}</span>
          <span className="text-[#557575] font-mono">({lines.length} سطر)</span>
        </div>

        {/* Search bar inside code */}
        <div className="flex items-center gap-1.5 rounded-lg border border-[#1e2e2e] bg-[#070e0e] px-2.5 py-1 text-xs">
          <Search className="h-3 w-3 text-[#507070]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="بحث داخل الكود..."
            className="w-28 sm:w-44 bg-transparent text-[#e8f5f5] placeholder-[#406060] focus:outline-none font-mono text-[11px]"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange("")} className="text-[#608080] hover:text-[#e8f5f5]">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Code Lines with Line Numbers */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed" dir="ltr">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isMatch = searchQuery.trim() && line.toLowerCase().includes(searchQuery.toLowerCase());
              return (
                <tr key={idx} className={isMatch ? "bg-[#00d4aa]/15" : "hover:bg-[#111d1d]/60"}>
                  <td className="w-12 select-none text-right pr-4 text-[#355050] font-mono text-[11px] align-top">
                    {lineNum}
                  </td>
                  <td className="text-[#d8e8e8] whitespace-pre-wrap break-all pl-2 font-mono">
                    {line}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 4. HTML Renderer (Live Sandboxed Iframe) */
function HtmlRenderer({
  content,
  tab,
  viewport,
  htmlKey,
  isFullscreen,
  onTabChange,
  onViewportChange,
  onRefresh,
}: {
  content: string;
  tab: "preview" | "code";
  viewport: "desktop" | "tablet" | "mobile";
  htmlKey: number;
  isFullscreen?: boolean;
  onTabChange: (tab: "preview" | "code") => void;
  onViewportChange: (vp: "desktop" | "tablet" | "mobile") => void;
  onRefresh: () => void;
}) {
  const viewportWidth =
    viewport === "mobile" ? "max-w-[375px]" : viewport === "tablet" ? "max-w-[768px]" : "w-full";

  return (
    <div
      className={`flex flex-col h-full bg-[#081010] overflow-hidden ${
        isFullscreen ? "rounded-none border-none" : "rounded-xl border border-[#1e2e2e]"
      }`}
    >
      {/* HTML Toolbar */}
      <div className="flex items-center justify-between border-b border-[#1e2e2e] bg-[#0c1616] px-3 py-2 text-xs">
        {/* Tab Toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTabChange("preview")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold ${
              tab === "preview"
                ? "bg-[#00d4aa] text-[#0a0f0f]"
                : "text-[#709090] hover:bg-[#142222] hover:text-[#e8f5f5]"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>معاينة تفاعلية</span>
          </button>
          <button
            onClick={() => onTabChange("code")}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold ${
              tab === "code"
                ? "bg-[#00d4aa] text-[#0a0f0f]"
                : "text-[#709090] hover:bg-[#142222] hover:text-[#e8f5f5]"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>كود HTML</span>
          </button>
        </div>

        {/* Viewport switchers for Preview */}
        {tab === "preview" && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onViewportChange("desktop")}
              className={`p-1.5 rounded-lg ${viewport === "desktop" ? "bg-[#162727] text-[#00d4aa]" : "text-[#557575]"}`}
              title="سطح المكتب"
            >
              <Monitor className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewportChange("tablet")}
              className={`p-1.5 rounded-lg ${viewport === "tablet" ? "bg-[#162727] text-[#00d4aa]" : "text-[#557575]"}`}
              title="جهاز لوحي"
            >
              <Tablet className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewportChange("mobile")}
              className={`p-1.5 rounded-lg ${viewport === "mobile" ? "bg-[#162727] text-[#00d4aa]" : "text-[#557575]"}`}
              title="هاتف محمول"
            >
              <Smartphone className="h-4 w-4" />
            </button>
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-[#557575] hover:text-[#00d4aa]"
              title="إعادة تحميل المعاينة"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div
        className={`flex-1 overflow-auto flex items-center justify-center bg-[#050909] ${
          isFullscreen && viewport === "desktop" ? "p-0" : "p-2"
        }`}
      >
        {tab === "preview" ? (
          <div
            className={`h-full ${viewportWidth} transition-all overflow-hidden bg-white shadow-2xl ${
              isFullscreen && viewport === "desktop"
                ? "w-full rounded-none border-none"
                : "rounded-lg border border-[#1e2e2e]"
            }`}
          >
            <iframe
              key={htmlKey}
              srcDoc={content}
              sandbox="allow-scripts allow-same-origin allow-forms"
              title="HTML Sandbox Preview"
              className="h-full w-full border-none"
            />
          </div>
        ) : (
          <pre className="h-full w-full overflow-auto p-4 text-xs font-mono text-[#00ff88] bg-[#0a1212] whitespace-pre-wrap leading-relaxed" dir="ltr">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}

/** 5. CSV Interactive Table Renderer */
function CsvRenderer({ content }: { content: string }) {
  const [filter, setFilter] = useState("");

  const { headers, rows } = useMemo(() => {
    const rawLines = content.split("\n").filter((l) => l.trim().length > 0);
    if (rawLines.length === 0) return { headers: [], rows: [] };

    // Simple parser handling quotes or comma/semicolon
    const delimiter = rawLines[0].includes(";") ? ";" : ",";
    const parseLine = (line: string) => {
      return line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, "").trim());
    };

    const hdrs = parseLine(rawLines[0]);
    const rws = rawLines.slice(1).map(parseLine);
    return { headers: hdrs, rows: rws };
  }, [content]);

  const filteredRows = useMemo(() => {
    if (!filter.trim()) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) => r.some((cell) => cell.toLowerCase().includes(q)));
  }, [rows, filter]);

  return (
    <div className="flex flex-col h-full rounded-xl border border-[#1e2e2e] bg-[#0a1212] overflow-hidden">
      {/* CSV Filter Header */}
      <div className="flex items-center justify-between border-b border-[#1e2e2e] bg-[#0e1818] px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-[#14b8a6]" />
          <span className="font-bold text-[#14b8a6]">جدول CSV تفاعلي</span>
          <span className="text-[#557575] font-mono">({rows.length} صف، {headers.length} عمود)</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-[#1e2e2e] bg-[#070e0e] px-2.5 py-1 text-xs">
          <Search className="h-3 w-3 text-[#507070]" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="تصفية البيانات..."
            className="w-32 sm:w-48 bg-transparent text-[#e8f5f5] placeholder-[#406060] focus:outline-none text-[11px]"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="sticky top-0 bg-[#122020] text-[#00d4aa] border-b border-[#1e2e2e] font-bold shadow-sm">
            <tr>
              <th className="p-2.5 text-center text-[#557575] w-12 font-mono">#</th>
              {headers.map((h, idx) => (
                <th key={idx} className="p-2.5 border-l border-[#1a2c2c] truncate max-w-[200px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#152424]">
            {filteredRows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-[#101c1c] transition-colors">
                <td className="p-2 text-center text-[#406060] font-mono text-[11px] select-none">
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="p-2 border-l border-[#152424] text-[#d5e5e5] truncate max-w-[220px]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 6. XLSX Spreadsheet Previewer */
function XlsxRenderer({ content }: { content: string }) {
  // If it's XML Spreadsheet or structured CSV
  return (
    <div className="flex flex-col h-full rounded-xl border border-[#1e2e2e] bg-[#0a1212] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#1e2e2e] bg-[#0c1818] px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-[#10b981] font-bold">
          <FileSpreadsheet className="h-4 w-4" />
          <span>جدول بيانات Microsoft Excel (.xlsx)</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono text-xs text-[#a0c0c0]">
        {content.includes("<Workbook") ? (
          <div className="rounded-lg border border-[#1e2e2e] bg-[#060c0c] p-4 text-[#00ffcc] overflow-auto max-h-full">
            <p className="text-xs text-[#00d4aa] mb-2 font-bold font-sans">
              ✓ تم إنشاء صيغة مصنف Excel المتوافقة مع كافة الإصدارات بنجاح. يمكنك تنزيل الملف وفتحه في Microsoft Excel مباشرة.
            </p>
            <pre className="text-[11px] whitespace-pre-wrap">{content.slice(0, 3000)}...</pre>
          </div>
        ) : (
          <CsvRenderer content={content} />
        )}
      </div>
    </div>
  );
}

/** 7. DOCX / Word Document Previewer */
function DocxRenderer({ content, title }: { content: string; title: string }) {
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-[#1e2e2e] bg-white p-8 sm:p-12 text-[#1f2937] shadow-2xl leading-relaxed">
      <div className="border-b-2 border-[#00d4aa] pb-4 mb-6">
        <h1 className="text-2xl font-bold text-[#0f5147]">{title}</h1>
        <p className="text-xs text-[#6b7280] mt-1 font-sans">مستند معالج نصوص (DOCX / Microsoft Word)</p>
      </div>
      <div
        className="text-sm leading-loose prose max-w-none text-[#1f2937]"
        dangerouslySetInnerHTML={{
          __html: content.includes("<html") ? content : content.replace(/\n/g, "<br/>"),
        }}
      />
    </div>
  );
}

/** 8. Presentation / PPTX Slide Deck Renderer */
function PresentationRenderer({
  content,
  title,
  currentSlide,
  onSlideChange,
}: {
  content: string;
  title: string;
  currentSlide: number;
  onSlideChange: (idx: number) => void;
}) {
  // Parse slides separated by "---" or slide headers
  const slides = useMemo(() => {
    const parts = content.split(/---|\n## /).filter((p) => p.trim().length > 0);
    if (parts.length === 0) return [{ title, bullets: ["شريحة العرض التقديمي"] }];
    return parts.map((part, idx) => {
      const lines = part.split("\n").filter((l) => l.trim().length > 0);
      const slideTitle = lines[0]?.replace(/^#*\s*/, "") || `شريحة ${idx + 1}`;
      const bullets = lines.slice(1).map((l) => l.replace(/^[-*•]\s*/, "").trim());
      return { title: slideTitle, bullets };
    });
  }, [content, title]);

  const active = slides[currentSlide] || slides[0];

  return (
    <div className="flex flex-col h-full items-center justify-center">
      {/* 16:9 Slide Canvas */}
      <div className="w-full max-w-3xl aspect-[16/9] rounded-2xl border-2 border-[#1e2e2e] bg-gradient-to-br from-[#0c1a1a] to-[#050a0a] p-8 sm:p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden">
        {/* Accent Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#00d4aa]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Slide Header */}
        <div>
          <div className="flex items-center justify-between border-b border-[#1e2e2e]/80 pb-3">
            <span className="text-xs font-mono font-bold text-[#00d4aa] uppercase tracking-wider">
              {title}
            </span>
            <span className="text-xs font-mono text-[#557575]">
              الشريحة {currentSlide + 1} من {slides.length}
            </span>
          </div>

          <h2 className="mt-6 text-xl sm:text-2xl font-extrabold text-[#e8f5f5] leading-tight">
            {active.title}
          </h2>
        </div>

        {/* Slide Bullets */}
        <div className="my-auto py-4">
          <ul className="space-y-3">
            {active.bullets.map((b, bIdx) => (
              <li key={bIdx} className="flex items-start gap-2.5 text-sm sm:text-base text-[#b0c8c8]">
                <span className="h-2 w-2 rounded-full bg-[#00d4aa] mt-2 shrink-0 shadow-[0_0_8px_#00d4aa]" />
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Slide Footer */}
        <div className="flex items-center justify-between text-xs text-[#406060] border-t border-[#1e2e2e]/40 pt-3">
          <span>SoufTools Presentation Suite</span>
          <span className="font-mono">v1.0</span>
        </div>
      </div>

      {/* Slide Navigation Controls */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => onSlideChange(Math.max(0, currentSlide - 1))}
          disabled={currentSlide === 0}
          className="flex items-center gap-1 rounded-xl border border-[#1e2e2e] bg-[#101c1c] px-3 py-1.5 text-xs text-[#a0c0c0] hover:text-[#00d4aa] disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
          <span>السابقة</span>
        </button>

        <span className="text-xs font-mono text-[#00d4aa]">
          {currentSlide + 1} / {slides.length}
        </span>

        <button
          onClick={() => onSlideChange(Math.min(slides.length - 1, currentSlide + 1))}
          disabled={currentSlide === slides.length - 1}
          className="flex items-center gap-1 rounded-xl border border-[#1e2e2e] bg-[#101c1c] px-3 py-1.5 text-xs text-[#a0c0c0] hover:text-[#00d4aa] disabled:opacity-30"
        >
          <span>التالية</span>
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** 9. JSON Viewer */
function JsonRenderer({ content }: { content: string }) {
  const formattedJson = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div className="h-full rounded-xl border border-[#1e2e2e] bg-[#070e0e] p-4 overflow-auto font-mono text-xs leading-relaxed text-[#38bdf8]" dir="ltr">
      <pre>{formattedJson}</pre>
    </div>
  );
}

/** 10. Markdown & TXT Renderer */
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-[#1e2e2e] bg-[#0a1414] p-6 sm:p-8 text-[#d8e8e8] shadow-xl leading-relaxed whitespace-pre-wrap font-sans">
      {content}
    </div>
  );
}
