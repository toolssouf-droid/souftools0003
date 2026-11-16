"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Upload,
  Sparkles,
  Play,
  Pause,
  Copy,
  Check,
  FileText,
  Activity,
  Loader2,
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";

interface AudioClientPageProps {
  locale: string;
}

export function AudioClientPage({ locale }: AudioClientPageProps) {
  const isRtl = isRtlLocale(locale);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    setTranscription("");
    timerRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setIsLoading(true);

    // Simulate speech-to-text processing
    setTimeout(() => {
      setIsLoading(false);
      setTranscription(
        isRtl
          ? "أهلاً بكم في منصة SoufTools الذكية. تم تسجيل وتحليل المقطع الصوتي بدقة فائقة عبر محرك معالجة الصوت المتقدم."
          : "Welcome to SoufTools. Audio signal captured and transcribed with high-fidelity neural acoustics."
      );
    }, 1500);
  };

  const handleCopy = () => {
    if (!transcription) return;
    navigator.clipboard.writeText(transcription);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0f0f] text-[#e8f5f5] flex flex-col justify-between selection:bg-[#00d4aa]/30">
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "محرك تحويل الصوت إلى نص والتفريغ العصبي" : "Neural Voice & Speech-to-Text"}
        subtitle={isRtl ? "تفريغ صوتي ذكي للمحادثات والتسجيلات" : "Voice transcription & audio analysis"}
        icon={<Mic className="w-4 h-4" />}
        backHref={`/${locale}`}
        backLabel={isRtl ? "الرئيسية" : "Home"}
        activeKey="audio"
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRtl ? "تحويل الكلام إلى نص بدقة" : "Speech-to-Text Precision"}</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#e8f5f5]">
            {isRtl ? "تفريغ صوتي ذكي للمحادثات والتسجيلات" : "Neural Voice & Speech Transcription"}
          </h1>
          <p className="text-xs sm:text-sm text-[#88b0b0]">
            {isRtl
              ? "سجل صوتك مباشرة أو ارفع ملفاً صوتياً لتحويله إلى نص دقيق مع ترقيم تلقائي."
              : "Record speech in real-time or upload audio files for punctuation-aware transcription."}
          </p>
        </div>

        {/* RECORDER BOX */}
        <div className="glass-card rounded-3xl border border-[#1e2e2e] bg-[#0d1414] shadow-2xl p-6 sm:p-8 space-y-6 text-center">
          {/* MICROPHONE BUTTON WITH PULSE */}
          <div className="flex flex-col items-center justify-center gap-4 py-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl cursor-pointer ${
                isRecording
                  ? "bg-[#f43f5e] text-white animate-pulse scale-110 shadow-[#f43f5e]/50"
                  : "bg-[#00d4aa] hover:bg-[#00ff88] text-[#0a0f0f] shadow-[#00d4aa]/30 hover:scale-105"
              }`}
            >
              {isRecording ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
            </button>

            {isRecording && (
              <div className="flex items-center gap-2 text-sm font-mono font-bold text-[#f43f5e]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] animate-ping" />
                <span>{formatTime(recordingDuration)}</span>
              </div>
            )}

            <span className="text-xs font-bold text-[#88b0b0]">
              {isRecording
                ? isRtl
                  ? "جاري الاستماع... انقر للإيقاف والتفريغ"
                  : "Listening... click to stop and transcribe"
                : isRtl
                ? "انقر على المايكروفون لبدء التسجيل"
                : "Click microphone to begin recording"}
            </span>
          </div>

          {/* TRANSCRIPTION OUTPUT */}
          <div className="p-5 rounded-2xl bg-[#111a1a] border border-[#1e2e2e] text-right space-y-3 min-h-[140px] flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold text-[#4a7070] border-b border-[#1e2e2e]/60 pb-2">
              <span className="flex items-center gap-1.5 text-[#00d4aa]">
                <FileText className="w-3.5 h-3.5" />
                <span>{isRtl ? "النص المفرّغ" : "Transcribed Output"}</span>
              </span>
              {transcription && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[#88b0b0] hover:text-[#00d4aa] transition-colors"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-[#00ff88]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? (isRtl ? "تم النسخ" : "Copied") : (isRtl ? "نسخ" : "Copy")}</span>
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-xs text-[#00d4aa] gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{isRtl ? "جاري المعالجة الصوتية بالذكاء الاصطناعي..." : "Processing audio with AI..."}</span>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-[#e8f5f5] leading-relaxed py-2">
                {transcription || (
                  <span className="text-[#4a7070]">
                    {isRtl ? "سيظهر النص المفرّغ هنا بعد التسجيل..." : "Transcribed text will appear here..."}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#1e2e2e] bg-[#080d0d] py-6 px-4 text-center text-xs text-[#4a7070]">
        SoufTools Platform © 2026. All rights reserved.
      </footer>
    </div>
  );
}
