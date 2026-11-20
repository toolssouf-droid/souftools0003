"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Code2,
  Play,
  FileCode,
  FolderTree,
  Terminal,
  RotateCw,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Download,
  Smartphone,
  Tablet,
  Monitor,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Globe,
  Plus,
  Trash2,
  Undo2,
  Send,
  AlertCircle,
  FilePlus,
} from "lucide-react";
import { ProjectWorkspace, SupportedFramework, WorkspaceFile } from "@/lib/agent/coding/types";
import { FRAMEWORK_PRESETS } from "@/lib/agent/coding/frameworkPresets";
import { copyToClipboard } from "@/lib/utils";

// Pure client-side zero-dependency ZIP archive generator
function createSimpleZipBlob(files: Record<string, string>): Blob {
  const fileEntries = Object.entries(files);
  const textEncoder = new TextEncoder();
  
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c >>> 0;
  }
  
  function getCrc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const localHeaders: Uint8Array[] = [];
  const centralDirHeaders: Uint8Array[] = [];
  let offset = 0;

  for (const [name, content] of fileEntries) {
    const nameBytes = textEncoder.encode(name);
    const contentBytes = textEncoder.encode(content);
    const crc = getCrc32(contentBytes);
    const size = contentBytes.length;

    // Local file header (30 bytes + nameBytes.length + size)
    const localHeader = new Uint8Array(30 + nameBytes.length + size);
    const view = new DataView(localHeader.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localHeader.set(contentBytes, 30 + nameBytes.length);
    localHeaders.push(localHeader);

    // Central directory header (46 bytes + nameBytes.length)
    const cdHeader = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cdHeader.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 0, true);
    cdView.setUint16(12, 0, true);
    cdView.setUint32(16, crc, true);
    cdView.setUint32(20, size, true);
    cdView.setUint32(24, size, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint16(30, 0, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0, true);
    cdView.setUint32(42, offset, true);
    cdHeader.set(nameBytes, 46);
    centralDirHeaders.push(cdHeader);

    offset += localHeader.length;
  }

  let cdSize = 0;
  for (const h of centralDirHeaders) cdSize += h.length;

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, fileEntries.length, true);
  eocdView.setUint16(10, fileEntries.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  return new Blob([...localHeaders, ...centralDirHeaders, eocd] as any[], {
    type: "application/zip",
  });
}

interface CodingWorkspaceWidgetProps {
  data: {
    workspace?: ProjectWorkspace;
    summary?: string;
    steps?: any[];
    logs?: any[];
  };
  isRtl?: boolean;
}

interface SandboxLog {
  id: string;
  level: "log" | "info" | "warn" | "error" | "eval";
  message: string;
  timestamp: number;
}

export const CodingWorkspaceWidget: React.FC<CodingWorkspaceWidgetProps> = ({
  data,
  isRtl = true,
}) => {
  const initialWs = data?.workspace;
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(initialWs || null);
  const [activeTab, setActiveTab] = useState<"preview" | "code" | "files" | "terminal">("preview");
  const [selectedFilePath, setSelectedFilePath] = useState<string>(
    initialWs?.activeFilePath || Object.keys(initialWs?.files || {})[0] || "src/App.tsx"
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [copied, setCopied] = useState<boolean>(false);
  const [zipDownloading, setZipDownloading] = useState<boolean>(false);
  const [previewKey, setPreviewKey] = useState<number>(0);

  // Live code editing state
  const [editedCode, setEditedCode] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // New file creation state
  const [isAddingFile, setIsAddingFile] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>("");

  // Live Terminal Logs and Interactive REPL
  const [terminalLogs, setTerminalLogs] = useState<SandboxLog[]>([]);
  const [terminalInput, setTerminalInput] = useState<string>("");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync workspace from props if changed
  useEffect(() => {
    if (data?.workspace) {
      setWorkspace(data.workspace);
      const initialPath = data.workspace.activeFilePath || Object.keys(data.workspace.files || {})[0] || "src/App.tsx";
      setSelectedFilePath(initialPath);
      if (data.workspace.files?.[initialPath]) {
        setEditedCode(data.workspace.files[initialPath].content);
      }
    }
  }, [data?.workspace]);

  // Keep editedCode in sync when switching selected file
  useEffect(() => {
    if (workspace && workspace.files?.[selectedFilePath]) {
      setEditedCode(workspace.files[selectedFilePath].content);
      setHasUnsavedChanges(false);
    }
  }, [selectedFilePath, workspace]);

  // Listen for real console and runtime error messages from sandbox iframe
  useEffect(() => {
    const handleSandboxMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "SANDBOX_CONSOLE") {
        const newLog: SandboxLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          level: event.data.level || "log",
          message: event.data.message || "",
          timestamp: event.data.timestamp || Date.now(),
        };
        setTerminalLogs((prev) => [...prev.slice(-100), newLog]);
      } else if (event.data.type === "PREVIEW_ERROR") {
        setRuntimeError(event.data.message || "Runtime execution error in sandbox.");
        const errorLog: SandboxLog = {
          id: `err_${Date.now()}`,
          level: "error",
          message: `❌ ${event.data.message || "Runtime execution error."}`,
          timestamp: Date.now(),
        };
        setTerminalLogs((prev) => [...prev.slice(-100), errorLog]);
      }
    };

    window.addEventListener("message", handleSandboxMessage);
    return () => {
      window.removeEventListener("message", handleSandboxMessage);
    };
  }, []);

  if (!workspace) {
    return (
      <div className="p-4 rounded-2xl bg-[#0c1414] border border-[#1e2e2e] text-xs text-[#88b0b0]">
        {isRtl ? "جاري تحميل بيئة العمل البرمجية..." : "Loading coding workspace..."}
      </div>
    );
  }

  const framework: SupportedFramework = workspace.framework || "react";
  const preset = FRAMEWORK_PRESETS[framework] || FRAMEWORK_PRESETS.react;

  // Build raw files dictionary for live compilation
  const rawFiles: Record<string, string> = {};
  Object.entries(workspace.files || {}).forEach(([p, f]) => {
    rawFiles[p] = f.content;
  });

  // Compile bundle HTML
  let htmlPreviewContent = "";
  try {
    const bundle = preset.buildRunner(rawFiles);
    htmlPreviewContent = bundle.previewHtml || "<h1>No Preview Content</h1>";
  } catch (err: any) {
    htmlPreviewContent = `<div style="color:red;padding:20px;">Preview Error: ${err?.message}</div>`;
  }

  const currentFile = workspace.files[selectedFilePath] || Object.values(workspace.files)[0];
  const fileEntries = Object.entries(workspace.files || {});

  // Handle Code Editing Changes
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedCode(e.target.value);
    setHasUnsavedChanges(true);
    setRuntimeError(null);
  };

  // Handle Tab key in Code Editor for smooth indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      setEditedCode(newValue);
      setHasUnsavedChanges(true);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Apply and Run Edited Code live
  const handleApplyAndRun = () => {
    if (!workspace) return;
    setIsCompiling(true);
    setRuntimeError(null);

    const updatedFiles: Record<string, WorkspaceFile> = {
      ...workspace.files,
      [selectedFilePath]: {
        path: selectedFilePath,
        content: editedCode,
        language: currentFile?.language || "typescript",
        lastModified: Date.now(),
        updatedAt: Date.now(),
      },
    };

    setWorkspace({
      ...workspace,
      files: updatedFiles,
    });
    setHasUnsavedChanges(false);

    // Refresh preview with new bundle
    setTimeout(() => {
      setPreviewKey((prev) => prev + 1);
      setIsCompiling(false);
    }, 150);

    const runLog: SandboxLog = {
      id: `run_${Date.now()}`,
      level: "info",
      message: `⚡ Applied live changes to ${selectedFilePath} & re-compiled bundle.`,
      timestamp: Date.now(),
    };
    setTerminalLogs((prev) => [...prev, runLog]);
  };

  // Revert file code to original
  const handleRevertCode = () => {
    if (workspace?.files?.[selectedFilePath]) {
      setEditedCode(workspace.files[selectedFilePath].content);
      setHasUnsavedChanges(false);
      setRuntimeError(null);
    }
  };

  // Add a new file to the workspace
  const handleAddNewFile = () => {
    if (!newFileName.trim() || !workspace) return;
    let path = newFileName.trim();
    if (!path.includes("/")) {
      path = `src/${path}`;
    }

    const ext = path.split(".").pop() || "tsx";
    const defaultContent = path.endsWith(".css")
      ? "/* Custom Stylesheet */\n"
      : path.endsWith(".json")
      ? "{\n  \"name\": \"custom\"\n}\n"
      : `import React from 'react';\n\nexport function ${path.split("/").pop()?.replace(/\.[^/.]+$/, "")}() {\n  return (\n    <div className="p-4 bg-[#111a1a] rounded-xl border border-[#1e2e2e] text-white">\n      <h4>Custom Component</h4>\n    </div>\n  );\n}\n`;

    const updatedFiles = {
      ...workspace.files,
      [path]: {
        path,
        content: defaultContent,
        language: ext === "ts" || ext === "tsx" ? "typescript" : ext,
        lastModified: Date.now(),
      },
    };

    setWorkspace({
      ...workspace,
      files: updatedFiles,
    });

    setSelectedFilePath(path);
    setEditedCode(defaultContent);
    setNewFileName("");
    setIsAddingFile(false);
    setActiveTab("code");
  };

  // Delete a file
  const handleDeleteFile = (pathToDelete: string) => {
    if (!workspace || Object.keys(workspace.files).length <= 1) return;
    const updatedFiles = { ...workspace.files };
    delete updatedFiles[pathToDelete];

    const nextPath = Object.keys(updatedFiles)[0];
    setWorkspace({
      ...workspace,
      files: updatedFiles,
    });
    setSelectedFilePath(nextPath);
  };

  // Send REPL command to sandbox
  const handleSendReplCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "EVAL_CODE",
          code: terminalInput.trim(),
        },
        "*"
      );
    }

    setTerminalInput("");
  };

  // Project Download as ZIP
  const handleDownloadZip = async () => {
    if (!workspace) return;
    setZipDownloading(true);

    try {
      const filesToZip: Record<string, string> = {};

      // Add all workspace files
      Object.entries(workspace.files || {}).forEach(([filePath, file]) => {
        filesToZip[filePath] = file.content;
      });

      // Ensure package.json exists
      if (!filesToZip["package.json"]) {
        filesToZip["package.json"] = JSON.stringify(
          {
            name: workspace.title?.toLowerCase().replace(/\s+/g, "-") || "souf-project",
            version: "1.0.0",
            private: true,
            scripts: {
              dev: "vite",
              build: "vite build",
              preview: "vite preview",
            },
            dependencies: {
              react: "^19.0.0",
              "react-dom": "^19.0.0",
              "lucide-react": "^0.553.0",
              tailwindcss: "^3.4.0",
            },
          },
          null,
          2
        );
      }

      // Ensure README.md exists
      if (!filesToZip["README.md"]) {
        filesToZip["README.md"] = `# ${workspace.title || "SoufAI Project"}\n\nProject created with SoufAI Autonomous Coding Agent.\n\n## Quick Start\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`;
      }

      const zipBlob = createSimpleZipBlob(filesToZip);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(workspace.title || "souf-project").toLowerCase().replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate zip:", err);
    } finally {
      setZipDownloading(false);
    }
  };

  const handleCopyCode = async () => {
    if (editedCode) {
      await copyToClipboard(editedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefreshPreview = () => {
    setPreviewKey((prev) => prev + 1);
    setRuntimeError(null);
  };

  const handleOpenExternal = () => {
    if (workspace?.previewUrl) {
      window.open(workspace.previewUrl, "_blank");
      return;
    }
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(htmlPreviewContent);
      win.document.close();
    }
  };

  return (
    <div
      className={`rounded-2xl border border-[#00d4aa]/40 bg-[#080d0d] overflow-hidden shadow-2xl transition-all my-3 ${
        isFullscreen
          ? "fixed inset-2 sm:inset-4 z-50 flex flex-col bg-[#080d0d]/98 backdrop-blur-xl border-[#00d4aa]"
          : "w-full max-w-full"
      }`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* 1. Header Toolbar */}
      <div className="px-3.5 py-2.5 bg-[#0e1616] border-b border-[#1e2e2e] flex flex-wrap items-center justify-between gap-2.5 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[#00d4aa] to-[#0ea5e9] flex items-center justify-center text-[#0a0f0f] font-black text-xs shadow-md shadow-[#00d4aa]/20 shrink-0">
            <Code2 className="w-4 h-4 stroke-[2.5]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-[#e8f5f5] truncate">
                {workspace.title || (isRtl ? "بيئة العمل البرمجية التفاعلية" : "Interactive Code Sandbox")}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#00d4aa]/20 text-[#00d4aa] font-mono font-bold border border-[#00d4aa]/40 shrink-0">
                {framework.toUpperCase()}
              </span>
              <span className="hidden sm:inline-flex text-[10px] text-[#88b0b0] bg-[#111a1a] px-2 py-0.5 rounded-md border border-[#1e2e2e]">
                {fileEntries.length} {isRtl ? "ملفات" : "files"}
              </span>
            </div>
            {data?.summary && (
              <p className="text-[11px] text-[#4a7070] truncate max-w-md hidden md:block">
                {data.summary}
              </p>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasUnsavedChanges && (
            <button
              type="button"
              onClick={handleApplyAndRun}
              className="px-2.5 py-1.5 rounded-xl bg-[#00d4aa] text-[#0a0f0f] text-xs font-bold transition-all shadow-md shadow-[#00d4aa]/20 hover:bg-[#00ff88] flex items-center gap-1.5 cursor-pointer animate-pulse"
              title={isRtl ? "تشغيل التعديلات وتحديث المعاينة" : "Apply & Run Changes"}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRtl ? "تشغيل التعديلات" : "Run Code"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={zipDownloading}
            className="p-1.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/40 text-[#88b0b0] hover:text-[#00d4aa] text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title={isRtl ? "تحميل حزمة المشروع الكاملة كملف ZIP" : "Download Project ZIP"}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold hidden sm:inline">
              {zipDownloading ? (isRtl ? "جاري الضغط..." : "Zipping...") : isRtl ? "تحميل ZIP" : "ZIP"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/40 text-[#88b0b0] hover:text-[#00d4aa] text-xs transition-colors cursor-pointer"
            title={isFullscreen ? (isRtl ? "تصغير" : "Exit Fullscreen") : isRtl ? "ملء الشاشة" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="px-3 py-1.5 bg-[#0a1111] border-b border-[#1e2e2e] flex items-center justify-between gap-2 overflow-x-auto select-none">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (hasUnsavedChanges) handleApplyAndRun();
              setActiveTab("preview");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "preview"
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20"
                : "text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#111a1a]"
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRtl ? "المعاينة الحية" : "Live Preview"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("code")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
              activeTab === "code"
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20"
                : "text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#111a1a]"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{isRtl ? "محرر الكود الحي" : "Live Code Editor"}</span>
            {hasUnsavedChanges && (
              <span className="w-2 h-2 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5 animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("files")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "files"
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20"
                : "text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#111a1a]"
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>{isRtl ? "الملفات" : "Files"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("terminal")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer relative ${
              activeTab === "terminal"
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20"
                : "text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#111a1a]"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>{isRtl ? "السجل والموجه" : "Terminal & Logs"}</span>
            {terminalLogs.some((l) => l.level === "error") && (
              <span className="w-2 h-2 rounded-full bg-red-500 absolute -top-0.5 -right-0.5" />
            )}
          </button>
        </div>

        {activeTab === "preview" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDeviceMode("desktop")}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                deviceMode === "desktop"
                  ? "bg-[#00d4aa]/20 border-[#00d4aa] text-[#00d4aa]"
                  : "bg-[#111a1a] border-[#1e2e2e] text-[#88b0b0] hover:text-[#e8f5f5]"
              }`}
              title={isRtl ? "شاشة كمبيوتر" : "Desktop View"}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setDeviceMode("tablet")}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                deviceMode === "tablet"
                  ? "bg-[#00d4aa]/20 border-[#00d4aa] text-[#00d4aa]"
                  : "bg-[#111a1a] border-[#1e2e2e] text-[#88b0b0] hover:text-[#e8f5f5]"
              }`}
              title={isRtl ? "شاشة لوحي (Tablet)" : "Tablet View"}
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setDeviceMode("mobile")}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                deviceMode === "mobile"
                  ? "bg-[#00d4aa]/20 border-[#00d4aa] text-[#00d4aa]"
                  : "bg-[#111a1a] border-[#1e2e2e] text-[#88b0b0] hover:text-[#e8f5f5]"
              }`}
              title={isRtl ? "شاشة هاتف" : "Mobile View"}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleRefreshPreview}
              className="p-1.5 rounded-lg bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/40 text-[#88b0b0] hover:text-[#00d4aa] transition-colors cursor-pointer"
              title={isRtl ? "إعادة تحميل المعاينة" : "Refresh Preview"}
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {activeTab === "code" && (
          <div className="flex items-center gap-1.5">
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={handleRevertCode}
                className="px-2 py-1 rounded-lg bg-[#111a1a] border border-[#1e2e2e] text-[#88b0b0] hover:text-red-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                title={isRtl ? "تراجع عن التعديلات" : "Discard Changes"}
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isRtl ? "تراجع" : "Revert"}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleApplyAndRun}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                hasUnsavedChanges
                  ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20"
                  : "bg-[#111a1a] border border-[#1e2e2e] text-[#00d4aa]"
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRtl ? "تشغيل" : "Run"}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyCode}
              className="px-2.5 py-1 rounded-lg bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/40 text-[#00d4aa] text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#00ff88]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? (isRtl ? "تم النسخ" : "Copied") : isRtl ? "نسخ" : "Copy"}</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Main Viewport Content Area */}
      <div
        className={`${
          isFullscreen ? "flex-1 min-h-[500px]" : "h-[480px] sm:h-[540px]"
        } relative bg-[#060a0a] flex flex-col overflow-hidden`}
      >
        {/* TAB 1: LIVE PREVIEW */}
        {activeTab === "preview" && (
          <div className="w-full h-full flex flex-col bg-[#060a0a] overflow-hidden">
            {/* Address / Status Bar */}
            <div className="px-3 py-1.5 bg-[#0d1414] border-b border-[#1e2e2e] flex items-center justify-between gap-2 shrink-0 select-none">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                </div>
                <div className="h-3 w-px bg-[#1e2e2e]" />
                <span className="flex items-center gap-1 text-[10px] text-[#00ff88] font-bold bg-[#00ff88]/10 px-2 py-0.5 rounded-md border border-[#00ff88]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse"></span>
                  <span>{isRtl ? "تشغيل حي ومباشر" : "Live & Interactive"}</span>
                </span>
              </div>

              {/* URL Address Bar */}
              <div className="flex-1 max-w-lg flex items-center gap-2 bg-[#060a0a] border border-[#1e2e2e] rounded-xl px-3 py-1 text-xs font-mono text-[#88b0b0]">
                <Globe className="w-3.5 h-3.5 text-[#00d4aa] shrink-0" />
                <span className="truncate flex-1 text-[#e8f5f5]">
                  localhost:3000/{selectedFilePath.replace(/\.[^/.]+$/, "")}
                </span>
              </div>

              {/* Open External */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleOpenExternal}
                  className="p-1.5 rounded-lg bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/40 text-[#88b0b0] hover:text-[#00d4aa] transition-colors cursor-pointer"
                  title={isRtl ? "فتح في تبويب مستقل" : "Open in New Tab"}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Preview Viewport Frame */}
            <div className="flex-1 w-full h-full flex items-center justify-center p-2.5 bg-[#060a0a] overflow-hidden relative">
              {isCompiling && (
                <div className="absolute inset-0 z-20 bg-[#080d0d]/80 backdrop-blur-xs flex items-center justify-center gap-2">
                  <RotateCw className="w-5 h-5 text-[#00d4aa] animate-spin" />
                  <span className="text-xs font-bold text-[#e8f5f5]">
                    {isRtl ? "جاري تجميع الكود وتحديث المعاينة..." : "Re-compiling bundle..."}
                  </span>
                </div>
              )}

              <div
                className={`h-full transition-all duration-300 flex items-center justify-center ${
                  deviceMode === "mobile"
                    ? "w-[375px] max-h-[96%] border-4 border-[#1e2e2e] rounded-[36px] overflow-hidden shadow-2xl bg-[#0a0f0f]"
                    : deviceMode === "tablet"
                    ? "w-[768px] max-w-full max-h-[98%] border-2 border-[#1e2e2e] rounded-2xl overflow-hidden shadow-2xl bg-[#0a0f0f]"
                    : "w-full rounded-xl overflow-hidden border border-[#1e2e2e]/60 shadow-inner bg-[#0a0f0f]"
                }`}
              >
                <iframe
                  key={previewKey}
                  ref={iframeRef}
                  srcDoc={htmlPreviewContent}
                  title="Live Sandbox Preview"
                  className="w-full h-full border-0 bg-[#0a0f0f]"
                  sandbox="allow-scripts allow-modals allow-forms"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE CODE EDITOR */}
        {activeTab === "code" && (
          <div className="w-full h-full flex flex-col bg-[#070c0c] text-xs font-mono">
            {/* File Switcher Tabs */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0c1414] border-b border-[#1e2e2e] select-none gap-2">
              <div className="flex items-center gap-1 overflow-x-auto">
                {fileEntries.map(([filePath]) => {
                  const isActive = filePath === selectedFilePath;
                  return (
                    <button
                      key={filePath}
                      type="button"
                      onClick={() => {
                        if (hasUnsavedChanges) {
                          handleApplyAndRun();
                        }
                        setSelectedFilePath(filePath);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                        isActive
                          ? "bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/40 font-bold"
                          : "text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#111a1a]"
                      }`}
                    >
                      <FileCode className="w-3 h-3 text-[#00d4aa]" />
                      <span>{filePath.split("/").pop()}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setIsAddingFile(true)}
                className="px-2 py-1 rounded-lg bg-[#111a1a] border border-[#1e2e2e] text-[#00d4aa] hover:border-[#00d4aa] text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                title={isRtl ? "إضافة ملف جديد" : "Add New File"}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isRtl ? "ملف جديد" : "New File"}</span>
              </button>
            </div>

            {/* Modal / Bar for Adding New File */}
            {isAddingFile && (
              <div className="px-3 py-2 bg-[#0e1717] border-b border-[#00d4aa]/40 flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-[#00d4aa] shrink-0" />
                <input
                  type="text"
                  placeholder={isRtl ? "اسم الملف (مثال: src/Header.tsx)" : "File path (e.g., src/Header.tsx)"}
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNewFile()}
                  className="flex-1 bg-[#070c0c] border border-[#1e2e2e] rounded-lg px-2.5 py-1 text-xs text-[#e8f5f5] font-mono outline-none focus:border-[#00d4aa]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddNewFile}
                  className="px-3 py-1 rounded-lg bg-[#00d4aa] text-[#0a0f0f] font-bold text-xs cursor-pointer hover:bg-[#00ff88]"
                >
                  {isRtl ? "إنشاء" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingFile(false)}
                  className="px-2 py-1 rounded-lg bg-[#111a1a] text-[#88b0b0] text-xs cursor-pointer hover:text-white"
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
              </div>
            )}

            {/* Interactive Code Editor TextArea with Line Numbers */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Line Numbers Bar */}
              <div className="select-none text-[#334d4d] py-3 px-2.5 bg-[#080d0d] border-r border-[#1e2e2e] rtl:border-r-0 rtl:border-l text-right font-mono text-xs overflow-hidden leading-relaxed shrink-0">
                {(editedCode || "").split("\n").map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Editable TextArea */}
              <textarea
                ref={textareaRef}
                value={editedCode}
                onChange={handleCodeChange}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                className="flex-1 p-3 bg-transparent text-[#e8f5f5] font-mono text-xs leading-relaxed outline-none resize-none overflow-auto whitespace-pre selection:bg-[#00d4aa]/30 border-0"
                placeholder="// Start coding..."
              />
            </div>

            {/* Error or Status Bar */}
            {runtimeError && (
              <div className="p-2 bg-red-950/60 border-t border-red-900/60 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="truncate">{runtimeError}</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: FILES EXPLORER */}
        {activeTab === "files" && (
          <div className="w-full h-full p-4 overflow-y-auto bg-[#070c0c] space-y-3">
            <div className="text-xs font-bold text-[#88b0b0] flex items-center justify-between">
              <span>{isRtl ? "هيكلية ملفات المشروع" : "Project File Tree"}</span>
              <button
                type="button"
                onClick={() => {
                  setIsAddingFile(true);
                  setActiveTab("code");
                }}
                className="px-2.5 py-1 rounded-lg bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa] text-[#00d4aa] text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isRtl ? "إضافة ملف" : "Add File"}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {fileEntries.map(([filePath, file]) => {
                const isSelected = filePath === selectedFilePath;
                return (
                  <div
                    key={filePath}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-[#111a1a] border-[#00d4aa] text-[#00d4aa]"
                        : "bg-[#0d1414] border-[#1e2e2e] text-[#e8f5f5] hover:border-[#00d4aa]/40 hover:bg-[#111a1a]/60"
                    }`}
                  >
                    <div
                      onClick={() => {
                        setSelectedFilePath(filePath);
                        setActiveTab("code");
                      }}
                      className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#111a1a] border border-[#1e2e2e] flex items-center justify-center text-[#00d4aa] shrink-0">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold font-mono truncate">{filePath}</div>
                        <div className="text-[10px] text-[#4a7070]">
                          {(file.content.length / 1024).toFixed(1)} KB • {file.language || "code"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {fileEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(filePath);
                          }}
                          className="p-1 rounded text-[#4a7070] hover:text-red-400 transition-colors"
                          title={isRtl ? "حذف الملف" : "Delete File"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-[#4a7070] shrink-0 rtl:rotate-180" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: TERMINAL & REPL */}
        {activeTab === "terminal" && (
          <div className="w-full h-full flex flex-col bg-[#050808] text-xs font-mono overflow-hidden">
            {/* Terminal Header */}
            <div className="px-3.5 py-2 bg-[#090f0f] border-b border-[#1e2e2e] flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#00ff88]">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-bold">{isRtl ? "السجل الحي للمخرجات والموجه" : "Live Execution Stream & REPL"}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTerminalLogs([])}
                  className="px-2 py-0.5 rounded bg-[#111a1a] border border-[#1e2e2e] text-[#88b0b0] hover:text-white text-[10px] cursor-pointer"
                >
                  {isRtl ? "مسح السجل" : "Clear"}
                </button>
                <span className="text-[10px] text-[#4a7070]">
                  {terminalLogs.length} {isRtl ? "سجل" : "logs"}
                </span>
              </div>
            </div>

            {/* Terminal Log Stream */}
            <div className="flex-1 p-3 overflow-y-auto space-y-1.5">
              {terminalLogs.length === 0 ? (
                <div className="text-center py-8 text-[#4a7070]">
                  {isRtl ? "لا توجد رسائل خطأ أو سجلات حالياً. تفاعل مع التطبيق في المعاينة لتظهر السجلات هنا." : "No logs yet. Interact with the app in Live Preview to see console logs."}
                </div>
              ) : (
                terminalLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2 rounded-lg text-xs leading-relaxed border ${
                      log.level === "error"
                        ? "bg-red-950/40 text-red-300 border-red-900/40"
                        : log.level === "warn"
                        ? "bg-amber-950/40 text-amber-300 border-amber-900/40"
                        : log.level === "info"
                        ? "bg-[#00d4aa]/10 text-[#00d4aa] border-[#00d4aa]/20"
                        : "bg-[#0c1414] text-[#e8f5f5] border-[#1e2e2e]"
                    }`}
                  >
                    <span className="text-[#4a7070] mr-2 rtl:mr-0 rtl:ml-2 font-mono">
                      [{new Date(log.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className="whitespace-pre-wrap font-mono">{log.message}</span>
                  </div>
                ))
              )}
            </div>

            {/* Interactive REPL Prompt */}
            <form onSubmit={handleSendReplCommand} className="p-2 bg-[#0a1111] border-t border-[#1e2e2e] flex items-center gap-2">
              <span className="text-[#00d4aa] font-bold pl-2 rtl:pl-0 rtl:pr-2">&gt;</span>
              <input
                type="text"
                placeholder={isRtl ? "أدخل كود JavaScript للتقييم المباشر في المعاينة..." : "Type JS expression to evaluate in sandbox..."}
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                className="flex-1 bg-transparent border-0 text-[#e8f5f5] text-xs font-mono outline-none"
              />
              <button
                type="submit"
                className="p-1.5 rounded-lg bg-[#00d4aa] text-[#0a0f0f] hover:bg-[#00ff88] transition-colors cursor-pointer"
                title={isRtl ? "تنفيذ" : "Execute"}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 4. Footer Summary Status */}
      <div className="px-3.5 py-2 bg-[#0a1111] border-t border-[#1e2e2e] flex items-center justify-between text-[11px] text-[#4a7070] select-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
          <span className="text-[#88b0b0]">
            {isRtl ? "بيئة العمل البرمجية الحية متصلة وجاهزة للتفاعل والتعديل" : "Interactive Coding Sandbox Active & Ready"}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span className="text-[#00d4aa]">React 19 + Tailwind CSS</span>
          <span>•</span>
          <span>In-Browser JIT Bundler</span>
        </div>
      </div>
    </div>
  );
};
