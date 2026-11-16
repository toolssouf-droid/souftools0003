"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  Globe,
  Paperclip,
  Sparkles,
  CornerDownLeft,
  Plus,
  X,
  Image as ImageIcon,
  Mic,
  Brain,
  Activity,
  Zap,
  Link2,
  FileSearch,
  Palette,
  Film,
  Code,
  FileText,
  Table2,
  Square,
  Bot,
  Database,
  Terminal,
  HelpCircle,
  FolderOpen,
  CheckCircle,
  FileCode,
  ArrowRight,
  RotateCcw,
  Mail,
  Loader2,
  AlertCircle,
  Volume2,
  Radio,
  MicOff,
  Settings,
  ShieldCheck,
  ShieldAlert,
  Info,
  Pencil,
} from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { ToolMenu } from "./ToolMenu";
import { ModelSelector } from "./ModelSelector";
import { isRtlLocale } from "@/lib/i18n";
import { SoufBotIcon, SoufBrainIcon } from "@/components/ui/BrandIcons";
import { processMediaBeforeUpload, MAX_VIDEO_DURATION_SECONDS } from "@/lib/media/clientMediaOptimizer";

interface Attachment {
  type: "image" | "file" | "audio";
  name: string;
  mimeType: string;
  data: string; // base64
  size: number;
}

interface InputBarProps {
  onSendMessage: (text: string, attachments?: Attachment[]) => void;
  onStopGeneration?: () => void;
  locale: string;
  editingMessage?: { id: string; content: string; attachments?: Attachment[] } | null;
  onCancelEdit?: () => void;
  onSaveEdit?: (messageId: string, newContent: string, attachments?: Attachment[]) => void;
}

interface ToolDetails {
  name: string;
  icon: React.ReactNode;
  style: string;
}

const getToolDetails = (toolId: string, isRtl: boolean): ToolDetails | null => {
  const c = "w-3 h-3";
  switch (toolId) {
    case "deep_thinking":
      return {
        name: isRtl ? "تفكير استدلالي" : "Reasoning Mode",
        icon: <Brain className={`${c} text-[#00ff88]`} />,
        style: "bg-[#00ff88]/10 border-[#00ff88]/30 text-[#00ff88]",
      };
    case "deep_analysis":
      return {
        name: isRtl ? "تحليل عميق" : "Deep Analysis",
        icon: <Activity className={`${c} text-[#0ea5e9]`} />,
        style: "bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#0ea5e9]",
      };
    case "fast_mode":
      return {
        name: isRtl ? "الوضع السريع" : "Fast Mode",
        icon: <Zap className={`${c} text-[#a855f7]`} />,
        style: "bg-[#a855f7]/10 border-[#a855f7]/30 text-[#a855f7]",
      };
    case "web_search":
      return {
        name: isRtl ? "بحث الويب" : "Web Search",
        icon: <Globe className={`${c} text-[#00d4aa]`} />,
        style: "bg-[#00d4aa]/10 border-[#00d4aa]/30 text-[#00d4aa]",
      };
    case "agent_mode":
      return {
        name: isRtl ? "وضع الوكيل" : "Agent Mode",
        icon: <Bot className={`${c} text-[#00d4aa]`} />,
        style: "bg-[#00d4aa]/10 border-[#00d4aa]/30 text-[#00d4aa]",
      };
    case "create_image":
      return {
        name: isRtl ? "توليد صورة" : "Create Image",
        icon: <Palette className={`${c} text-[#ff00aa]`} />,
        style: "bg-[#ff00aa]/10 border-[#ff00aa]/30 text-[#ff00aa]",
      };
    case "create_code":
      return {
        name: isRtl ? "وضع البرمجة" : "Coding Mode",
        icon: <Code className={`${c} text-[#a855f7]`} />,
        style: "bg-[#a855f7]/10 border-[#a855f7]/30 text-[#a855f7]",
      };
    case "gmail_integration":
      return {
        name: isRtl ? "جيميل" : "Gmail",
        icon: <Mail className={`${c} text-[#ea4335]`} />,
        style: "bg-[#ea4335]/10 border-[#ea4335]/30 text-[#ea4335]",
      };
    case "file_analysis":
      return {
        name: isRtl ? "تحليل ملف" : "File Analysis",
        icon: <FileSearch className={`${c} text-[#eab308]`} />,
        style: "bg-[#eab308]/10 border-[#eab308]/30 text-[#eab308]",
      };
    default:
      return null;
  }
};

export const InputBar: React.FC<InputBarProps> = ({
  onSendMessage,
  onStopGeneration,
  locale,
  editingMessage = null,
  onCancelEdit,
  onSaveEdit,
}) => {
  const [input, setInput] = useState("");
  const [localEditingMessage, setLocalEditingMessage] = useState<{ id: string; content: string } | null>(
    editingMessage ? { id: editingMessage.id, content: editingMessage.content } : null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showToolMenu, setShowToolMenu] = useState(false);
  const [showLinkPrompt, setShowLinkPrompt] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [isAnalyzingLink, setIsAnalyzingLink] = useState(false);

  // Audio recording & Speech recognition states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const liveTranscriptRef = useRef<string>("");

  // Drag and Drop State
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Input refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isGenerating,
    webSearchEnabled,
    setWebSearchEnabled,
    activeTools,
    toggleTool,
    clearTools,
    messages,
    contextualSuggestions,
  } = useChatStore();

  const isRtl = isRtlLocale(locale);

  // Image Generation Quick Options
  const [imageAspectRatio, setImageAspectRatio] = useState<string>("16:9");
  const [imageStyle, setImageStyle] = useState<string>("سينمائي");

  // Mode Selection State
  // Modes: "auto" | "fast" | "thinking" | "deep" | "agent" | "code" | "search" | "create"
  const getSelectedMode = (): string => {
    if (activeTools.includes("agent_mode")) return "agent";
    if (activeTools.includes("deep_thinking")) return "thinking";
    if (activeTools.includes("deep_analysis")) return "deep";
    if (activeTools.includes("fast_mode")) return "fast";
    if (activeTools.includes("create_code")) return "code";
    if (activeTools.includes("web_search")) return "search";
    if (activeTools.includes("create_image")) return "create";
    return "auto";
  };

  const handleSelectMode = (mode: string) => {
    const current = getSelectedMode();
    if (current === mode || mode === "auto") {
      clearTools();
      return;
    }
    clearTools();
    if (mode === "fast") toggleTool("fast_mode");
    if (mode === "thinking") toggleTool("deep_thinking");
    if (mode === "deep") toggleTool("deep_analysis");
    if (mode === "agent") toggleTool("agent_mode");
    if (mode === "code") toggleTool("create_code");
    if (mode === "search") toggleTool("web_search");
    if (mode === "create") toggleTool("create_image");
  };

  const handleFilesChangeRef = useRef<((filesList: FileList | null) => Promise<void>) | null>(null);

  // Drag and Drop Listeners
  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDraggingOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        setIsDraggingOver(false);
        dragCounterRef.current = 0;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      dragCounterRef.current = 0;
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFilesChangeRef.current?.(e.dataTransfer.files);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  // External trigger listener (e.g. from SoufFile Preview edit prompt)
  useEffect(() => {
    const handleSetPrompt = (e: any) => {
      if (e.detail?.prompt) {
        setInput(e.detail.prompt);
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
        if (e.detail.autoSend) {
          setTimeout(() => {
            onSendMessage(e.detail.prompt, attachments);
            setInput("");
          }, 150);
        }
      }
    };
    window.addEventListener("souf-chat-set-prompt", handleSetPrompt);
    return () => window.removeEventListener("souf-chat-set-prompt", handleSetPrompt);
  }, [onSendMessage, attachments]);

  // Sync with editingMessage prop
  useEffect(() => {
    if (editingMessage) {
      setLocalEditingMessage({
        id: editingMessage.id,
        content: editingMessage.content,
      });
      setInput(editingMessage.content);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
          textareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 60);
    }
  }, [editingMessage]);

  // External edit message listener (e.g. from MessageItem pencil click)
  useEffect(() => {
    const handleEditMessageEvent = (e: any) => {
      if (e.detail?.messageId) {
        setLocalEditingMessage({
          id: e.detail.messageId,
          content: e.detail.content || "",
        });
        setInput(e.detail.content || "");
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
            textareaRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 80);
      }
    };
    window.addEventListener("souf-chat-edit-message", handleEditMessageEvent);
    return () => window.removeEventListener("souf-chat-edit-message", handleEditMessageEvent);
  }, []);

  const handleCancelEditing = () => {
    setLocalEditingMessage(null);
    setInput("");
    onCancelEdit?.();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  // Keyboard Shortcuts (Cmd+K, Esc, Up Arrow, Paste)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Center (Cmd+K or Ctrl+K)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowToolMenu((prev) => !prev);
      }

      // Close menu on Escape
      if (e.key === "Escape") {
        setShowToolMenu(false);
      }

      // Up arrow key to retrieve last message when input is empty
      if (e.key === "ArrowUp" && !input.trim() && textareaRef.current === document.activeElement) {
        const userMsgs = messages.filter((m) => m.role === "user");
        if (userMsgs.length > 0) {
          e.preventDefault();
          const lastMsg = userMsgs[userMsgs.length - 1];
          setInput(lastMsg.content);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [input, messages]);

  // Handle Clipboard Paste of Image/Files
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const isImg = file.type.startsWith("image/");
          const reader = new FileReader();
          reader.onload = () => {
            const base64Data = reader.result as string;
            setAttachments((prev) => [
              ...prev,
              {
                type: isImg ? "image" : "file",
                name: file.name || (isImg ? `pasted_image_${Date.now()}.png` : `pasted_file_${Date.now()}.txt`),
                mimeType: file.type || (isImg ? "image/png" : "text/plain"),
                data: base64Data,
                size: file.size,
              },
            ]);
            if (!isImg && !activeTools.includes("file_analysis")) {
              toggleTool("file_analysis");
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Quick Prompt listener
  useEffect(() => {
    const handleQuickPrompt = (e: any) => {
      if (e.detail) {
        setInput(e.detail);
        textareaRef.current?.focus();
        adjustHeight();
      }
    };
    window.addEventListener("quickPrompt", handleQuickPrompt);
    return () => window.removeEventListener("quickPrompt", handleQuickPrompt);
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustHeight();
  };

  // Handle Multiple File Upload with Local-First Compression & 10s Video Validation
  const handleFilesChange = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;

    for (const rawFile of Array.from(filesList)) {
      // Validate file size (max 25MB)
      if (rawFile.size > 25 * 1024 * 1024) {
        alert(
          isRtl
            ? `حجم الملف ${rawFile.name} يتجاوز الحد المسموح (25 ميجابايت)`
            : `File ${rawFile.name} exceeds 25MB limit`
        );
        continue;
      }

      // 1. Process and optimize on the client (Compress images, enforce 10s video limit)
      const processed = await processMediaBeforeUpload(rawFile);
      if (!processed.success) {
        alert(processed.error || (isRtl ? "تعذر معالجة هذا الملف" : "Failed to process media file"));
        continue;
      }

      const optimizedResult = processed.result!;
      const fileToUpload = optimizedResult.file;
      const isImg = optimizedResult.category === "image";
      const isAudio = optimizedResult.category === "audio";

      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result as string;
        setAttachments((prev) => [
          ...prev,
          {
            type: isImg ? "image" : isAudio ? "audio" : "file",
            name: rawFile.name,
            mimeType: optimizedResult.mimeType || (isImg ? "image/webp" : isAudio ? "audio/webm" : "application/octet-stream"),
            data: base64Data,
            size: optimizedResult.compressedSize || rawFile.size,
          },
        ]);

        if (!isImg && !isAudio && !activeTools.includes("file_analysis")) {
          toggleTool("file_analysis");
        }
      };
      reader.readAsDataURL(fileToUpload);
    }
  };

  handleFilesChangeRef.current = handleFilesChange;

  // Audio Recording Cleanup
  const stopAudioAnalysis = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Audio Recording Handlers
  const handleAudioSelect = async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    // Check permissions API if available
    if (typeof navigator !== "undefined" && navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (perm.state === "denied") {
          setShowMicPermissionModal(true);
          setMicError(
            isRtl
              ? "تم حظر إذن الميكروفون سابقاً. يرجى تفعيل الإذن من إعدادات المتصفح."
              : "Microphone permission is blocked in browser. Please enable it in site settings."
          );
          return;
        }
      } catch {}
    }

    await requestMicrophonePermission();
  };

  const requestMicrophonePermission = async () => {
    setIsRequestingPermission(true);
    setMicError(null);
    liveTranscriptRef.current = "";
    audioChunksRef.current = [];

    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsRequestingPermission(false);
      setShowMicPermissionModal(true);
      setMicError(
        isRtl
          ? "المتصفح لا يدعم الوصول للميكروفون أو يتطلب بروتوكول HTTPS آمن."
          : "Microphone API not supported in current browser context (HTTPS required)."
      );
      return;
    }

    let stream: MediaStream | null = null;
    try {
      // 1. Explicitly prompt user for High-Fidelity Studio Audio stream
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
        } as any,
      });
    } catch (err: any) {
      try {
        // Fallback standard audio request
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (fallbackErr: any) {
        setIsRequestingPermission(false);
        setShowMicPermissionModal(true);
        const isNotAllowed = fallbackErr?.name === "NotAllowedError" || fallbackErr?.name === "PermissionDeniedError";
        const msg = isRtl
          ? isNotAllowed
            ? "تم رفض إذن الميكروفون من قِبل المتصفح. يُرجى السماح بالوصول من أيقونة القفل أو إعدادات المتصفح."
            : "تعذر الوصول للميكروفون. يرجى التأكد من توصيل الميكروفون وإعادة المحاولة."
          : isNotAllowed
            ? "Microphone access was denied. Please allow microphone access in your browser settings."
            : "Could not access microphone. Please check your audio device and try again.";
        setMicError(msg);
        return;
      }
    }

    setShowMicPermissionModal(false);
    setIsRequestingPermission(false);

    if (stream) {
      setupAndStartRecordingWithStream(stream);
    }
  };

  const setupAndStartRecordingWithStream = (stream: MediaStream) => {
    try {
      // 2. Real-time Audio Level Meter via Web Audio API
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 128;
          analyser.smoothingTimeConstant = 0.4;
          analyserRef.current = analyser;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const updateLevel = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const avg = sum / bufferLength;
            const normalized = Math.min(100, Math.round((avg / 128) * 100));
            setAudioLevel(normalized);
            animFrameRef.current = requestAnimationFrame(updateLevel);
          };
          updateLevel();
        }
      } catch (audioCtxErr) {
        console.warn("AudioContext setup notice:", audioCtxErr);
      }

      // 3. Web Speech Recognition for Live Instant Transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.lang = isRtl ? "ar-SA" : "en-US";
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;

          recognition.onresult = (event: any) => {
            let finalStr = "";
            let interimStr = "";
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalStr += event.results[i][0].transcript + " ";
              } else {
                interimStr += event.results[i][0].transcript;
              }
            }
            const combined = (finalStr + interimStr).trim();
            if (combined) {
              liveTranscriptRef.current = combined;
              setInput(combined);
              setTimeout(adjustHeight, 50);
            }
          };

          recognition.onerror = (event: any) => {
            console.warn("Live speech recognition event:", event.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (recErr) {
          console.warn("Speech recognition initialization notice:", recErr);
        }
      }

      // 4. Select highest quality supported audio MIME codec (Opus / AAC / WebM)
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/aac",
        "audio/ogg;codecs=opus",
        "audio/wav",
      ];
      let chosenMime = "";
      for (const type of supportedTypes) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
          chosenMime = type;
          break;
        }
      }

      const recorderOptions: MediaRecorderOptions = {};
      if (chosenMime) {
        recorderOptions.mimeType = chosenMime;
        recorderOptions.audioBitsPerSecond = 128000;
      }

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopAudioAnalysis();
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {}
          recognitionRef.current = null;
        }

        const mime = chosenMime || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        
        // Convert to Base64 and attach to message
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Data = reader.result as string;
          const newAttachment: Attachment = {
            type: "audio",
            name: `تسجيل_صوتي_${Date.now()}.${mime.includes("mp4") ? "mp4" : "webm"}`,
            mimeType: mime,
            data: base64Data,
            size: audioBlob.size,
          };

          setAttachments((prev) => [...prev, newAttachment]);

          // Native device speech recognizer: transcript is populated directly into input
          // No AI model API call used for transcription, relying entirely on the native device engine
          if (liveTranscriptRef.current.trim()) {
            setInput(liveTranscriptRef.current.trim());
            setTimeout(adjustHeight, 50);
          }
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250); // Slice data every 250ms for maximum stream stability
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (initErr: any) {
      console.error("Recording setup error:", initErr);
      setMicError(isRtl ? "فشل تشغيل مسجل الصوت عالي الدقة" : "Failed to start studio audio recorder");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    stopAudioAnalysis();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        }
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) {
      if (onStopGeneration) onStopGeneration();
      return;
    }

    if (!input.trim() && attachments.length === 0) return;

    let finalPrompt = input.trim() || (isRtl ? "معالجة المرفق" : "Process attached files");
    const currentMode = getSelectedMode();
    if (currentMode === "create" || activeTools.includes("create_image")) {
      finalPrompt = `${finalPrompt} [أبعاد الصورة: ${imageAspectRatio}, النمط الفني: ${imageStyle}]`;
    }

    const currentEdit = localEditingMessage || editingMessage;
    if (currentEdit && onSaveEdit) {
      onSaveEdit(currentEdit.id, finalPrompt, attachments);
      setLocalEditingMessage(null);
    } else {
      onSendMessage(finalPrompt, attachments);
    }

    setInput("");
    setAttachments([]);
    setLocalEditingMessage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  const handleToggleToolOverride = (toolId: string) => {
    if (toolId === "link_analysis" || toolId === "analyze_link") {
      setShowLinkPrompt(true);
    } else {
      toggleTool(toolId);
    }
  };

  const handleLinkSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!linkInput.trim() || isAnalyzingLink) return;

    setIsAnalyzingLink(true);
    try {
      const res = await fetch("/api/tools/read-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkInput.trim() }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && data.success) {
          setAttachments((prev) => [
            ...prev,
            {
              type: "file",
              name: `${data.title || (isRtl ? "محتوى ويب" : "Web content")}.txt`,
              mimeType: "text/plain",
              data: `data:text/plain;base64,${btoa(unescape(encodeURIComponent(data.content)))}`,
              size: data.content.length,
            },
          ]);

          if (!activeTools.includes("link_analysis")) {
            toggleTool("link_analysis");
          }
          setShowLinkPrompt(false);
          setLinkInput("");
        } else {
          alert(data.error || "فشل تحليل الرابط");
        }
      } else {
        alert("فشل الاتصال بالخادم لتحليل الرابط");
      }
    } catch (err) {
      console.error("Link analysis error:", err);
      alert("حدث خطأ غير متوقع أثناء الاتصال");
    } finally {
      setIsAnalyzingLink(false);
    }
  };

  const hasContent = input.trim().length > 0 || attachments.length > 0;

  const currentMode = getSelectedMode();

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pb-4 relative z-30">
      {/* Microphone Permission Request & Authorization Modal */}
      <AnimatePresence>
        {showMicPermissionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-[#0f1717] border border-[#1e2e2e] rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl shadow-black/80 flex flex-col gap-4 relative"
              dir={isRtl ? "rtl" : "ltr"}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={() => setShowMicPermissionModal(false)}
                className="absolute top-4 start-auto end-4 p-2 rounded-xl bg-[#162323] hover:bg-[#1f3030] text-[#6b9999] hover:text-[#e8f5f5] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header with Mic Shield Icon */}
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa] shrink-0 shadow-lg shadow-[#00d4aa]/10">
                  <Mic className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#e8f5f5]">
                    {isRtl ? "طلب إذن الوصول إلى الميكروفون" : "Microphone Access Required"}
                  </h3>
                  <p className="text-xs text-[#6b9999] mt-0.5 font-mono">
                    {isRtl ? "تسجيل فائق الدقة (48kHz) وتفريغ فوري" : "Studio-grade audio recording (48kHz)"}
                  </p>
                </div>
              </div>

              {/* Explanation Box */}
              <div className="bg-[#141f1f] p-3.5 rounded-2xl border border-[#1e2e2e] space-y-2 text-xs text-[#a0c2c2] leading-relaxed">
                <p>
                  {isRtl
                    ? "لتسجيل رسائلك وملاحظاتك الصوتية بدقة متناهية وتحويلها إلى نص فوري بالذكاء الاصطناعي، يرجى منح الإذن للمتصفح باستخدام الميكروفون."
                    : "To record voice notes in studio fidelity and transcribe them with AI, your browser requires permission to access the microphone."}
                </p>
              </div>

              {/* Browser Instructions Helper */}
              <div className="bg-[#0b1010] p-3.5 rounded-xl border border-[#1e2e2e]/60 text-xs text-[#7da0a0] space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-[#00d4aa]">
                  <Info className="w-3.5 h-3.5" />
                  <span>{isRtl ? "كيفية التفعيل والموافقة:" : "How to allow access:"}</span>
                </div>
                <ul className="list-disc list-inside space-y-1.5 ps-1 text-[11px] leading-normal text-[#88b0b0]">
                  <li>
                    {isRtl
                      ? "اضغط على زر (منح الإذن الآن) بالأسفل ثم انقر على (السماح / Allow) في نافذة المتصفح."
                      : "Click 'Grant Permission Now' below and select 'Allow' on the browser prompt."}
                  </li>
                  <li>
                    {isRtl
                      ? "إذا كانت الصلاحية محظورة: انقر على أيقونة القفل أو الإعدادات 🔒 بجانب شريط العنوان ➔ الأذونات ➔ تفعيل الميكروفون."
                      : "If blocked: Tap the lock/tune icon 🔒 in the URL address bar ➔ Permissions ➔ Allow Microphone."}
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={requestMicrophonePermission}
                  disabled={isRequestingPermission}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#0a0f0f] font-bold text-xs hover:opacity-95 transition-all shadow-lg shadow-[#00d4aa]/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isRequestingPermission ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{isRtl ? "جاري طلب الإذن..." : "Requesting..."}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isRtl ? "منح إذن الميكروفون الآن" : "Grant Permission Now"}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMicPermissionModal(false)}
                  className="py-3 px-4 rounded-xl bg-[#162323] hover:bg-[#1e2e2e] text-[#88b0b0] hover:text-[#e8f5f5] text-xs font-semibold transition-all border border-[#1e2e2e] cursor-pointer"
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Hidden inputs supporting multiple file select */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFilesChange(e.target.files)}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFilesChange(e.target.files)}
      />
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => handleFilesChange(e.target.files)}
      />

      {/* Drag & Drop Global Overlay */}
      <AnimatePresence>
        {isDraggingOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#030707]/90 backdrop-blur-md flex flex-col items-center justify-center p-8 border-4 border-dashed border-[#00d4aa]/40 m-4 rounded-3xl"
          >
            <div className="w-20 h-20 rounded-2xl bg-[#00d4aa]/10 flex items-center justify-center border border-[#00d4aa]/30 text-[#00d4aa] mb-4 animate-pulse">
              <FolderOpen className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-extrabold text-[#e8f5f5] tracking-tight">
              {isRtl ? "أفلت الملفات هنا لتحليلها مع SoufAI" : "Drop files here to analyze with SoufAI"}
            </h2>
            <p className="text-xs text-[#4a7070] mt-2 max-w-md text-center leading-relaxed">
              {isRtl 
                ? "يدعم التحليل المستندات، الأكواد البرمجية، الصور، الجداول، والتسجيلات الصوتية بحد أقصى 25 ميجابايت." 
                : "Supports all document types, coding formats, tables, and media files up to 25MB."}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time Assistant Work Activity Bar */}
      {isGenerating && (
        <div className="flex items-center gap-2 mb-2 px-3.5 py-2 rounded-xl bg-[#081010]/80 border border-[#1e2e2e]/60 text-[11px] text-[#8db3b3] animate-pulse shadow-sm">
          {activeTools.includes("agent_mode") ? (
            <SoufBotIcon size={15} glow />
          ) : (
            <SoufBrainIcon size={15} glow />
          )}
          <span className="font-medium">
            {isRtl 
              ? `${activeTools.includes("agent_mode") ? "الوكيل الذكي يعمل:" : "SoufAI يعمل:"} ${
                  activeTools.includes("web_search") 
                    ? "يبحث في الويب ويقرأ المصادر..." 
                    : attachments.length > 0 
                    ? "يحلل الملفات والبيانات المرفقة..." 
                    : "يفكر ويصيغ الرد النهائي..."
                }`
              : `${activeTools.includes("agent_mode") ? "Autonomous Agent executing:" : "SoufAI active:"} ${
                  activeTools.includes("web_search") 
                    ? "querying web & synthesizing facts..." 
                    : attachments.length > 0 
                    ? "parsing attached dataset..." 
                    : "reasoning and building response..."
                }`}
          </span>
        </div>
      )}

      {/* Contextual Dynamic Suggestions (Real-time AI driven) */}
      {contextualSuggestions && contextualSuggestions.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none mb-1.5" dir={isRtl ? "rtl" : "ltr"}>
          {contextualSuggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (isGenerating) {
                  onStopGeneration?.();
                  setTimeout(() => onSendMessage(s.text), 300);
                } else {
                  onSendMessage(s.text);
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-[#0d1515] hover:bg-[#121f1f] border border-[#1a2b2b] hover:border-[#00d4aa]/40 text-[#8db3b3] hover:text-[#00d4aa] text-[11px] transition-all duration-150 font-medium whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Floating Tool Menu */}
      <AnimatePresence>
        {showToolMenu && (
          <ToolMenu
            onClose={() => setShowToolMenu(false)}
            activeTools={activeTools}
            onToggleTool={(tool) => handleToggleToolOverride(tool)}
            onImageSelect={() => imageInputRef.current?.click()}
            onCameraSelect={() => cameraInputRef.current?.click()}
            onFileSelect={() => fileInputRef.current?.click()}
            onAudioSelect={handleAudioSelect}
            isAudioRecording={isRecording}
            locale={locale}
          />
        )}
      </AnimatePresence>

      {/* Bottom Main Command Center Container */}
      <form
        onSubmit={handleSubmit}
        className="glass-panel bg-[#12161f]/90 backdrop-blur-2xl p-3 rounded-2xl border border-[#1f2633] focus-within:border-[#00d4aa] focus-within:shadow-[0_0_25px_rgba(0,212,170,0.2)] transition-all relative flex flex-col shadow-2xl"
        onPaste={handlePaste}
      >
        {/* Active Editing Message Indicator Banner */}
        {(localEditingMessage || editingMessage) && (
          <div
            className="flex items-center justify-between p-2.5 mb-2 rounded-xl bg-[#00d4aa]/12 border border-[#00d4aa]/35 text-xs text-[#00d4aa] shadow-sm animate-in fade-in slide-in-from-bottom-1"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 rounded-lg bg-[#00d4aa]/20 text-[#00d4aa] shrink-0 border border-[#00d4aa]/30">
                <Pencil className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-[#00ff88]">
                  {isRtl ? "جاري تعديل الرسالة السابقة" : "Editing previous message"}
                </span>
                <span className="text-[10px] text-[#64748b] mx-1.5 hidden sm:inline">•</span>
                <span className="text-[11px] text-[#94a3b8] truncate hidden sm:inline">
                  {isRtl
                    ? "سيتم استبدال الرد وإعادة توليد الإجابة بدون تكرار"
                    : "Response will be regenerated in place"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelEditing}
              className="px-2.5 py-1 rounded-lg bg-[#12161f] hover:bg-[#161b26] border border-[#1f2633] hover:border-[#00d4aa]/40 text-[#94a3b8] hover:text-[#f1f5f9] text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              title={isRtl ? "إلغاء وضع التعديل" : "Cancel edit"}
            >
              <X className="w-3 h-3 text-red-400" />
              <span>{isRtl ? "إلغاء" : "Cancel"}</span>
            </button>
          </div>
        )}

        {/* Image Options Quick Bar */}
        {(currentMode === "create" || activeTools.includes("create_image")) && (
          <div className="flex items-center gap-2 overflow-x-auto py-1.5 px-2.5 mb-2 rounded-xl bg-[#12161f] border border-[#00d4aa]/30 text-xs no-scrollbar" dir={isRtl ? "rtl" : "ltr"}>
            <span className="text-[10px] font-extrabold text-[#00d4aa] shrink-0 flex items-center gap-1">
              <Palette className="w-3.5 h-3.5 text-[#00d4aa]" />
              {isRtl ? "خيارات الصورة:" : "Image Options:"}
            </span>
            <div className="flex items-center gap-1 bg-[#161b26] p-1 rounded-lg border border-[#1f2633] shrink-0">
              <span className="text-[9px] text-[#64748b] px-1 font-mono">{isRtl ? "الأبعاد:" : "Ratio:"}</span>
              {["1:1", "16:9", "9:16", "4:3", "3:2"].map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setImageAspectRatio(ratio)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer ${
                    imageAspectRatio === ratio
                      ? "bg-[#00d4aa] text-[#0a0f0f] shadow-sm"
                      : "text-[#64748b] hover:text-[#f1f5f9]"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 bg-[#161b26] p-1 rounded-lg border border-[#1f2633] shrink-0">
              <span className="text-[9px] text-[#64748b] px-1 font-mono">{isRtl ? "النمط:" : "Style:"}</span>
              {[
                { id: "سينمائي", label: "سينمائي" },
                { id: "واقعي", label: "واقعي 4K" },
                { id: "أنمي", label: "أنمي" },
                { id: "رسم 3D", label: "رسم 3D" },
                { id: "سايبربانك", label: "سايبربانك" },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setImageStyle(st.id)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer ${
                    imageStyle === st.id
                      ? "bg-[#00d4aa] text-[#0a0f0f] shadow-sm"
                      : "text-[#64748b] hover:text-[#f1f5f9]"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Link input dialog */}
        {showLinkPrompt && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#111a1a] border border-[#1e2e2e] mb-2" dir={isRtl ? "rtl" : "ltr"}>
            <span className="text-[11px] font-bold text-[#4a7070] shrink-0">
              {isRtl ? "تحليل رابط الويب:" : "Fetch Link:"}
            </span>
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 bg-transparent text-xs text-[#e8f5f5] outline-none placeholder-[#4a7070]"
              disabled={isAnalyzingLink}
              onKeyDown={(e) => e.key === "Enter" && handleLinkSubmit(e)}
            />
            <button
              type="button"
              onClick={() => handleLinkSubmit()}
              disabled={isAnalyzingLink || !linkInput.trim()}
              className="p-1.5 rounded-lg bg-[#00d4aa] text-[#0a0f0f] hover:opacity-85 disabled:opacity-40"
            >
              {isAnalyzingLink ? (
                <div className="w-3 h-3 border-2 border-[#0a0f0f] border-t-transparent rounded-full animate-spin" />
              ) : (
                <CornerDownLeft className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLinkPrompt(false);
                setLinkInput("");
              }}
              className="p-1.5 rounded-lg hover:bg-[#1e2e2e] text-[#4a7070]"
              disabled={isAnalyzingLink}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Microphone Error Alert */}
        {micError && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs mb-2 animate-in fade-in slide-in-from-top-1" dir={isRtl ? "rtl" : "ltr"}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{micError}</span>
            </div>
            <button
              type="button"
              onClick={() => setMicError(null)}
              className="p-1 hover:bg-red-500/20 rounded-lg text-red-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Audio Transcribing Loading State */}
        {isTranscribing && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-[#00d4aa]/10 border border-[#00d4aa]/30 text-[#00d4aa] text-xs mb-2 animate-pulse" dir={isRtl ? "rtl" : "ltr"}>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="font-semibold">
              {isRtl ? "جاري تحويل الصوت إلى نص فائق الدقة بالذكاء الاصطناعي..." : "Transcribing high quality audio with AI..."}
            </span>
          </div>
        )}

        {/* Audio Recording overlay with Studio Quality Live Visualizer */}
        {isRecording && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-red-500/15 via-[#111a1a] to-red-500/15 border border-red-500/40 mb-2 shadow-lg shadow-red-500/10" dir={isRtl ? "rtl" : "ltr"}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex items-center justify-center w-6 h-6">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping absolute" />
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 relative" />
              </div>

              {/* Dynamic Sound Waveform Bars */}
              <div className="flex items-center gap-1 h-5 px-2 bg-black/40 rounded-lg border border-red-500/20">
                {[40, 70, 100, 60, 90, 50, 80, 65].map((h, i) => {
                  const dynamicHeight = Math.max(
                    4,
                    Math.round((h * (audioLevel > 5 ? audioLevel : 15)) / 100)
                  );
                  return (
                    <span
                      key={i}
                      className="w-1 bg-gradient-to-t from-red-500 to-[#00ff88] rounded-full transition-all duration-75"
                      style={{ height: `${Math.min(18, dynamicHeight)}px` }}
                    />
                  );
                })}
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold text-red-400 flex items-center gap-1.5 truncate">
                  <span>{isRtl ? "تسجيل فائق الدقة نشط" : "Studio Voice Capture"}</span>
                  <span className="text-[10px] text-[#00d4aa] bg-[#00d4aa]/10 px-1.5 py-0.2 rounded border border-[#00d4aa]/20 font-mono">
                    48kHz
                  </span>
                </p>
              </div>

              <span className="text-xs text-[#e8f5f5] font-mono bg-[#111a1a] px-2 py-0.5 rounded-md border border-[#1e2e2e]">
                {formatTime(recordingSeconds)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ms-2">
              <button
                type="button"
                onClick={stopRecording}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all text-xs font-bold shadow-md shadow-red-500/30 cursor-pointer flex items-center gap-1"
              >
                <span>{isRtl ? "تم وإدراج" : "Done"}</span>
              </button>
              <button
                type="button"
                onClick={cancelRecording}
                className="px-2.5 py-1.5 rounded-lg bg-[#111a1a] border border-[#1e2e2e] text-[#88b0b0] hover:text-red-400 transition-all text-xs cursor-pointer"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </button>
            </div>
          </div>
        )}

        {/* Attachments Horizontal Tray */}
        {(attachments.length > 0 || activeTools.length > 0) && (
          <div className="flex items-center gap-2 pb-2.5 border-b border-[#1e2e2e]/30 mb-2 overflow-x-auto scrollbar-thin" dir={isRtl ? "rtl" : "ltr"}>
            {/* Attachment Items List */}
            {attachments.map((att, idx) => (
              <div
                key={`att-${idx}`}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-[11px] text-[#e8f5f5] shrink-0 max-w-[190px]"
              >
                {att.type === "image" && <ImageIcon className="w-4 h-4 text-[#0ea5e9]" />}
                {att.type === "file" && <FileText className="w-4 h-4 text-[#eab308]" />}
                {att.type === "audio" && <Mic className="w-4 h-4 text-[#ef4444]" />}
                
                <div className="min-w-0 text-right">
                  <p className="font-semibold truncate max-w-[100px] leading-tight text-[#e8f5f5]">
                    {att.name}
                  </p>
                  <p className="text-[9px] text-[#4a7070] font-mono mt-0.5">
                    {att.size ? `${(att.size / (1024 * 1024)).toFixed(2)} MB` : "Ready"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="hover:text-red-400 p-1 text-[#4a7070] hover:bg-[#1a2222] rounded-lg transition-colors ms-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* Active tool chips */}
            {activeTools.map((tool) => {
              const details = getToolDetails(tool, isRtl);
              if (!details) return null;
              return (
                <div
                  key={`tool-${tool}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold shrink-0 ${details.style}`}
                >
                  {details.icon}
                  <span>{details.name}</span>
                  <button
                    type="button"
                    onClick={() => toggleTool(tool)}
                    className="hover:opacity-80 p-0.5 transition-opacity ms-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isRtl 
              ? "اطرح سؤالك، اطلب توليد صورة، أو وجّه الوكيل لتنفيذ مهمة..." 
              : "Ask anything, generate beautiful graphics, or delegate tasks..."
          }
          rows={1}
          className="w-full bg-transparent text-[#e8f5f5] text-xs sm:text-sm placeholder-[#4a7070] resize-none outline-none px-2 py-1.5 max-h-44 scrollbar-thin leading-relaxed"
          dir="auto"
        />

        {/* Hidden File Input Elements for Upload */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilesChange(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleFilesChange(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilesChange(e.target.files);
            e.target.value = "";
          }}
        />

        {/* Row 3: Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-[#1f2633]/50 mt-1.5 gap-2 flex-wrap sm:flex-nowrap">
          {/* Left Block: Quick Action Upload & Tool Controls */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => setShowToolMenu((prev) => !prev)}
              className={`p-2 rounded-xl border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
                showToolMenu
                  ? "bg-[#00d4aa] text-[#0a0f0f] border-[#00d4aa] shadow-md shadow-[#00d4aa]/30"
                  : "bg-[#12161f] text-[#00d4aa] hover:text-[#00ff88] border-[#1f2633] hover:border-[#00d4aa]"
              }`}
              title={isRtl ? "قائمة الأدوات المتقدمة (Cmd+K)" : "Advanced tools (Cmd+K)"}
            >
              <Plus className={`w-4 h-4 transition-transform ${showToolMenu ? "rotate-45" : ""}`} />
            </button>

            {/* Single Unified File Upload Button for All File Types */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl bg-[#12161f] hover:bg-[#161b26] border border-[#1f2633] hover:border-[#00d4aa]/60 text-[#64748b] hover:text-[#00d4aa] transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
              title={isRtl ? "إرفاق جميع أنواع الملفات (صور، مستندات، أكواد، صوت، جداول)" : "Upload all file types (images, documents, code, audio, datasets)"}
            >
              <Paperclip className="w-4 h-4 text-[#00d4aa]" />
              <span className="hidden sm:inline text-[11px]">{isRtl ? "إرفاق ملفات" : "Attach Files"}</span>
            </button>

            {/* Voice Audio Recording Button with Studio Quality Capture */}
            <button
              type="button"
              onClick={handleAudioSelect}
              className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0 ${
                isRecording
                  ? "bg-red-500/25 text-red-400 border-red-500/50 shadow-md shadow-red-500/20"
                  : "bg-[#12161f] hover:bg-[#161b26] border-[#1f2633] hover:border-red-500/40 text-[#64748b] hover:text-red-400"
              }`}
              title={
                isRtl
                  ? isRecording
                    ? "إيقاف التسجيل الصوتي"
                    : "تسجيل صوتي فائق الدقة (48kHz Studio)"
                  : isRecording
                  ? "Stop recording"
                  : "Studio voice recording (48kHz)"
              }
            >
              <Mic className={`w-4 h-4 text-[#ef4444] ${isRecording ? "animate-pulse" : ""}`} />
              {isRecording && (
                <span className="text-[10px] font-mono text-red-400 font-bold hidden sm:inline">
                  {formatTime(recordingSeconds)}
                </span>
              )}
            </button>

            {/* Model Selector in bottom bar */}
            <ModelSelector locale={locale} dropUp={true} />
          </div>

          {/* Right Block: Keyboard Info & Submit */}
          <div className="flex items-center gap-2 shrink-0 ms-auto">
            <span className="text-[10px] text-[#64748b] hidden md:inline-block font-mono">
              {isRtl ? "Enter للإرسال • Shift+Enter لسطر جديد" : "Enter to Send • Shift+Enter for newline"}
            </span>

            {isGenerating ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={onStopGeneration}
                className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/40 font-bold text-xs flex items-center gap-1.5 hover:bg-red-500/30 transition-all cursor-pointer shadow-lg shadow-red-500/15"
                title={isRtl ? "إيقاف التوليد" : "Stop generation"}
              >
                <Square className="w-3 h-3 fill-current" />
                <span>{isRtl ? "إيقاف" : "Stop"}</span>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: hasContent ? 1.05 : 1 }}
                whileTap={{ scale: hasContent ? 0.95 : 1 }}
                type="submit"
                disabled={!hasContent}
                className={`p-2.5 rounded-xl font-bold flex items-center justify-center transition-all shrink-0 ${
                  hasContent
                    ? "bg-gradient-to-r from-[#00d4aa] to-[#38bdf8] text-[#0a0f0f] shadow-[0_0_20px_rgba(0,212,170,0.4)] hover:shadow-[0_0_30px_rgba(0,212,170,0.65)] cursor-pointer"
                    : "bg-[#1f2633] text-[#64748b] cursor-not-allowed opacity-50"
                }`}
                title={isRtl ? "إرسال (Enter)" : "Send (Enter)"}
              >
                <Send className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
              </motion.button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
