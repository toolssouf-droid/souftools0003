"use client";

import React, { useState } from "react";
import {
  Mail,
  Send,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Edit3,
  Check,
  RotateCcw,
  Sparkles,
  User,
  FileText,
  MessageSquare,
  Wand2,
} from "lucide-react";
import { useGmailStore } from "@/store/gmailStore";
import { normalizeAndFixEmailAddress, getEmailDomainSuggestions } from "@/lib/utils/emailFormatter";

interface GmailDraftWidgetProps {
  data: {
    to: string;
    subject: string;
    body: string;
  };
  isRtl?: boolean;
}

export function GmailDraftWidget({ data, isRtl = true }: GmailDraftWidgetProps) {
  const [to, setTo] = useState(() => normalizeAndFixEmailAddress(data.to || ""));
  const [subject, setSubject] = useState(data.subject || "");
  const [body, setBody] = useState(data.body || "");
  
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const { accessToken } = useGmailStore();

  const domainSuggestions = getEmailDomainSuggestions(to);
  const normalizedCandidate = normalizeAndFixEmailAddress(to);
  const hasTypoFix = to.trim() !== "" && normalizedCandidate !== to.trim() && !to.includes(" ");

  const handleApplyDomain = (domain: string) => {
    const raw = to.trim();
    if (raw.includes("@")) {
      const prefix = raw.split("@")[0];
      setTo(`${prefix}${domain}`);
    } else {
      setTo(`${raw}${domain}`);
    }
  };

  const handleApplyAutoFix = () => {
    setTo(normalizedCandidate);
  };

  const handleReset = () => {
    setTo(normalizeAndFixEmailAddress(data.to || ""));
    setSubject(data.subject || "");
    setBody(data.body || "");
    setIsEditing(false);
  };

  const handleSend = async () => {
    const cleanTo = normalizeAndFixEmailAddress(to);

    if (!accessToken) {
      setErrorMessage(isRtl ? "لم يتم ربط حساب Gmail بعد. يرجى تسجيل الدخول من قائمة الأدوات لتمكين الإرسال الفعلي." : "Gmail account not connected. Please connect from Tools.");
      setStatus("error");
      return;
    }

    if (!cleanTo) {
      setErrorMessage(isRtl ? "يرجى تحديد عنوان البريد الإلكتروني للمستلم." : "Please specify recipient email address.");
      setStatus("error");
      return;
    }

    setStatus("sending");
    setErrorMessage("");
    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: cleanTo,
          subject: subject.trim(),
          emailBody: body,
          token: accessToken,
        }),
      });

      const result = await response.json().catch(() => null);

      if (response.ok && result && result.success !== false) {
        setStatus("success");
        setTo(cleanTo);
      } else {
        setErrorMessage(result?.error || (isRtl ? "حدث خطأ أثناء الإرسال" : "Failed to send email"));
        setStatus("error");
      }
    } catch (error: any) {
      setErrorMessage(error.message || (isRtl ? "حدث خطأ غير متوقع" : "Unexpected error occurred"));
      setStatus("error");
    }
  };

  const isModified = to !== data.to || subject !== data.subject || body !== data.body;

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="w-full max-w-lg rounded-2xl overflow-hidden border border-[#1e2e2e] bg-[#0c1414] shadow-[0_10px_35px_rgba(0,0,0,0.5)] font-sans my-2.5 relative select-text text-start transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-[#1e2e2e] bg-gradient-to-r from-[#0f1d1d] via-[#102222] to-[#0f1d1d]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,212,170,0.15)]">
            <Mail className="w-5 h-5 text-[#00d4aa]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[#e8f5f5] text-sm">
                {isRtl ? "مسودة بريد إلكتروني تفاعلية" : "Interactive Email Draft"}
              </h3>
              {isModified && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 rounded-md">
                  {isRtl ? "مُعدّلة" : "Edited"}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#5c8a8a] mt-0.5 font-medium">
              {status === "success"
                ? (isRtl ? "تم إرسال الرسالة إلى المستلم بنجاح عبر Gmail" : "Message sent successfully via Gmail")
                : (isRtl ? "يمكنك مراجعة وتعديل محتوى الرسالة وإرسالها مباشرة" : "Review, edit and send directly")}
            </p>
          </div>
        </div>

        {status !== "success" && (
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
              isEditing
                ? "bg-[#00d4aa]/20 border-[#00d4aa]/50 text-[#00d4aa]"
                : "bg-[#142020] border-[#1e2e2e] text-[#a3c2c2] hover:text-[#e8f5f5] hover:bg-[#1a2b2b]"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? (isRtl ? "تم التعديل" : "Done") : (isRtl ? "تعديل الرسالة" : "Edit Draft")}</span>
          </button>
        )}
      </div>

      {/* Content Form */}
      <div className="p-3.5 sm:p-4 space-y-3.5 text-xs sm:text-sm">
        {/* Recipient Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-[#5c8a8a] flex items-center gap-1">
              <User className="w-3 h-3 text-[#00d4aa]" />
              <span>{isRtl ? "إلى (المرسل إليه)" : "Recipient (To)"}</span>
            </label>
            {hasTypoFix && (
              <button
                type="button"
                onClick={handleApplyAutoFix}
                className="text-[10px] text-[#00d4aa] bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 border border-[#00d4aa]/30 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                title={isRtl ? "إصلاح صيغة البريد الإلكتروني تلقائياً" : "Auto-fix email syntax"}
              >
                <Wand2 className="w-2.5 h-2.5" />
                <span>{isRtl ? `تصحيح إلى: ${normalizedCandidate}` : `Fix: ${normalizedCandidate}`}</span>
              </button>
            )}
          </div>
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full text-[#e8f5f5] bg-[#101b1b] px-3 py-2 rounded-xl border border-[#00d4aa]/40 focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa]/30 focus:outline-none transition-all font-mono text-xs"
              />
              {/* Domain suggestion chips */}
              {domainSuggestions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-[#5c8a8a]">{isRtl ? "إكمال تلقائي:" : "Quick domains:"}</span>
                  {domainSuggestions.map((dom) => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => handleApplyDomain(dom)}
                      className="px-2 py-0.5 rounded-md bg-[#162525] hover:bg-[#00d4aa]/20 hover:text-[#00d4aa] text-[#a3c2c2] border border-[#1e2e2e] text-[10px] font-mono transition-all cursor-pointer"
                    >
                      {dom}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="text-[#e8f5f5] bg-[#0e1717] hover:bg-[#121d1d] px-3 py-2 rounded-xl border border-[#1e2e2e] break-all font-mono text-xs cursor-pointer transition-colors"
              title={isRtl ? "انقر للتعديل" : "Click to edit"}
            >
              {to || <span className="text-[#5c8a8a] italic">{isRtl ? "لم يتم تحديد مستلم" : "No recipient set"}</span>}
            </div>
          )}
        </div>

        {/* Subject Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-[#5c8a8a] flex items-center gap-1">
              <FileText className="w-3 h-3 text-[#00d4aa]" />
              <span>{isRtl ? "الموضوع" : "Subject"}</span>
            </label>
          </div>
          {isEditing ? (
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={isRtl ? "عنوان البريد..." : "Email subject..."}
              className="w-full text-[#e8f5f5] bg-[#101b1b] px-3 py-2 rounded-xl border border-[#00d4aa]/40 focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa]/30 focus:outline-none transition-all text-xs sm:text-sm font-medium"
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="text-[#e8f5f5] bg-[#0e1717] hover:bg-[#121d1d] px-3 py-2 rounded-xl border border-[#1e2e2e] font-medium text-xs sm:text-sm cursor-pointer transition-colors"
              title={isRtl ? "انقر للتعديل" : "Click to edit"}
            >
              {subject || <span className="text-[#5c8a8a] italic">{isRtl ? "بدون موضوع" : "No subject"}</span>}
            </div>
          )}
        </div>

        {/* Message Body Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-[#5c8a8a] flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-[#00d4aa]" />
              <span>{isRtl ? "نص الرسالة" : "Message Body"}</span>
            </label>
            <span className="text-[10px] text-[#4a7070] font-mono">
              {body.length} {isRtl ? "حرف" : "chars"}
            </span>
          </div>
          {isEditing ? (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder={isRtl ? "اكتب محتوى الرسالة هنا..." : "Write message content here..."}
              className="w-full text-[#e8f5f5] bg-[#101b1b] p-3 rounded-xl border border-[#00d4aa]/40 focus:border-[#00d4aa] focus:ring-1 focus:ring-[#00d4aa]/30 focus:outline-none transition-all text-xs sm:text-sm leading-relaxed custom-scrollbar resize-y min-h-[120px]"
            />
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="text-[#c8dede] bg-[#0e1717] hover:bg-[#121d1d] p-3 rounded-xl border border-[#1e2e2e] whitespace-pre-wrap min-h-[90px] max-h-[220px] overflow-y-auto custom-scrollbar leading-relaxed text-xs sm:text-sm cursor-pointer transition-colors"
              title={isRtl ? "انقر للتعديل" : "Click to edit"}
            >
              {body || <span className="text-[#5c8a8a] italic">{isRtl ? "نص الرسالة فارغ" : "Empty message body"}</span>}
            </div>
          )}
        </div>

        {/* Reset modifications button if modified */}
        {isModified && status !== "success" && (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-[#7a9e9e] hover:text-[#e8f5f5] flex items-center gap-1 hover:underline transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isRtl ? "استعادة المسودة الأصلية" : "Reset to original draft"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Status & Actions Footer */}
      <div className="p-3.5 sm:p-4 pt-2 border-t border-[#1e2e2e] bg-[#090f0f]">
        {status === "error" && (
          <div className="flex items-center gap-2 text-[#f43f5e] text-xs mb-3 bg-[#f43f5e]/10 p-2.5 rounded-xl border border-[#f43f5e]/25">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {status === "success" ? (
          <div className="flex items-center justify-center gap-2 text-[#00d4aa] text-xs sm:text-sm py-2.5 font-bold bg-[#00d4aa]/10 rounded-xl border border-[#00d4aa]/30 shadow-[0_0_15px_rgba(0,212,170,0.15)]">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-[#00d4aa]" />
            <span>{isRtl ? "تم الإرسال بنجاح إلى " + to : "Sent successfully to " + to}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={status === "sending"}
              className="flex-1 flex items-center justify-center gap-2 bg-[#00d4aa] hover:bg-[#00ffcc] text-[#0c1414] font-bold py-2.5 px-4 rounded-xl transition-all duration-200 active:scale-[0.98] shadow-[0_0_15px_rgba(0,212,170,0.25)] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 cursor-pointer text-xs sm:text-sm"
            >
              {status === "sending" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0c1414]" />
                  <span>{isRtl ? "جاري الإرسال عبر Gmail..." : "Sending via Gmail..."}</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-[#0c1414]" />
                  <span>{isRtl ? "إرسال الآن" : "Send Now"}</span>
                </>
              )}
            </button>

            {isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-3 py-2.5 rounded-xl border border-[#00d4aa]/40 text-[#00d4aa] bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 font-semibold transition-all text-xs cursor-pointer"
              >
                {isRtl ? "حفظ التعديل" : "Done"}
              </button>
            ) : (
              <button
                type="button"
                disabled={status === "sending"}
                className="px-3.5 py-2.5 rounded-xl border border-[#1e2e2e] text-[#a3c2c2] hover:text-[#e8f5f5] hover:bg-[#142020] font-medium transition-colors text-xs disabled:opacity-50 cursor-pointer"
                onClick={() => {
                  setStatus("error");
                  setErrorMessage(isRtl ? "تم إلغاء إرسال المسودة." : "Draft sending cancelled.");
                }}
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

