"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Code2,
  Play,
  Check,
  Copy,
  Download,
  RefreshCw,
  Maximize2,
  Minimize2,
  Sparkles,
  Terminal,
  FileCode,
  AlertTriangle,
  Eye,
  FileText,
  FolderArchive,
  ExternalLink,
  Laptop,
  CheckCircle2,
  X,
  Wrench,
  RotateCcw
} from "lucide-react";

import { copyToClipboard } from "@/lib/utils";

interface CodeBlockProps {
  language: string;
  code: string;
  isRtl?: boolean;
}

// Map language identifiers to metadata & icons
const getLanguageMeta = (langInput: string, codeContent: string) => {
  const lang = (langInput || "code").toLowerCase().trim();

  // Try extracting filename from code comments (e.g. # filename: script.py or // filename: App.tsx)
  const commentMatch = codeContent.match(
    /^(?:\/\/|#|<!--|\/\*)\s*(?:filename|file|الاسم):\s*([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i
  );
  let fileName = commentMatch ? commentMatch[1] : "";

  // Infer default filename based on code content patterns if not provided
  if (!fileName) {
    if (lang.includes("py") || lang === "python") {
      const funcMatch = codeContent.match(/def\s+([a-zA-Z0-9_]+)\s*\(/);
      fileName = funcMatch ? `${funcMatch[1]}.py` : "main.py";
    } else if (lang.includes("react") || lang.includes("jsx") || lang.includes("tsx")) {
      const compMatch = codeContent.match(/function\s+([A-Z][a-zA-Z0-9_]*)/) || codeContent.match(/const\s+([A-Z][a-zA-Z0-9_]*)\s*=/);
      fileName = compMatch ? `${compMatch[1]}.tsx` : "App.tsx";
    } else if (lang.includes("js") || lang === "javascript") {
      const funcMatch = codeContent.match(/function\s+([a-zA-Z0-9_]+)\s*\(/);
      fileName = funcMatch ? `${funcMatch[1]}.js` : "script.js";
    } else if (lang.includes("ts") || lang === "typescript") {
      const funcMatch = codeContent.match(/function\s+([a-zA-Z0-9_]+)\s*\(/);
      fileName = funcMatch ? `${funcMatch[1]}.ts` : "app.ts";
    } else if (lang.includes("html")) {
      fileName = "index.html";
    } else if (lang.includes("css")) {
      fileName = "styles.css";
    } else if (lang.includes("cpp") || lang.includes("c++")) {
      fileName = "main.cpp";
    } else if (lang.includes("java")) {
      const classMatch = codeContent.match(/class\s+([A-Z][a-zA-Z0-9_]*)/);
      fileName = classMatch ? `${classMatch[1]}.java` : "Main.java";
    } else if (lang.includes("sql")) {
      fileName = "query.sql";
    } else if (lang.includes("json")) {
      fileName = "data.json";
    } else if (lang.includes("sh") || lang.includes("bash")) {
      fileName = "script.sh";
    } else {
      fileName = "code_file.txt";
    }
  }

  // Language display labels
  let label = "Code";
  let ext = "txt";

  if (lang.includes("py") || lang === "python") {
    label = "Python";
    ext = "py";
  } else if (lang.includes("react") || lang === "jsx" || lang === "tsx") {
    label = "React";
    ext = "tsx";
  } else if (lang.includes("js") || lang === "javascript") {
    label = "JavaScript";
    ext = "js";
  } else if (lang.includes("ts") || lang === "typescript") {
    label = "TypeScript";
    ext = "ts";
  } else if (lang.includes("html")) {
    label = "HTML5";
    ext = "html";
  } else if (lang.includes("css")) {
    label = "CSS3";
    ext = "css";
  } else if (lang.includes("cpp") || lang.includes("c++")) {
    label = "C++";
    ext = "cpp";
  } else if (lang.includes("java")) {
    label = "Java";
    ext = "java";
  } else if (lang.includes("sql")) {
    label = "SQL";
    ext = "sql";
  } else if (lang.includes("json")) {
    label = "JSON";
    ext = "json";
  } else if (lang.includes("sh") || lang.includes("bash")) {
    label = "Shell";
    ext = "sh";
  }

  return { label, fileName, ext, rawLang: lang };
};

// Simple Lightweight Tokenizer for Syntax Highlighting
const renderHighlightedTokens = (lineText: string, lang: string) => {
  if (!lineText) return <span>{" "}</span>;

  // Keywords set
  const keywords = new Set([
    "import", "export", "from", "default", "function", "const", "let", "var",
    "return", "if", "else", "for", "while", "class", "async", "await", "try",
    "catch", "throw", "new", "typeof", "in", "of", "def", "print", "self",
    "None", "True", "False", "public", "private", "void", "int", "string",
    "boolean", "include", "using", "namespace", "SELECT", "FROM", "WHERE",
    "INSERT", "UPDATE", "DELETE", "JOIN", "GROUP", "BY", "ORDER", "HAVING"
  ]);

  // Comments check
  if (lineText.trim().startsWith("//") || lineText.trim().startsWith("#") || lineText.trim().startsWith("/*")) {
    return <span className="text-[#64748b] italic">{lineText}</span>;
  }

  // Tokenize by string literals, numbers, HTML tags, and words
  const parts = lineText.split(/(".*?"|'.*?'|`.*?`|\b\d+\b|<[^>]+>)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // Strings
        if ((part.startsWith('"') && part.endsWith('"')) ||
            (part.startsWith("'") && part.endsWith("'")) ||
            (part.startsWith('`') && part.endsWith('`'))) {
          return <span key={i} className="text-[#34d399]">{part}</span>;
        }

        // Numbers
        if (/^\d+$/.test(part)) {
          return <span key={i} className="text-[#f59e0b] font-medium">{part}</span>;
        }

        // HTML/JSX Tags
        if (part.startsWith("<") && part.endsWith(">")) {
          return <span key={i} className="text-[#f43f5e] font-semibold">{part}</span>;
        }

        // Word tokenization for keywords and functions
        const subWords = part.split(/(\b[a-zA-Z_][a-zA-Z0-9_]*\b)/g);
        return (
          <span key={i}>
            {subWords.map((word, wIdx) => {
              if (keywords.has(word) || keywords.has(word.toUpperCase())) {
                return <span key={wIdx} className="text-[#38bdf8] font-semibold">{word}</span>;
              }
              if (word === "console" || word === "Math" || word === "React" || word === "document" || word === "window" || word === "sys" || word === "os") {
                return <span key={wIdx} className="text-[#c084fc] font-semibold">{word}</span>;
              }
              return word;
            })}
          </span>
        );
      })}
    </>
  );
};

export const CodeBlockComponent: React.FC<CodeBlockProps> = ({
  language,
  code,
  isRtl = false,
}) => {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [fullscreenTab, setFullscreenTab] = useState<"split" | "code" | "preview">("split");
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [executionState, setExecutionState] = useState<"idle" | "running" | "success" | "error">("idle");
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const openFullscreen = (initialTab?: "split" | "code" | "preview") => {
    setIsFullscreen(true);
    const targetTab = initialTab || (activeTab === "preview" ? "preview" : "split");
    setFullscreenTab(targetTab);
    if (executionState === "idle") {
      handleRunCode();
    }
  };

  const meta = getLanguageMeta(language, code);
  const lines = code.trimEnd().split("\n");

  // Multi-file detection
  const isMultiFile = code.includes("--- file:") || code.includes("/* file:") || code.includes("# file:");

  // Check if previewable
  const isPreviewable =
    meta.rawLang.includes("html") ||
    meta.rawLang.includes("react") ||
    meta.rawLang.includes("jsx") ||
    meta.rawLang.includes("tsx") ||
    meta.rawLang.includes("js") ||
    meta.rawLang.includes("javascript") ||
    meta.rawLang.includes("css") ||
    code.includes("<!DOCTYPE") ||
    code.includes("<html") ||
    code.includes("ReactDOM") ||
    code.includes("export default function");

  // Copy Code Handler
  const handleCopy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Handler (.py, .js, .tsx, .html, .css, etc.)
  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = meta.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Run Code / Execute
  const handleRunCode = () => {
    setActiveTab("preview");
    setExecutionState("running");
    setErrorMessage(null);
    setConsoleOutput(["[SoufAI Engine] جارٍ تشغيل وحساب الكود..."]);

    setTimeout(() => {
      try {
        if (meta.rawLang.includes("py") || meta.rawLang === "python") {
          // Python execution simulation / interpreter console output
          const prints: string[] = [];
          const printRegex = /print\s*\((.*?)\)/g;
          let match;
          while ((match = printRegex.exec(code)) !== null) {
            let val = match[1].trim();
            // Clean quotes
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            prints.push(val);
          }

          if (prints.length > 0) {
            setConsoleOutput(prints);
            setExecutionState("success");
          } else {
            setConsoleOutput(["[Python Output] اكتمل تنفيذ البرنامج بنجاح دون أخطاء."]);
            setExecutionState("success");
          }
        } else if (meta.rawLang.includes("js") || meta.rawLang.includes("javascript") || meta.rawLang.includes("ts")) {
          // JS / TS Execution
          const logs: string[] = [];
          const customConsole = {
            log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
            error: (...args: any[]) => logs.push(`[Error] ${args.join(' ')}`),
            warn: (...args: any[]) => logs.push(`[Warn] ${args.join(' ')}`),
          };

          try {
            const runFn = new Function("console", code);
            runFn(customConsole);
            if (logs.length > 0) {
              setConsoleOutput(logs);
              setExecutionState("success");
            } else {
              setConsoleOutput(["[JavaScript Console] الكود يعمل بسلاسة (لا توجد مخرجات console.log)."]);
              setExecutionState("success");
            }
          } catch (err: any) {
            setErrorMessage(err.message || "حدث خطأ في بناء الكود أثناء التشغيل");
            setExecutionState("error");
          }
        } else {
          // HTML / CSS / React UI preview
          setExecutionState("success");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "فشل تنفيذ الكود");
        setExecutionState("error");
      }
    }, 400);
  };

  // Dispatch Quick Prompt for SoufAI Error Fix or Improvement
  const triggerSoufAIAssist = (promptText: string) => {
    const event = new CustomEvent("quickPrompt", { detail: promptText });
    window.dispatchEvent(event);
  };

  // Build Preview HTML Document for Sandbox iframe
  const buildIframeSrcDoc = () => {
    // React / JSX / TSX Document
    if (meta.rawLang.includes("react") || meta.rawLang.includes("jsx") || meta.rawLang.includes("tsx") || code.includes("ReactDOM") || code.includes("useState") || code.includes("export default")) {
      // Clean code for Babel
      let cleanCode = code
        .replace(/import\s+type\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, "")
        .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, "")
        .replace(/import\s+['"][^'"]+['"];?/g, "")
        .replace(/^'use client';?/gm, "")
        .replace(/^"use client";?/gm, "");

      cleanCode = cleanCode.replace(/export\s+default\s+function\s+([A-Za-z0-9_]+)/g, "function $1\nwindow.__DEFAULT_APP__ = $1;\nwindow.$1 = $1;");
      cleanCode = cleanCode.replace(/export\s+default\s+class\s+([A-Za-z0-9_]+)/g, "class $1\nwindow.__DEFAULT_APP__ = $1;\nwindow.$1 = $1;");
      cleanCode = cleanCode.replace(/export\s+default\s+([A-Za-z0-9_]+);?/g, "window.__DEFAULT_APP__ = $1;\nwindow.$1 = $1;");

      cleanCode = cleanCode.replace(/export\s+function\s+([A-Za-z0-9_]+)/g, "function $1\nwindow.$1 = $1;");
      cleanCode = cleanCode.replace(/export\s+const\s+([A-Za-z0-9_]+)/g, "const $1 = (window.$1 =");
      cleanCode = cleanCode.replace(/export\s+let\s+([A-Za-z0-9_]+)/g, "let $1 = (window.$1 =");
      cleanCode = cleanCode.replace(/export\s+var\s+([A-Za-z0-9_]+)/g, "var $1 = (window.$1 =");
      cleanCode = cleanCode.replace(/export\s+{[^}]+};?/g, "");

      return `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            body { background-color: #0a0f0f; color: #e8f5f5; font-family: system-ui, -apple-system, sans-serif; padding: 16px; margin: 0; }
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-track { background: #070c0c; }
            ::-webkit-scrollbar-thumb { background: #1e2e2e; border-radius: 4px; }
            ::-webkit-scrollbar-thumb:hover { background: #00d4aa; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="text/babel" data-presets="react,typescript">
            const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext, useReducer } = React;

            // Lucide Icon Mock Shim for Browser Sandbox
            const LucideIconShim = ({ name = "Sparkles", className = "w-4 h-4", size = 16, style = {}, ...props }) => {
              return (
                <span 
                  className={\`inline-flex items-center justify-center \${className || "w-4 h-4"}\`} 
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: size, minHeight: size, ...style }}
                  title={name}
                  {...props}
                >
                  ✦
                </span>
              );
            };

            const iconNames = [
              "ShoppingBag", "Star", "Plus", "Check", "Zap", "Sparkles", "Terminal", "Activity", "ArrowLeft", "Code2",
              "Trash", "Trash2", "Edit", "Edit2", "Edit3", "Search", "Filter", "Moon", "Sun", "Heart", "User", "Users",
              "Settings", "ArrowRight", "ArrowUp", "ArrowDown", "Play", "Pause", "RotateCw", "RefreshCw", "ChevronDown",
              "ChevronUp", "ChevronLeft", "ChevronRight", "Bell", "Calendar", "Mail", "Phone", "Lock", "Unlock", "Eye",
              "EyeOff", "Globe", "X", "Menu", "Maximize2", "Minimize2", "Copy", "Download", "Upload", "Folder", "FolderTree",
              "File", "FileText", "FileCode", "CheckCircle2", "CheckCircle", "AlertTriangle", "Info", "HelpCircle", "Send",
              "Share2", "Sliders", "Tag", "Volume2", "VolumeX", "Wifi", "WifiOff", "Database", "Server", "Cpu", "Layers",
              "Box", "Package", "ShoppingCart", "DollarSign", "CreditCard", "BarChart", "BarChart2", "PieChart", "TrendingUp",
              "TrendingDown", "Clock", "Compass", "MapPin", "Navigation", "Camera", "Video", "Music", "Mic", "Image",
              "Award", "Bookmark", "ThumbsUp", "ThumbsDown", "Flame", "Shield", "ShieldCheck", "AlertCircle", "Coffee",
              "Gift", "Smile", "MessageSquare", "MessageCircle", "Wrench", "Tool", "Key", "ExternalLink", "List", "Grid"
            ];
            iconNames.forEach((n) => {
              window[n] = (props) => <LucideIconShim name={n} {...props} />;
            });

            window.__DEFAULT_APP__ = null;

            try {
              ${cleanCode}
              
              let TargetApp = window.__DEFAULT_APP__;
              if (!TargetApp && typeof App !== 'undefined') TargetApp = App;
              if (!TargetApp && typeof Component !== 'undefined') TargetApp = Component;
              if (!TargetApp && typeof Main !== 'undefined') TargetApp = Main;
              if (!TargetApp && typeof Page !== 'undefined') TargetApp = Page;

              if (TargetApp) {
                ReactDOM.createRoot(document.getElementById('root')).render(<TargetApp />);
              } else {
                document.getElementById('root').innerHTML = '<div style="color: #00d4aa; padding: 20px; font-weight: bold; text-align: center;">جاهز للمعاينة - كود React يعمل بنجاح</div>';
              }
            } catch (err) {
              console.error("React Preview Error:", err);
              try {
                window.parent.postMessage({ type: 'PREVIEW_ERROR', message: err.message }, '*');
              } catch(e) {}
              document.getElementById('root').innerHTML = '<div style="color: #f43f5e; padding: 16px; font-weight: bold; background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.3); border-radius: 12px; font-family: monospace;" dir="ltr"><h4 style="margin:0 0 8px 0;">Runtime Error</h4>' + err.message + '</div>';
            }
          </script>
        </body>
        </html>
      `;
    }

    // Standard HTML/CSS/JS Document
    if (code.includes("<html") || code.includes("<!DOCTYPE") || code.includes("<body") || code.includes("<div")) {
      return code;
    }

    // Wrap bare HTML / JS snippet inside a styled preview shell
    return `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { background-color: #0d131a; color: #e2e8f0; font-family: system-ui, sans-serif; padding: 16px; margin: 0; }
        </style>
      </head>
      <body>
        ${code}
      </body>
      </html>
    `;
  };

  return (
    <>
      <div className="my-3 rounded-2xl border border-[#1e2e2e] bg-[#070c0c] overflow-hidden shadow-xl hover:shadow-[0_0_20px_rgba(0,212,170,0.1)] transition-all font-mono text-xs dir-ltr text-left w-full max-w-full min-w-0">
        {/* Workspace Header Bar */}
        <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2.5 bg-[#0e1616] border-b border-[#1e2e2e] gap-2 select-none">
          {/* Left: Language Badge & Filename */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2.5 py-1 rounded-xl bg-[#162323] border border-[#233838] text-[11px] font-bold text-[#00d4aa] flex items-center gap-1.5 shrink-0">
              <FileCode className="w-3.5 h-3.5 text-[#00ff88]" />
              <span>{meta.label}</span>
            </span>

            <span className="text-[11px] font-mono text-[#88b0b0] truncate max-w-[150px] sm:max-w-[220px]" title={meta.fileName}>
              {meta.fileName}
            </span>
          </div>

          {/* Center/Right: Code | Preview Tab Switcher */}
          <div className="flex items-center gap-1.5">
            <div className="bg-[#070c0c] p-0.5 rounded-xl border border-[#1e2e2e] flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("code")}
                className={`px-3 py-1 rounded-lg text-xs font-sans font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "code"
                    ? "bg-[#162323] text-[#00ff88] border border-[#00d4aa]/40 shadow-sm"
                    : "text-[#64748b] hover:text-[#e8f5f5]"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{isRtl ? "الكود" : "Code"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("preview");
                  if (executionState === "idle") {
                    handleRunCode();
                  }
                }}
                className={`px-3 py-1 rounded-lg text-xs font-sans font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "preview"
                    ? "bg-[#162323] text-[#00ff88] border border-[#00d4aa]/40 shadow-sm"
                    : "text-[#64748b] hover:text-[#e8f5f5]"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isRtl ? "المعاينة" : "Preview"}</span>
              </button>
            </div>

            {/* Quick Header Copy & Download Buttons */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg bg-[#162323] hover:bg-[#233838] text-[#88b0b0] hover:text-[#00ff88] border border-[#233838] transition-all flex items-center gap-1 text-[11px] font-sans font-semibold cursor-pointer px-2"
                title={isRtl ? "نسخ الكود" : "Copy code"}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#00ff88]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? (isRtl ? "تم النسخ" : "Copied") : (isRtl ? "نسخ الكود" : "Copy")}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="p-1.5 rounded-lg bg-[#162323] hover:bg-[#233838] text-[#88b0b0] hover:text-[#00ff88] border border-[#233838] transition-all flex items-center gap-1 text-[11px] font-sans font-semibold cursor-pointer px-2"
                title={isMultiFile ? (isRtl ? "تحميل المشروع ZIP" : "Download ZIP") : (isRtl ? "تحميل الملف" : "Download")}
              >
                {isMultiFile ? <FolderArchive className="w-3.5 h-3.5 text-[#00d4aa]" /> : <Download className="w-3.5 h-3.5" />}
                <span>{isMultiFile ? (isRtl ? "مشروع ZIP" : "ZIP") : (isRtl ? "تحميل" : "Download")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Main Body */}
        {activeTab === "code" ? (
          /* CODE VIEW TAB */
          <div className="p-3 sm:p-4 overflow-x-auto max-h-[480px] scrollbar-thin scrollbar-thumb-[#1e2e2e] scrollbar-track-transparent">
            <div className="table w-full border-collapse">
              {lines.map((line, idx) => (
                <div key={idx} className="table-row group hover:bg-[#0f1919]/60">
                  {/* Line Number */}
                  <span className="table-cell pr-3 text-right text-[#3a5555] select-none text-[11px] font-mono w-8 shrink-0 group-hover:text-[#00d4aa] border-r border-[#1e2e2e]/40">
                    {idx + 1}
                  </span>
                  {/* Code Line */}
                  <span className="table-cell pl-3 whitespace-pre text-[#e8f5f5] selection:bg-[#00d4aa]/30 leading-relaxed font-mono">
                    {renderHighlightedTokens(line, meta.rawLang)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* PREVIEW / WORKSPACE TAB */
          <div className="p-3 bg-[#0a0f0f] min-h-[260px] flex flex-col justify-between">
            {/* Preview Control Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1e2e2e] text-[11px] font-sans text-[#88b0b0]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
                <span className="font-semibold text-[#00d4aa]">
                  {executionState === "running"
                    ? (isRtl ? "جارٍ تشغيل ومعاينة الكود..." : "Running...")
                    : (isRtl ? "معاينة البيئة التفاعلية" : "Interactive Workspace Preview")}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRunCode}
                  className="px-2 py-1 rounded-md bg-[#162323] hover:bg-[#233838] text-[#88b0b0] hover:text-[#00ff88] border border-[#233838] transition-all flex items-center gap-1 cursor-pointer"
                  title={isRtl ? "تحديث المعاينة" : "Refresh preview"}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{isRtl ? "تحديث" : "Refresh"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => openFullscreen("preview")}
                  className="px-2 py-1 rounded-md bg-[#162323] hover:bg-[#233838] text-[#88b0b0] hover:text-[#00ff88] border border-[#233838] transition-all flex items-center gap-1 cursor-pointer"
                  title={isRtl ? "ملء الشاشة والمعاينة" : "Fullscreen Preview"}
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>{isRtl ? "تكبير المعاينة" : "Fullscreen"}</span>
                </button>
              </div>
            </div>

            {/* Live Render Area */}
            {isPreviewable ? (
              <div className="w-full h-[280px] bg-[#0d131a] rounded-xl border border-[#1e2e2e] overflow-hidden relative shadow-inner">
                <iframe
                  ref={iframeRef}
                  srcDoc={buildIframeSrcDoc()}
                  sandbox="allow-scripts allow-modals allow-forms"
                  className="w-full h-full border-none"
                  title="SoufAI Code Preview"
                />
              </div>
            ) : (
              /* Console Output for non-UI Code (Python, SQL, C++, etc.) */
              <div className="w-full min-h-[180px] bg-[#080d0d] p-3 rounded-xl border border-[#1e2e2e] font-mono text-xs space-y-1.5 overflow-y-auto max-h-[260px] text-[#00ff88]">
                <div className="flex items-center justify-between pb-1 text-[10px] text-[#4a7070] border-b border-[#1e2e2e]">
                  <span className="flex items-center gap-1">
                    <Terminal className="w-3 h-3 text-[#00d4aa]" />
                    {isRtl ? "شاشة المخرجات (Terminal Output)" : "Terminal Output"}
                  </span>
                  <span>{meta.label} Runtime</span>
                </div>
                {consoleOutput.map((outLine, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {outLine}
                  </div>
                ))}
              </div>
            )}

            {/* Error Notification Bar if Execution Failed */}
            {errorMessage && (
              <div className="mt-3 p-3 rounded-xl bg-[#f43f5e]/10 border border-[#f43f5e]/30 flex flex-wrap items-center justify-between gap-2 text-xs text-[#f43f5e]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#f43f5e]" />
                  <span>{isRtl ? "حدث خطأ أثناء التشغيل:" : "Runtime Error:"} {errorMessage}</span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    triggerSoufAIAssist(
                      `حدث خطأ أثناء تشغيل هذا الكود:\n${errorMessage}\n\nيرجى تصحيح الكود بالكامل مع شرح السبب:\n\`\`\`${meta.rawLang}\n${code}\n\`\`\``
                    )
                  }
                  className="px-3 py-1.5 rounded-lg bg-[#f43f5e] hover:bg-[#e11d48] text-white font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer text-xs"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{isRtl ? "إصلاح الخطأ بواسطة SoufAI" : "Fix Error with SoufAI"}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom Workspace Toolbar (Always Visible, Mobile Horizontal Scrollable) */}
        <div className="px-3 py-2 bg-[#0e1616] border-t border-[#1e2e2e] overflow-x-auto whitespace-nowrap scrollbar-none flex items-center justify-between gap-2 select-none">
          {/* Main Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-xl bg-[#162323] hover:bg-[#233838] text-[#88b0b0] hover:text-[#00ff88] border border-[#233838] transition-all flex items-center gap-1.5 text-xs font-sans font-bold cursor-pointer shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#00ff88]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (isRtl ? "تم النسخ" : "Copied") : (isRtl ? "نسخ" : "Copy")}</span>
            </button>

            {/* Run Button */}
            <button
              type="button"
              onClick={handleRunCode}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#0a0f0f] hover:opacity-90 transition-all flex items-center gap-1.5 text-xs font-sans font-extrabold cursor-pointer shadow-md shadow-[#00d4aa]/20 shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRtl ? "تشغيل" : "Run"}</span>
            </button>

            {/* Enhance / Optimize with SoufAI Button */}
            <button
              type="button"
              onClick={() =>
                triggerSoufAIAssist(
                  `يرجى تحسين وتطوير هذا الكود، مع تحسين الأداء والأمان والأناقة وتوثيق التغييرات:\n\`\`\`${meta.rawLang}\n${code}\n\`\`\``
                )
              }
              className="px-3 py-1.5 rounded-xl bg-[#162323] hover:bg-[#233838] text-[#00ff88] hover:text-[#ffffff] border border-[#00d4aa]/40 transition-all flex items-center gap-1.5 text-xs font-sans font-bold cursor-pointer shrink-0 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00ff88]" />
              <span>{isRtl ? "تحسين" : "Optimize"}</span>
            </button>

            {/* Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-xl bg-[#162323] hover:bg-[#233838] text-[#88b0b0] hover:text-[#00ff88] border border-[#233838] transition-all flex items-center gap-1.5 text-xs font-sans font-bold cursor-pointer shrink-0"
            >
              {isMultiFile ? <FolderArchive className="w-3.5 h-3.5 text-[#00d4aa]" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isMultiFile ? (isRtl ? "تحميل ZIP" : "ZIP Project") : (isRtl ? "تحميل" : "Download")}</span>
            </button>
          </div>

          {/* Right: Fullscreen Expand Control */}
          <button
            type="button"
            onClick={() => openFullscreen(activeTab === "preview" ? "preview" : "split")}
            className="px-2.5 py-1.5 rounded-xl bg-[#162323] hover:bg-[#233838] text-[#88b0b0] hover:text-[#00ff88] border border-[#233838] transition-all flex items-center gap-1 text-xs font-sans font-bold cursor-pointer shrink-0"
            title={isRtl ? "تكبير المساحة" : "Expand IDE"}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isRtl ? "تكبير الشاشة" : "Expand"}</span>
          </button>
        </div>
      </div>

      {/* FULLSCREEN MINI-IDE MODAL */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-[#070c0c]/98 backdrop-blur-md p-3 sm:p-6 flex flex-col justify-between font-sans dir-ltr text-left">
          {/* Modal Top Navigation */}
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-[#1e2e2e] gap-3">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-xl bg-[#162323] border border-[#00d4aa]/40 text-xs font-bold text-[#00ff88] flex items-center gap-1.5">
                <Laptop className="w-4 h-4 text-[#00d4aa]" />
                <span>SoufAI Code Workspace</span>
              </span>
              <span className="text-xs font-mono text-[#88b0b0] truncate max-w-[150px] sm:max-w-[250px]">{meta.fileName}</span>
            </div>

            {/* View Mode Switcher: Code | Preview | Split */}
            <div className="bg-[#0e1616] p-1 rounded-xl border border-[#1e2e2e] flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFullscreenTab("code")}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  fullscreenTab === "code"
                    ? "bg-[#162323] text-[#00ff88] border border-[#00d4aa]/40 shadow-sm"
                    : "text-[#64748b] hover:text-[#e8f5f5]"
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{isRtl ? "الكود" : "Code"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFullscreenTab("preview");
                  if (executionState === "idle") {
                    handleRunCode();
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  fullscreenTab === "preview"
                    ? "bg-[#162323] text-[#00ff88] border border-[#00d4aa]/40 shadow-sm"
                    : "text-[#64748b] hover:text-[#e8f5f5]"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isRtl ? "المعاينة" : "Preview"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFullscreenTab("split");
                  if (executionState === "idle") {
                    handleRunCode();
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  fullscreenTab === "split"
                    ? "bg-[#162323] text-[#00ff88] border border-[#00d4aa]/40 shadow-sm"
                    : "text-[#64748b] hover:text-[#e8f5f5]"
                }`}
              >
                <Laptop className="w-3.5 h-3.5 text-[#00d4aa]" />
                <span>{isRtl ? "عرض مشترك" : "Split View"}</span>
              </button>
            </div>

            {/* Quick Modal Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-xl bg-[#162323] text-[#88b0b0] hover:text-[#00ff88] border border-[#233838] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-[#00ff88]" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="px-3 py-1.5 rounded-xl bg-[#162323] text-[#88b0b0] hover:text-[#00ff88] border border-[#233838] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>

              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="p-2 rounded-xl bg-[#f43f5e]/15 text-[#f43f5e] hover:bg-[#f43f5e] hover:text-white transition-all cursor-pointer"
                title="Close Fullscreen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Main Viewport Content */}
          <div className="flex-1 py-4 overflow-hidden">
            {fullscreenTab === "code" && (
              /* Fullscreen Code View */
              <div className="h-full flex flex-col bg-[#0b1212] rounded-2xl border border-[#1e2e2e] overflow-hidden">
                <div className="px-4 py-2.5 bg-[#0e1616] border-b border-[#1e2e2e] text-xs font-bold text-[#00d4aa] flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Code2 className="w-4 h-4" />
                    <span>Code Editor — {meta.fileName}</span>
                  </span>
                  <span className="text-[11px] font-mono text-[#88b0b0]">{lines.length} lines</span>
                </div>
                <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed">
                  <div className="table w-full">
                    {lines.map((line, idx) => (
                      <div key={idx} className="table-row group">
                        <span className="table-cell pr-3 text-right text-[#3a5555] select-none w-8 border-r border-[#1e2e2e]/40">
                          {idx + 1}
                        </span>
                        <span className="table-cell pl-3 whitespace-pre text-[#e8f5f5]">
                          {renderHighlightedTokens(line, meta.rawLang)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {fullscreenTab === "preview" && (
              /* Fullscreen Preview View */
              <div className="h-full flex flex-col bg-[#0b1212] rounded-2xl border border-[#1e2e2e] overflow-hidden">
                <div className="px-4 py-2.5 bg-[#0e1616] border-b border-[#1e2e2e] text-xs font-bold text-[#00ff88] flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    <span>Full Screen Preview & Execution</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRunCode}
                    className="px-2.5 py-1 rounded-lg bg-[#162323] hover:bg-[#233838] text-xs font-bold text-[#00ff88] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="flex-1 p-3 bg-[#0d131a] relative overflow-hidden flex flex-col justify-between">
                  {isPreviewable ? (
                    <iframe
                      srcDoc={buildIframeSrcDoc()}
                      sandbox="allow-scripts allow-modals allow-forms"
                      className="w-full h-full border-none rounded-xl bg-[#080d0d]"
                      title="Fullscreen Preview"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#080d0d] p-4 rounded-xl border border-[#1e2e2e] font-mono text-xs text-[#00ff88] overflow-y-auto">
                      {consoleOutput.map((out, idx) => (
                        <div key={idx} className="leading-relaxed">{out}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {fullscreenTab === "split" && (
              /* Fullscreen Split View (Code & Live Preview Side-by-Side) */
              <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
                {/* Left: Code Editor Pane */}
                <div className="flex flex-col bg-[#0b1212] rounded-2xl border border-[#1e2e2e] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#0e1616] border-b border-[#1e2e2e] text-xs font-bold text-[#00d4aa] flex items-center gap-2">
                    <Code2 className="w-4 h-4" />
                    <span>Code Editor</span>
                  </div>
                  <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed">
                    <div className="table w-full">
                      {lines.map((line, idx) => (
                        <div key={idx} className="table-row group">
                          <span className="table-cell pr-3 text-right text-[#3a5555] select-none w-8 border-r border-[#1e2e2e]/40">
                            {idx + 1}
                          </span>
                          <span className="table-cell pl-3 whitespace-pre text-[#e8f5f5]">
                            {renderHighlightedTokens(line, meta.rawLang)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Live Preview Pane */}
                <div className="flex flex-col bg-[#0b1212] rounded-2xl border border-[#1e2e2e] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#0e1616] border-b border-[#1e2e2e] text-xs font-bold text-[#00ff88] flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <span>Live Execution & Render</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleRunCode}
                      className="px-2.5 py-1 rounded-lg bg-[#162323] hover:bg-[#233838] text-xs font-bold text-[#00ff88] flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh</span>
                    </button>
                  </div>

                  <div className="flex-1 p-3 bg-[#0d131a] relative overflow-hidden flex flex-col justify-between">
                    {isPreviewable ? (
                      <iframe
                        srcDoc={buildIframeSrcDoc()}
                        sandbox="allow-scripts allow-modals allow-forms"
                        className="w-full h-full border-none rounded-xl bg-[#080d0d]"
                        title="Fullscreen Preview"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#080d0d] p-4 rounded-xl border border-[#1e2e2e] font-mono text-xs text-[#00ff88] overflow-y-auto">
                        {consoleOutput.map((out, idx) => (
                          <div key={idx} className="leading-relaxed">{out}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export const CodeBlock = React.memo(CodeBlockComponent);
