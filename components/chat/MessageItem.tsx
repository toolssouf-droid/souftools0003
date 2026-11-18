"use client";

import React, { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Copy,
  Check,
  User,
  Globe,
  Cpu,
  FileText,
  Mic,
  Pencil,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  X,
  Send,
  ChevronDown,
  ChevronUp,
  Brain,
  Sparkles,
  CheckCircle2,
  Activity,
  Zap,
  Download,
  Maximize2,
} from "lucide-react";
import { downloadImage, copyToClipboard } from "@/lib/utils";
import { isAgentDecisionPayload } from "@/lib/agent/agentDecisionParser";
import { ChatMessage, SoufAISuggestionItem, useChatStore } from "@/store/chatStore";
import { ModelLogo, SoufToolsLogo } from "@/components/ui/Logos";
import { FormattedMessage } from "./FormattedMessage";
import { SoufSourcesList } from "@/components/sources/SoufSourcesList";
import { MemoryBadge } from "./MemoryBadge";
import { LiveAgentActivityCenter } from "./LiveAgentActivityCenter";
import { TimeClockWidget } from "@/components/widgets/TimeClockWidget";
import { AmbiguousTimeWidget } from "@/components/widgets/AmbiguousTimeWidget";
import { ImageResultWidget } from "@/components/widgets/ImageResultWidget";
import { GmailDraftWidget } from "@/components/chat/widgets/GmailDraftWidget";
import { GmailInboxWidget } from "@/components/chat/widgets/GmailInboxWidget";
import { GmailReadWidget } from "@/components/chat/widgets/GmailReadWidget";
import { CodingWorkspaceWidget } from "@/components/chat/widgets/CodingWorkspaceWidget";
import { SoufFileWidget } from "@/components/chat/widgets/SoufFileWidget";
import { ScheduledTaskWidget } from "@/components/chat/widgets/ScheduledTaskWidget";
import { InlineMediaPlayer } from "@/components/media/InlineMediaPlayer";
import { SoufAISuggestions } from "./SoufAISuggestions";
import { isRtlLocale } from "@/lib/i18n";

interface MessageItemProps {
  message: ChatMessage;
  locale: string;
  onRegenerate?: (message: ChatMessage) => void;
  onEditUserMessage?: (messageId: string, newContent: string) => void;
  onRateMessage?: (messageId: string, rating: "like" | "dislike" | null) => void;
  onSelectSuggestion?: (suggestion: any) => void;
  isGenerating?: boolean;
}

const MessageItemComponent: React.FC<MessageItemProps> = ({
  message,
  locale,
  onRegenerate,
  onEditUserMessage,
  onRateMessage,
  onSelectSuggestion,
  isGenerating,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showAgentSteps, setShowAgentSteps] = useState(false);

  const isUser = message.role === "user";
  const isRtl = isRtlLocale(locale);
  const displayedContent =
    !isUser && isAgentDecisionPayload(message.content)
      ? isRtl
        ? "لم يتمكن الوكيل من إنشاء إجابة نهائية صالحة. أعد إرسال الطلب للحصول على رد جديد."
        : "The agent did not produce a usable final response. Resend the request for a new answer."
      : message.content;

  // Retrieve user prompt for contextually determining agent activity necessity
  const userPrompt = useMemo(() => {
    if (isUser) return "";
    const allMsgs = useChatStore.getState().messages;
    const idx = allMsgs.findIndex((m) => m.id === message.id);
    if (idx > 0) {
      for (let i = idx - 1; i >= 0; i--) {
        if (allMsgs[i].role === "user") return allMsgs[i].content;
      }
    }
    return "";
  }, [message.id, isUser]);

  const handleCopy = async () => {
    await copyToClipboard(displayedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartEdit = () => {
    if (onEditUserMessage) {
      onEditUserMessage(message.id, message.content);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("souf-chat-edit-message", {
          detail: { messageId: message.id, content: message.content },
        })
      );
    }
  };

  const handleSaveEdit = () => {
    if (!editContent.trim()) return;
    if (onEditUserMessage) {
      onEditUserMessage(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  // Token calculation and estimation
  // Calculates tokens accurately across Arabic and Latin scripts (~1 token per 3-4 latin chars or ~1.5 tokens per arabic word)
  const calculateEstimatedTokens = (text: string): number => {
    if (!text || !text.trim()) return 0;
    const arabicChars = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
    const otherChars = text.length - arabicChars;
    // Arabic script typically takes ~1 token per 1.8-2.2 characters in modern LLM tokenizers (tiktoken/Gemini)
    // Latin / English text typically takes ~1 token per 3.8-4 characters
    const estimatedTokens = Math.max(1, Math.round(arabicChars / 2.0 + otherChars / 3.8));
    return estimatedTokens;
  };

  const tokenCount = calculateEstimatedTokens(displayedContent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`w-full group py-2 transition-all flex flex-col ${
        isUser ? "items-end" : "items-start"
      }`}
    >
      <div
        className={`p-4 rounded-2xl transition-all flex flex-col min-w-0 ${
          isUser
            ? "max-w-[92%] sm:max-w-[80%] bg-[#00d4aa]/[0.10] border border-[#00d4aa]/30 shadow-md shadow-[#00d4aa]/5 text-[#f1f5f9]"
            : "w-full max-w-[96%] sm:max-w-[88%] bg-[#12161f] border border-[#1f2633] shadow-md text-[#f1f5f9]"
        } ${isUser ? (isRtl ? "rounded-tl-none" : "rounded-tr-none") : (isRtl ? "rounded-tr-none" : "rounded-tl-none")}`}
        dir="auto"
      >
        {/* Header Row: User / Model Info */}
        <div
          className={`flex items-center justify-between gap-2 mb-2.5 w-full flex-wrap ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {/* Header Left/Right: Avatar + Title + Badges */}
          <div className={`flex items-center gap-2 flex-wrap ${isUser ? "flex-row-reverse" : "flex-row"}`}>
            {isUser ? (
              <div className="flex items-center gap-2 flex-row-reverse">
                <div className="w-6 h-6 rounded-lg bg-[#00d4aa]/20 border border-[#00d4aa]/40 flex items-center justify-center text-[#00d4aa]">
                  <User className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span className="text-xs font-bold text-[#00d4aa]">
                  {isRtl ? "أنت" : "You"}
                </span>

                {((message as any).source === "telegram" || message.id.startsWith("tg_msg_")) && (
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md border border-sky-500/30 flex items-center gap-1">
                    <Send className="w-2.5 h-2.5 text-sky-400" />
                    <span>{isRtl ? "تيليجرام" : "Telegram"}</span>
                  </span>
                )}

                {((message as any).source === "web" && message.id.startsWith("web_msg_")) && (
                  <span className="text-[10px] bg-[#00d4aa]/15 text-[#00d4aa] px-2 py-0.5 rounded-md border border-[#00d4aa]/30 flex items-center gap-1">
                    <span>{isRtl ? "المنصة" : "Platform"}</span>
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center">
                  {message.modelUsed ? (
                    <ModelLogo modelId={message.modelUsed} size={24} />
                  ) : (
                    <SoufToolsLogo size={24} glow={true} />
                  )}
                </div>
                <span className="text-xs font-extrabold text-[#f1f5f9]">
                  SoufAI
                </span>

                {((message as any).source === "telegram" || message.id.startsWith("tg_msg_")) && (
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-md border border-sky-500/30 flex items-center gap-1">
                    <Send className="w-2.5 h-2.5 text-sky-400" />
                    <span>{isRtl ? "عبر تيليجرام" : "via Telegram"}</span>
                  </span>
                )}

                {((message as any).source === "web" && message.id.startsWith("web_msg_")) && (
                  <span className="text-[10px] bg-[#00d4aa]/15 text-[#00d4aa] px-2 py-0.5 rounded-md border border-[#00d4aa]/30 flex items-center gap-1">
                    <span>{isRtl ? "عبر المنصة" : "via Platform"}</span>
                  </span>
                )}

                {message.modelUsed && (
                  <span className="text-[10px] bg-[#00d4aa]/15 text-[#00d4aa] px-2 py-0.5 rounded-md border border-[#00d4aa]/30 flex items-center gap-1 font-mono">
                    <Cpu className="w-3 h-3" />
                    {message.modelUsed}
                  </span>
                )}

                {message.webSearchUsed && (
                  <span className="text-[10px] bg-[#0ea5e9]/15 text-[#0ea5e9] px-2 py-0.5 rounded-md border border-[#0ea5e9]/30 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {isRtl ? "بحث الويب الحي" : "Web Search"}
                  </span>
                )}

                {message.reasoningMode && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 font-bold ${
                      message.reasoningMode === "deep_thinking"
                        ? "bg-[#00d4aa]/15 text-[#00d4aa] border-[#00d4aa]/30"
                        : message.reasoningMode === "deep_analysis"
                        ? "bg-[#0ea5e9]/15 text-[#0ea5e9] border-[#0ea5e9]/30"
                        : "bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/30"
                    }`}
                  >
                    {message.reasoningMode === "deep_thinking" && <Brain className="w-3 h-3" />}
                    {message.reasoningMode === "deep_analysis" && <Activity className="w-3 h-3" />}
                    {message.reasoningMode === "fast_mode" && <Zap className="w-3 h-3" />}
                    {message.reasoningMode === "deep_thinking"
                      ? isRtl ? "تفكير عميق" : "Deep Thinking"
                      : message.reasoningMode === "deep_analysis"
                      ? isRtl ? "تحليل عميق" : "Deep Analysis"
                      : isRtl ? "الوضع السريع" : "Fast Mode"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Inline Editing Mode */}
        {isUser && isEditing ? (
          <div className="space-y-2 mt-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#0b1414] border border-[#00d4aa] text-xs sm:text-sm text-[#e8f5f5] focus:outline-none resize-none"
              rows={3}
              dir="auto"
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-lg bg-[#111a1a] border border-[#1e2e2e] text-[#4a7070] hover:text-[#e8f5f5] text-xs flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>{isRtl ? "إلغاء" : "Cancel"}</span>
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1.5 rounded-lg bg-[#00d4aa] text-[#0a0f0f] font-bold text-xs hover:opacity-90 flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isRtl ? "حفظ وتوليد" : "Save & Generate"}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Main Message Body Display */
          <div className="relative text-xs sm:text-sm text-[#e8f5f5] leading-relaxed">
            {/* SoufAI Live Agent Activity Center Container */}
            {!isUser && (message.agentSteps || message.activityState || message.isStreaming) && (
              <LiveAgentActivityCenter
                activityState={message.activityState}
                agentSteps={message.agentSteps || []}
                sources={message.sources || []}
                pagesRead={message.pagesRead || []}
                queriesUsed={message.queriesUsed || []}
                isGenerating={Boolean(isGenerating && message.isStreaming)}
                isStreaming={message.isStreaming || false}
                locale={locale}
                userPrompt={userPrompt}
              />
            )}

            <FormattedMessage
              content={displayedContent}
              sources={message.sources}
              isRtl={isRtl}
            />

            {/* Interactive SoufAI Widgets */}
            {!isUser && message.widgetData && (
              <div className="my-2">
                {message.widgetData.type === "time_clock" && (
                  <TimeClockWidget data={message.widgetData.data} isRtl={isRtl} />
                )}
                {message.widgetData.type === "time_ambiguous" && (
                  <AmbiguousTimeWidget data={message.widgetData.data} isRtl={isRtl} />
                )}
                {message.widgetData.type === "image_result" && (
                  <ImageResultWidget data={message.widgetData.data} />
                )}
                {message.widgetData.type === "gmail_draft" && (
                  <GmailDraftWidget data={message.widgetData.data} isRtl={isRtl} />
                )}
                {message.widgetData.type === "gmail_inbox" && (
                  <GmailInboxWidget data={message.widgetData.data} isRtl={isRtl} />
                )}
                {message.widgetData.type === "gmail_read" && (
                  <GmailReadWidget data={message.widgetData.data} isRtl={isRtl} />
                )}
                {message.widgetData.type === "coding_workspace" && (
                  <CodingWorkspaceWidget data={message.widgetData.data} isRtl={isRtl} />
                )}
                {(message.widgetData.type === "souf_file" || message.widgetData.type === "souf_files") && (
                  <SoufFileWidget data={message.widgetData.data} isRtl={isRtl} />
                )}
                {(message.widgetData.type === "scheduled_task" || message.widgetData.type === "schedule_list") && (
                  <ScheduledTaskWidget data={message.widgetData.data} isRtl={isRtl} />
                )}
                {message.widgetData.type === "media_player" && (
                  <div className="my-2.5 w-full">
                    <InlineMediaPlayer
                      payload={(message.widgetData as any).payload || (message.widgetData as any).data?.mediaPayload || (message.widgetData as any).data}
                      isRtl={isRtl}
                    />
                  </div>
                )}
              </div>

            )}

            {/* Blinking Streaming Cursor for Assistant Response */}
            {!isUser && message.isStreaming && (
              <span className="inline-block w-2 h-4 bg-[#00d4aa] animate-pulse align-middle ms-1 shadow-[0_0_8px_#00d4aa]" />
            )}
          </div>
        )}

        {/* Attachments Section if user uploaded files */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2" dir={isRtl ? "rtl" : "ltr"}>
            {message.attachments.map((att: any, idx: number) => (
              <div key={`msg-att-${idx}`} className="flex-shrink-0">
                {att.type === "image" && (
                  <div className="relative group rounded-xl overflow-hidden border border-[#00d4aa]/30 bg-[#0c1414]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.data}
                      alt={att.name}
                      className="max-w-[240px] max-h-[160px] object-cover rounded-xl"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => downloadImage(att.data, att.name || `image_${Date.now()}.png`)}
                        className="p-1.5 rounded-lg bg-[#00d4aa] text-[#0a0f0f] hover:opacity-90 transition-all font-bold text-xs flex items-center gap-1 cursor-pointer"
                        title={isRtl ? "تحميل الصورة" : "Download image"}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="text-[10px]">{isRtl ? "تحميل" : "Download"}</span>
                      </button>
                    </div>
                  </div>
                )}
                {att.type === "file" && (
                  <div className="flex items-center justify-between gap-2 p-2 px-3 bg-[#0a1515] border border-[#00d4aa]/30 rounded-xl text-xs text-[#e8f5f5]">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#eab308] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold truncate max-w-[140px] text-[#e8f5f5]">
                          {att.name}
                        </p>
                        <p className="text-[10px] text-[#4a7070] font-mono">
                          {att.size ? `${(att.size / 1024).toFixed(1)} KB` : "Document"}
                        </p>
                      </div>
                    </div>
                    {att.data && (
                      <button
                        type="button"
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = att.data;
                          a.download = att.name || "file.txt";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="p-1 rounded-md text-[#4a7070] hover:text-[#00d4aa] transition-colors"
                        title={isRtl ? "تحميل الملف" : "Download file"}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {att.type === "audio" && (
                  <div className="flex flex-col gap-1.5 p-2 bg-[#0a1515] border border-[#00d4aa]/30 rounded-xl">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#4a7070] px-1">
                      <Mic className="w-3.5 h-3.5 text-[#ef4444] shrink-0" />
                      <span className="truncate max-w-[160px]">{att.name}</span>
                    </div>
                    <audio src={att.data} controls className="h-8 max-w-[220px]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* User Message Bottom Action Bar (Edit, Copy & Tokens) */}
        {isUser && !isEditing && (
          <div className="flex items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-[#00d4aa]/20 w-full flex-wrap">
            {/* Token Counter */}
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[#8db3b3] font-mono bg-[#0b1414]/90 px-2.5 py-1 rounded-lg border border-[#00d4aa]/25">
              <Cpu className="w-3.5 h-3.5 text-[#00d4aa]" />
              <span>
                {isRtl
                  ? `${tokenCount.toLocaleString()} توكن`
                  : `${tokenCount.toLocaleString()} tokens`}
              </span>
            </div>

            {/* Action Buttons: Edit & Copy */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleStartEdit}
                className="px-2.5 py-1 text-[#8db3b3] hover:text-[#00d4aa] bg-[#0b1414]/90 hover:bg-[#00d4aa]/15 border border-[#1e2e2e] hover:border-[#00d4aa]/40 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer shadow-sm"
                title={isRtl ? "تعديل الرسالة في خانة الكتابة" : "Edit message in input bar"}
              >
                <Pencil className="w-3.5 h-3.5 text-[#00d4aa]" />
                <span>{isRtl ? "تعديل" : "Edit"}</span>
              </button>

              <button
                onClick={handleCopy}
                className="px-2.5 py-1 text-[#8db3b3] hover:text-[#00d4aa] bg-[#0b1414]/90 hover:bg-[#00d4aa]/15 border border-[#1e2e2e] hover:border-[#00d4aa]/40 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer shadow-sm"
                title={isRtl ? "نسخ النص" : "Copy text"}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span className="text-[#00ff88] text-xs font-medium">{isRtl ? "تم النسخ" : "Copied"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#00d4aa]" />
                    <span className="text-xs font-medium">{isRtl ? "نسخ" : "Copy"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Assistant Sources List Section */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <SoufSourcesList sources={message.sources} />
          </div>
        )}

        {/* Assistant Memory Badge */}
        {!isUser && (message.usedMemories || message.candidateNewMemory) && (
          <div className="mt-2">
            <MemoryBadge
              usedMemories={message.usedMemories}
              candidateMemory={message.candidateNewMemory}
              isRtl={isRtl}
            />
          </div>
        )}

        {/* SoufAI Proactive & Contextual Suggestions */}
        {!isUser && !message.isStreaming && message.suggestions && message.suggestions.length > 0 && (
          <SoufAISuggestions
            suggestions={message.suggestions}
            questionTitle={message.suggestions[0]?.questionTitle}
            alreadySelected={message.selectedSuggestions}
            onSelectSuggestions={(selectedList, customAnswer) =>
              onSelectSuggestion?.({ selectedList, customAnswer, messageId: message.id })
            }
            locale={locale}
            isGenerating={isGenerating}
          />
        )}

        {/* Assistant Action Bar & Token Count */}
        {!isUser && (
          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-[#1e2e2e]/40 transition-opacity">
            {/* Token Counter */}
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-[#8db3b3] font-mono bg-[#111a1a]/80 px-2.5 py-1 rounded-lg border border-[#1e2e2e]/60">
              <Cpu className="w-3.5 h-3.5 text-[#00d4aa]" />
              <span>
                {isRtl
                  ? `${tokenCount.toLocaleString()} توكن`
                  : `${tokenCount.toLocaleString()} tokens`}
              </span>
            </div>

            {/* Tool Actions: Copy, Regenerate, Rating */}
            <div className="flex items-center gap-1.5">
              {/* Copy Button */}
              <button
                onClick={handleCopy}
                className="px-2.5 py-1 text-[#8db3b3] hover:text-[#00d4aa] bg-[#111a1a]/80 hover:bg-[#00d4aa]/15 border border-[#1e2e2e] rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer shadow-sm"
                title={isRtl ? "نسخ الرد بالكامل" : "Copy response"}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span className="text-[#00ff88] text-[11px] font-medium">{isRtl ? "تم النسخ" : "Copied"}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#00d4aa]" />
                    <span className="text-[11px] font-medium">{isRtl ? "نسخ" : "Copy"}</span>
                  </>
                )}
              </button>

              {/* Regenerate Button */}
              {onRegenerate && (
                <button
                  onClick={() => onRegenerate(message)}
                  className="px-2.5 py-1 text-[#8db3b3] hover:text-[#00d4aa] bg-[#111a1a]/80 hover:bg-[#00d4aa]/15 border border-[#1e2e2e] rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer shadow-sm"
                  title={isRtl ? "إعادة التوليد" : "Regenerate"}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#00d4aa]" />
                  <span className="text-[11px] font-medium hidden xs:inline">{isRtl ? "إعادة" : "Retry"}</span>
                </button>
              )}

              {/* Positive Rating Button */}
              {onRateMessage && (
                <button
                  onClick={() => onRateMessage(message.id, message.rating === "like" ? null : "like")}
                  className={`p-1.5 rounded-lg transition-colors text-xs cursor-pointer border ${
                    message.rating === "like"
                      ? "bg-[#00d4aa]/20 text-[#00d4aa] border-[#00d4aa]/40"
                      : "text-[#8db3b3] hover:text-[#00d4aa] bg-[#111a1a]/80 hover:bg-[#111a1a] border-[#1e2e2e]"
                  }`}
                  title={isRtl ? "تقييم إيجابي" : "Thumbs up"}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Negative Rating Button */}
              {onRateMessage && (
                <button
                  onClick={() => onRateMessage(message.id, message.rating === "dislike" ? null : "dislike")}
                  className={`p-1.5 rounded-lg transition-colors text-xs cursor-pointer border ${
                    message.rating === "dislike"
                      ? "bg-red-500/20 text-red-400 border-red-500/40"
                      : "text-[#8db3b3] hover:text-red-400 bg-[#111a1a]/80 hover:bg-[#111a1a] border-[#1e2e2e]"
                  }`}
                  title={isRtl ? "تقييم سلبي" : "Thumbs down"}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const MessageItem = React.memo(MessageItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isStreaming === nextProps.message.isStreaming &&
    prevProps.message.rating === nextProps.message.rating &&
    prevProps.locale === nextProps.locale &&
    prevProps.isGenerating === nextProps.isGenerating &&
    prevProps.message.activityState === nextProps.message.activityState &&
    prevProps.message.widgetData === nextProps.message.widgetData &&
    prevProps.message.sources?.length === nextProps.message.sources?.length
  );
});
