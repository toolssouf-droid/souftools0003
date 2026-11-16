"use client";

import React, { useEffect, useRef } from "react";
import { MessageItem } from "./MessageItem";
import { ChatMessage, useChatStore } from "@/store/chatStore";
import { motion } from "motion/react";
import { Sparkles, Send } from "lucide-react";
import { SoufToolsLogo, ModelLogo } from "@/components/ui/Logos";
import { SearchStatusBanner } from "@/components/sources/SearchStatusBanner";
import { LiveAgentActivityCenter } from "./LiveAgentActivityCenter";
import { isRtlLocale } from "@/lib/i18n";

interface MessageListProps {
  messages: ChatMessage[];
  locale: string;
  onRegenerate?: (message: ChatMessage) => void;
  onEditUserMessage?: (messageId: string, newContent: string) => void;
  onRateMessage?: (messageId: string, rating: "like" | "dislike" | null) => void;
  onSelectSuggestion?: (suggestion: any) => void;
  onStop?: () => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  locale,
  onRegenerate,
  onEditUserMessage,
  onRateMessage,
  onSelectSuggestion,
  onStop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const prevMessagesLength = useRef(messages.length);
  const {
    isGenerating,
    webSearchEnabled,
    liveSearching,
    liveSearchSources,
    liveSearchQuery,
    activeSessionId,
    sessions,
  } = useChatStore();
  const isRtl = isRtlLocale(locale);

  const activeSession = React.useMemo(() => {
    return (sessions || []).find((s) => s.id === activeSessionId);
  }, [sessions, activeSessionId]);

  const isTelegramSession = Boolean(
    activeSession?.isTelegram ||
    activeSession?.source === "telegram" ||
    activeSession?.channel === "telegram" ||
    activeSessionId?.startsWith("tg_")
  );

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
    userScrolledUpRef.current = !isNearBottom;
  };

  useEffect(() => {
    const isNewMessageAdded = messages.length > prevMessagesLength.current;
    prevMessagesLength.current = messages.length;

    if (isNewMessageAdded) {
      userScrolledUpRef.current = false;
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (!userScrolledUpRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center overflow-y-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <SoufToolsLogo size={64} glow={true} />
        </motion.div>

        <h2 className="text-2xl font-bold text-[#e8f5f5] mb-2 font-sans">
          {isRtl ? "أهلاً بك في منصة SoufTools AI" : "Welcome to SoufTools AI"}
        </h2>
        <p className="text-sm text-[#4a7070] max-w-md leading-relaxed mb-6">
          {isRtl
            ? "استخدم SoufAI للبحث المباشر، البرمجة، والتحليل الذكي مع أحدث النماذج وتوليد الاستجابات."
            : "Ask SoufAI anything with live search, code analysis, and high-performance models."}
        </p>

        {/* Quick Suggestion Chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
          {[
            {
              title: isRtl
                ? "ما أفضل نماذج الذكاء الاصطناعي للبرمجة في 2026؟"
                : "Best AI coding models in 2026?",
              modelId: "coder",
            },
            {
              title: isRtl
                ? "ابحث عن أحدث التحديثات في توثيق React المباشر"
                : "Search latest updates in React documentation",
              modelId: "core",
            },
            {
              title: isRtl
                ? "مقارنة بين Next.js و Remix بالتوثيق الرسمي"
                : "Compare Next.js vs Remix official docs",
              modelId: "pro",
            },
            {
              title: isRtl
                ? "شرح أحدث أوراق البحث العلمية في الذكاء الاصطناعي"
                : "Explain recent AI research papers",
              modelId: "spark",
            },
          ].map((chip, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.02, borderColor: "#00d4aa" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const event = new CustomEvent("quickPrompt", { detail: chip.title });
                window.dispatchEvent(event);
              }}
              className="p-3 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-right cursor-pointer transition-all hover:bg-[#1e2e2e]/50 flex items-center gap-3 shadow-md"
            >
              <ModelLogo modelId={chip.modelId} size={28} />
              <span className="text-xs text-[#e8f5f5]/90 font-medium line-clamp-2">
                {chip.title}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto pb-6 space-y-3 px-3 sm:px-6 max-w-5xl mx-auto w-full flex flex-col min-w-0"
    >
      {/* Omnichannel Telegram Continuity Indicator Banner */}
      {isTelegramSession && (
        <div className="mx-auto max-w-3xl w-full my-2 px-3.5 py-2.5 rounded-xl bg-sky-950/40 border border-sky-500/35 flex items-center justify-between text-xs text-sky-200 shadow-sm shadow-sky-950/50 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <Send className="w-3.5 h-3.5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sky-200">
                  {isRtl ? "محادثة متصلة ومستمرة من تيليجرام" : "Continuing from Telegram"}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/25 text-sky-300 font-mono border border-sky-500/30">
                  OMNICHANNEL SYNC
                </span>
              </div>
              <p className="text-[11px] text-sky-300/80 mt-0.5">
                {isRtl
                  ? "أنت تواصل نفس الحوار الذي بدأ في تيليجرام الآن داخل المنصة. يحتفظ الوكيل الذكي بكامل السياق ويمكنك سؤاله عما دار بينكما."
                  : "You are continuing this chat inside the web platform; the AI agent maintains full context of your Telegram discussion."}
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex text-[10px] px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-300 font-mono">
            {activeSession?.telegramUsername ? `@${activeSession.telegramUsername}` : (activeSession?.telegramSender || "Telegram")}
          </span>
        </div>
      )}

      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          locale={locale}
          onRegenerate={onRegenerate}
          onEditUserMessage={onEditUserMessage}
          onRateMessage={onRateMessage}
          onSelectSuggestion={onSelectSuggestion}
          isGenerating={isGenerating}
        />
      ))}

      {/* Live Agent Activity Center during generation if last message is not already streaming */}
      {isGenerating && (!messages.length || messages[messages.length - 1].role !== "model" || !messages[messages.length - 1].isStreaming) && (
        <div className="max-w-4xl mx-auto px-1 sm:px-4 py-1">
          <LiveAgentActivityCenter
            isGenerating={true}
            isStreaming={true}
            sources={liveSearchSources}
            queriesUsed={liveSearchQuery ? [liveSearchQuery] : []}
            onStop={onStop}
            locale={locale}
            userPrompt={messages.length > 0 && messages[messages.length - 1].role === "user" ? messages[messages.length - 1].content : ""}
          />
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
