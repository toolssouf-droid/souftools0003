"use client";

import React, { useMemo, useState } from "react";
import { CodeBlock } from "./CodeBlock";
import { SearchSource } from "@/lib/sourcesHelper";
import { InlineCitationBadge } from "@/components/sources/InlineCitationBadge";
import { Download, Maximize2, X, Loader2, ExternalLink } from "lucide-react";
import { downloadImage } from "@/lib/utils";

interface FormattedMessageProps {
  content: string;
  sources?: SearchSource[];
  isRtl?: boolean;
}

const MarkdownImageCard: React.FC<{ alt: string; url: string }> = ({ alt, url }) => {
  const [downloading, setDownloading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleDownload = async () => {
    if (!url || downloading) return;
    setDownloading(true);
    try {
      await downloadImage(url, `soufimage_${Date.now()}.png`);
    } catch (err) {
      console.error("Image download error:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="my-3 max-w-xl group relative select-none" dir="rtl">
      <div className="relative rounded-2xl overflow-hidden bg-[#0c1318]/90 border border-[#1e2e2e]/70 hover:border-[#00d4aa]/40 shadow-xl transition-all duration-300">
        <div className="relative overflow-hidden bg-black/40 flex items-center justify-center min-h-[220px]">
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0d161d] text-[#4a7070]">
              <Loader2 className="w-6 h-6 animate-spin text-[#00d4aa]" />
            </div>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={alt || "Image"}
            onLoad={() => setImageLoaded(true)}
            onClick={() => setIsFullscreen(true)}
            className={`w-full max-h-[500px] object-contain cursor-zoom-in transition-all duration-300 group-hover:scale-[1.008] ${
              imageLoaded ? "opacity-100" : "opacity-0"
            }`}
            loading="lazy"
          />

          {/* Floating Action Buttons - Modern Minimalist Style */}
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
              title="تحميل الصورة"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in duration-200"
          dir="rtl"
        >
          <div className="w-full max-w-5xl flex items-center justify-between gap-3 z-10">
            <span className="px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-semibold backdrop-blur-md">
              {alt || "عرض الصورة"}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-4 py-2 rounded-xl bg-[#00d4aa] hover:bg-[#00ff88] text-[#0a0f0f] font-bold text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer"
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>تحميل الصورة</span>
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 w-full max-w-5xl flex items-center justify-center p-2 my-auto overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt || "Image"}
              className="max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl transition-all"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const FormattedMessageComponent: React.FC<FormattedMessageProps> = ({
  content,
  sources,
  isRtl = false,
}) => {
  if (!content) return null;

  return (
    <FormattedMessageInner
      content={content}
      sources={sources}
      isRtl={isRtl}
    />
  );
};

const FormattedMessageInner: React.FC<FormattedMessageProps> = ({
  content,
  sources,
  isRtl = false,
}) => {
  // Parse code blocks and text parts with memoization
  const parts = useMemo(() => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const result: { type: "text" | "code"; language?: string; value: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: "text",
          value: content.substring(lastIndex, match.index),
        });
      }

      result.push({
        type: "code",
        language: match[1] || "code",
        value: match[2],
      });

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      result.push({
        type: "text",
        value: content.substring(lastIndex),
      });
    }

    return result;
  }, [content]);

  // Parse inline formatting: bold, italic, inline code, citations, links
  const parseInlineStyles = (text: string, keyPrefix: string): React.ReactNode[] => {
    const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[\d+\]|\[[^\]]+\]\(https?:\/\/[^\)]+\))/g;
    const tokens: React.ReactNode[] = [];
    let curIndex = 0;
    let tokenMatch;

    while ((tokenMatch = tokenRegex.exec(text)) !== null) {
      if (tokenMatch.index > curIndex) {
        tokens.push(text.substring(curIndex, tokenMatch.index));
      }

      const raw = tokenMatch[0];
      const matchIdx = tokenMatch.index;

      if (raw.startsWith("`") && raw.endsWith("`")) {
        tokens.push(
          <code
            key={`code-${keyPrefix}-${matchIdx}`}
            className="mx-1 px-1.5 py-0.5 rounded-md bg-[#111a1a] border border-[#1e2e2e] text-[#00d4aa] font-mono text-[11px] font-medium dir-ltr inline-block"
          >
            {raw.slice(1, -1)}
          </code>
        );
      } else if (raw.startsWith("**") && raw.endsWith("**")) {
        tokens.push(
          <strong key={`b-${keyPrefix}-${matchIdx}`} className="font-bold text-[#e8f5f5]">
            {raw.slice(2, -2)}
          </strong>
        );
      } else if (raw.startsWith("*") && raw.endsWith("*")) {
        tokens.push(
          <em key={`i-${keyPrefix}-${matchIdx}`} className="italic text-[#a8d0d0]">
            {raw.slice(1, -1)}
          </em>
        );
      } else if (raw.match(/^\[\d+\]$/)) {
        const num = parseInt(raw.slice(1, -1), 10);
        tokens.push(
          <InlineCitationBadge
            key={`cite-${keyPrefix}-${matchIdx}`}
            num={num}
            sources={sources}
          />
        );
      } else if (raw.startsWith("[") && raw.includes("](") && raw.endsWith(")")) {
        const linkMatch = raw.match(/^\[(.*?)\]\((.*?)\)$/);
        if (linkMatch) {
          tokens.push(
            <a
              key={`link-${keyPrefix}-${matchIdx}`}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00d4aa] underline decoration-[#00d4aa]/40 hover:decoration-[#00d4aa] font-semibold inline-flex items-center gap-0.5 mx-1"
            >
              <span>{linkMatch[1]}</span>
              <ExternalLink className="w-3 h-3 inline-block opacity-70" />
            </a>
          );
        }
      }

      curIndex = matchIdx + raw.length;
    }

    if (curIndex < text.length) {
      tokens.push(text.substring(curIndex));
    }

    return tokens;
  };

  // Render block-level elements
  const renderTextBlock = (textValue: string, blockKey: number) => {
    const lines = textValue.split("\n");
    const elements: React.ReactNode[] = [];
    let lineIdx = 0;

    while (lineIdx < lines.length) {
      const line = lines[lineIdx];

      // Markdown Image ![alt](url)
      const imageMatch = line.trim().match(/^!\[(.*?)\]\((https?:\/\/.*?|data:image\/.*?)\)$/);
      if (imageMatch) {
        elements.push(
          <MarkdownImageCard
            key={`img-${blockKey}-${lineIdx}`}
            alt={imageMatch[1]}
            url={imageMatch[2]}
          />
        );
        lineIdx++;
        continue;
      }

      // Table detection
      if (
        line.includes("|") &&
        lineIdx + 1 < lines.length &&
        lines[lineIdx + 1].includes("|") &&
        lines[lineIdx + 1].includes("-")
      ) {
        const tableLines: string[] = [];
        while (lineIdx < lines.length && lines[lineIdx].trim().startsWith("|")) {
          tableLines.push(lines[lineIdx]);
          lineIdx++;
        }

        if (tableLines.length >= 2) {
          const headerCells = tableLines[0]
            .split("|")
            .filter((_, i, arr) => i > 0 && i < arr.length - 1)
            .map((c) => c.trim());

          const bodyRows = tableLines.slice(2).map((rowLine) =>
            rowLine
              .split("|")
              .filter((_, i, arr) => i > 0 && i < arr.length - 1)
              .map((c) => c.trim())
          );

          elements.push(
            <div key={`table-${blockKey}-${lineIdx}`} className="my-3 overflow-x-auto rounded-xl border border-[#1e2e2e] bg-[#0c1414]">
              <table className="w-full text-xs text-[#e8f5f5] text-right border-collapse">
                <thead>
                  <tr className="bg-[#111a1a] border-b border-[#1e2e2e] text-[#00d4aa] font-bold">
                    {headerCells.map((cell, idx) => (
                      <th key={idx} className="p-2.5 px-3">
                        {parseInlineStyles(cell, `th-${idx}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-[#1e2e2e]/40 hover:bg-[#111a1a]/50 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2.5 px-3 text-[#d0e5e5]">
                          {parseInlineStyles(cell, `td-${rIdx}-${cIdx}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // Headers (# ## ###)
      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={`h1-${blockKey}-${lineIdx}`} className="text-lg sm:text-xl font-extrabold text-[#e8f5f5] mt-3 mb-1 border-b border-[#1e2e2e] pb-1">
            {parseInlineStyles(line.slice(2), `h1-${lineIdx}`)}
          </h1>
        );
        lineIdx++;
        continue;
      }
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={`h2-${blockKey}-${lineIdx}`} className="text-base sm:text-lg font-bold text-[#e8f5f5] mt-2.5 mb-1">
            {parseInlineStyles(line.slice(3), `h2-${lineIdx}`)}
          </h2>
        );
        lineIdx++;
        continue;
      }
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={`h3-${blockKey}-${lineIdx}`} className="text-sm sm:text-base font-semibold text-[#00d4aa] mt-2 mb-1">
            {parseInlineStyles(line.slice(4), `h3-${lineIdx}`)}
          </h3>
        );
        lineIdx++;
        continue;
      }

      // Blockquotes (> quote)
      if (line.startsWith("> ")) {
        elements.push(
          <blockquote key={`quote-${blockKey}-${lineIdx}`} className="my-2 p-2 px-3 border-r-2 border-r-[#00d4aa] bg-[#00d4aa]/5 rounded-l-lg text-xs sm:text-sm text-[#a8d0d0] italic">
            {parseInlineStyles(line.slice(2), `q-${lineIdx}`)}
          </blockquote>
        );
        lineIdx++;
        continue;
      }

      // Lists (- or * or 1.)
      if (line.trim().match(/^([-*]|\d+\.)\s+/)) {
        const listItems: string[] = [];
        const isOrdered = line.trim().match(/^\d+\./);
        const startLineIdx = lineIdx;
        while (lineIdx < lines.length && lines[lineIdx].trim().match(/^([-*]|\d+\.)\s+/)) {
          listItems.push(lines[lineIdx].trim().replace(/^([-*]|\d+\.)\s+/, ""));
          lineIdx++;
        }

        elements.push(
          isOrdered ? (
            <ol key={`ol-${blockKey}-${startLineIdx}`} className="my-2 space-y-1 list-decimal list-inside text-xs sm:text-sm text-[#e8f5f5] pr-1">
              {listItems.map((item, idx) => (
                <li key={`li-${startLineIdx}-${idx}`} className="leading-relaxed">
                  {parseInlineStyles(item, `li-${blockKey}-${startLineIdx}-${idx}`)}
                </li>
              ))}
            </ol>
          ) : (
            <ul key={`ul-${blockKey}-${startLineIdx}`} className="my-2 space-y-1 text-xs sm:text-sm text-[#e8f5f5] pr-1">
              {listItems.map((item, idx) => (
                <li key={`li-${startLineIdx}-${idx}`} className="flex items-start gap-2 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] mt-2 shrink-0" />
                  <div>{parseInlineStyles(item, `li-${blockKey}-${startLineIdx}-${idx}`)}</div>
                </li>
              ))}
            </ul>
          )
        );
        continue;
      }

      // Empty line
      if (!line.trim()) {
        elements.push(<div key={`empty-${blockKey}-${lineIdx}`} className="h-2" />);
        lineIdx++;
        continue;
      }

      // Regular paragraph line
      elements.push(
        <div key={`p-${blockKey}-${lineIdx}`} className="leading-relaxed text-xs sm:text-sm text-[#e8f5f5]">
          {parseInlineStyles(line, `p-${blockKey}-${lineIdx}`)}
        </div>
      );
      lineIdx++;
    }

    return (
      <div key={`text-block-${blockKey}`} className="space-y-1">
        {elements}
      </div>
    );
  };

  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      {parts.map((part, index) => {
        if (part.type === "code") {
          return (
            <CodeBlock
              key={`code-${index}`}
              language={part.language || "text"}
              code={part.value}
              isRtl={isRtl}
            />
          );
        } else {
          return renderTextBlock(part.value, index);
        }
      })}
    </div>
  );
};

export const FormattedMessage = React.memo(FormattedMessageComponent);
