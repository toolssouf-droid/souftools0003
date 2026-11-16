"use client";

import React, { useState } from "react";
import { Mail, Calendar, User, Copy, Check, Sparkles, Send, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { useChatStore } from "@/store/chatStore";
import { copyToClipboard } from "@/lib/utils";

interface GmailReadWidgetProps {
  data: {
    id?: string;
    from?: string;
    to?: string;
    subject?: string;
    date?: string;
    body?: string;
    snippet?: string;
  };
  isRtl?: boolean;
}

export function GmailReadWidget({ data, isRtl = true }: GmailReadWidgetProps) {
  const [copied, setCopied] = useState(false);
  const { setInputText } = useChatStore();

  const handleCopy = async () => {
    const text = `من: ${data.from}\nالموضوع: ${data.subject}\nالتاريخ: ${data.date}\n\n${data.body || data.snippet}`;
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReplyPrompt = () => {
    const prompt = isRtl
      ? `قم بصياغة رد احترافي مناسب على هذه الرسالة:\nالموضوع: ${data.subject}\nالمرسل: ${data.from}`
      : `Draft a professional reply to:\nSubject: ${data.subject}\nFrom: ${data.from}`;
    if (setInputText) {
      setInputText(prompt);
    }
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="w-full max-w-2xl my-3 rounded-2xl overflow-hidden border border-[#1e2e2e] bg-[#0c1414] shadow-[0_10px_35px_rgba(0,0,0,0.5)] font-sans text-start select-text"
    >
      {/* Header */}
      <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#0f1d1d] via-[#102222] to-[#0f1d1d] border-b border-[#1e2e2e] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#ea4335]/15 border border-[#ea4335]/30 flex items-center justify-center text-[#ea4335]">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-[#e8f5f5] line-clamp-1">
              {data.subject || (isRtl ? "رسالة بريد إلكتروني" : "Email Message")}
            </h3>
            <p className="text-[10px] text-[#5c8a8a] mt-0.5">
              {isRtl ? "عرض تفاصيل الرسالة الكاملة" : "Full message reader"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg text-[#5c8a8a] hover:text-[#00d4aa] hover:bg-[#142020] border border-transparent hover:border-[#1e2e2e] transition-all cursor-pointer"
            title={isRtl ? "نسخ" : "Copy"}
          >
            {copied ? <Check className="w-4 h-4 text-[#00d4aa]" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Metadata Table */}
      <div className="p-3.5 bg-[#090f0f] border-b border-[#1e2e2e]/50 text-xs space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[#5c8a8a] font-bold shrink-0 w-12">{isRtl ? "من:" : "From:"}</span>
          <span className="text-[#e8f5f5] font-medium break-all">{data.from}</span>
        </div>
        {data.to && (
          <div className="flex items-center gap-2">
            <span className="text-[#5c8a8a] font-bold shrink-0 w-12">{isRtl ? "إلى:" : "To:"}</span>
            <span className="text-[#a3c2c2] break-all">{data.to}</span>
          </div>
        )}
        {data.date && (
          <div className="flex items-center gap-2">
            <span className="text-[#5c8a8a] font-bold shrink-0 w-12">{isRtl ? "التاريخ:" : "Date:"}</span>
            <span className="text-[#a3c2c2]">{data.date}</span>
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="p-4 bg-[#0c1414] text-xs sm:text-sm text-[#c8dede] leading-relaxed max-h-[350px] overflow-y-auto custom-scrollbar whitespace-pre-wrap font-sans">
        {data.body || data.snippet || (isRtl ? "لا يتوفر محتوى نصي لهذه الرسالة." : "No body text available.")}
      </div>

      {/* Actions */}
      <div className="p-3 bg-[#090f0f] border-t border-[#1e2e2e]/60 flex items-center justify-between gap-2">
        <span className="text-[10px] text-[#4a7070] flex items-center gap-1 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-[#00d4aa]" />
          {isRtl ? "تم التحقق عبر واجهة Gmail الآمنة" : "Verified via Google API"}
        </span>

        <button
          type="button"
          onClick={handleReplyPrompt}
          className="px-3 py-1.5 text-xs font-bold text-[#0c1414] bg-[#00d4aa] hover:bg-[#00ffcc] rounded-lg transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,212,170,0.25)] cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#0c1414]" />
          <span>{isRtl ? "صياغة رد على هذه الرسالة" : "Reply to Message"}</span>
        </button>
      </div>
    </div>
  );
}
