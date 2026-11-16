"use client";

import React, { useState } from "react";
import {
  Mail,
  Calendar,
  User,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Copy,
  Check,
  ShieldAlert,
  Zap,
  Rocket,
  Bell,
  MessageSquare,
  Search,
  Filter,
  Eye,
  Loader2,
  Inbox,
} from "lucide-react";
import { useGmailStore } from "@/store/gmailStore";
import { useChatStore } from "@/store/chatStore";
import { copyToClipboard } from "@/lib/utils";

export interface GmailMessageItem {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  category?: string;
  senderName?: string;
  senderEmail?: string;
}

interface GmailInboxWidgetProps {
  data: {
    query?: string;
    total?: number;
    messages?: GmailMessageItem[];
    summary?: string;
  };
  isRtl?: boolean;
}

// Utility to parse sender name and email
function parseSender(fromStr: string) {
  if (!fromStr) return { name: "مجهول", email: "" };
  const match = fromStr.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    const cleanName = match[1].replace(/["']/g, "").trim();
    return { name: cleanName || match[2], email: match[2] };
  }
  return { name: fromStr, email: fromStr };
}

// Detect category based on subject/sender
function detectCategory(subject: string, from: string): { label: string; icon: any; color: string; bg: string; border: string } {
  const text = `${subject} ${from}`.toLowerCase();
  if (text.includes("security") || text.includes("أمن") || text.includes("password") || text.includes("تنبيه") || text.includes("alert") || text.includes("verify") || text.includes("كود")) {
    return { label: "أمان وحسابات", icon: ShieldAlert, color: "text-[#f43f5e]", bg: "bg-[#f43f5e]/10", border: "border-[#f43f5e]/30" };
  }
  if (text.includes("update") || text.includes("تحديث") || text.includes("introducing") || text.includes("new") || text.includes("release") || text.includes("gemini") || text.includes("chatgpt")) {
    return { label: "ميزات وتحديثات", icon: Rocket, color: "text-[#00d4aa]", bg: "bg-[#00d4aa]/10", border: "border-[#00d4aa]/30" };
  }
  if (text.includes("invoice") || text.includes("فاتورة") || text.includes("payment") || text.includes("order") || text.includes("اشتراك") || text.includes("receipt")) {
    return { label: "فواتير وأعمال", icon: Zap, color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/30" };
  }
  return { label: "إشعار عام", icon: Bell, color: "text-[#38bdf8]", bg: "bg-[#38bdf8]/10", border: "border-[#38bdf8]/30" };
}

// Format date to human friendly Arabic or standard
function formatEmailDate(dateStr: string, isRtl: boolean): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    
    // Check if today
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString(isRtl ? "ar-EG" : "en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    
    return d.toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  } catch {
    return dateStr;
  }
}

export function GmailInboxWidget({ data, isRtl = true }: GmailInboxWidgetProps) {
  const messages = data?.messages || [];
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fullBodyLoading, setFullBodyLoading] = useState<string | null>(null);
  const [fullBodies, setFullBodies] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { accessToken } = useGmailStore();
  const { setInputText } = useChatStore();

  const handleCopySummary = async (item: GmailMessageItem) => {
    const text = `📩 ${item.from}\n📌 ${item.subject}\n🕒 ${item.date}\n💬 ${item.snippet}`;
    await copyToClipboard(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRequestReply = (item: GmailMessageItem) => {
    const sender = parseSender(item.from);
    const prompt = isRtl
      ? `قم بصياغة رد بريد إلكتروني احترافي على رسالة "${item.subject}" الواردة من ${sender.name} (${sender.email})`
      : `Draft a professional email reply to "${item.subject}" from ${sender.name} (${sender.email})`;
    if (setInputText) {
      setInputText(prompt);
    }
  };

  const handleExpandAndFetchFull = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);

    if (!fullBodies[id] && accessToken) {
      setFullBodyLoading(id);
      try {
        const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const msgData = await res.json().catch(() => null);
          if (!msgData) return;
          let bodyText = "";
          if (msgData.payload?.parts) {
            const part = msgData.payload.parts.find((p: any) => p.mimeType === "text/plain") || msgData.payload.parts[0];
            if (part?.body?.data) {
              bodyText = atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/"));
            }
          } else if (msgData.payload?.body?.data) {
            bodyText = atob(msgData.payload.body.data.replace(/-/g, "+").replace(/_/g, "/"));
          }
          setFullBodies((prev) => ({ ...prev, [id]: bodyText || msgData.snippet || "لا يتوفر نص للرسالة" }));
        }
      } catch (e) {
        console.error("Failed to fetch full message body", e);
      } finally {
        setFullBodyLoading(null);
      }
    }
  };

  const filteredMessages = messages.filter((m) => {
    if (filterCategory === "all") return true;
    const cat = detectCategory(m.subject, m.from);
    return cat.label === filterCategory;
  });

  if (!messages || messages.length === 0) {
    return null;
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="w-full max-w-2xl my-3 rounded-2xl overflow-hidden border border-[#1e2e2e] bg-[#0c1414] shadow-[0_10px_35px_rgba(0,0,0,0.5)] font-sans text-start select-text transition-all"
    >
      {/* Executive Briefing Header */}
      <div className="p-3.5 sm:p-4 bg-gradient-to-r from-[#0f1d1d] via-[#102222] to-[#0f1d1d] border-b border-[#1e2e2e] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#ea4335]/15 border border-[#ea4335]/30 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(234,67,53,0.15)]">
            <Mail className="w-5 h-5 text-[#ea4335]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[#e8f5f5]">
                {isRtl ? "موجز البريد الوارد الذكي" : "Executive Inbox Briefing"}
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-extrabold bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 rounded-full">
                {messages.length} {isRtl ? "رسائل" : "Emails"}
              </span>
            </div>
            <p className="text-[11px] text-[#5c8a8a] mt-0.5 flex items-center gap-1.5 font-medium">
              <Sparkles className="w-3 h-3 text-[#00d4aa]" />
              {data.query
                ? (isRtl ? `نتائج البحث: "${data.query}"` : `Filtered by: "${data.query}"`)
                : (isRtl ? "أحدث الرسائل والتحديثات في بريدك" : "Latest updates from your connected Gmail")}
            </p>
          </div>
        </div>

        {/* Categories Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 shrink-0">
          <button
            type="button"
            onClick={() => setFilterCategory("all")}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
              filterCategory === "all"
                ? "bg-[#00d4aa] text-[#0c1414] shadow-[0_0_10px_rgba(0,212,170,0.3)]"
                : "bg-[#142020] text-[#7a9e9e] hover:text-[#e8f5f5] hover:bg-[#1a2b2b] border border-[#1e2e2e]"
            }`}
          >
            {isRtl ? "الكل" : "All"} ({messages.length})
          </button>
          {["أمان وحسابات", "ميزات وتحديثات", "فواتير وأعمال"].map((catName) => {
            const count = messages.filter((m) => detectCategory(m.subject, m.from).label === catName).length;
            if (count === 0) return null;
            return (
              <button
                key={catName}
                type="button"
                onClick={() => setFilterCategory(filterCategory === catName ? "all" : catName)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  filterCategory === catName
                    ? "bg-[#00d4aa] text-[#0c1414] shadow-[0_0_10px_rgba(0,212,170,0.3)]"
                    : "bg-[#142020] text-[#7a9e9e] hover:text-[#e8f5f5] hover:bg-[#1a2b2b] border border-[#1e2e2e]"
                }`}
              >
                {catName} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Email Cards List */}
      <div className="p-2.5 sm:p-3 space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar">
        {filteredMessages.map((msg, index) => {
          const sender = parseSender(msg.from);
          const category = detectCategory(msg.subject, msg.from);
          const CategoryIcon = category.icon;
          const formattedDate = formatEmailDate(msg.date, isRtl);
          const isExpanded = expandedId === msg.id;
          const initialChar = sender.name.charAt(0).toUpperCase() || "@";

          return (
            <div
              key={msg.id || index}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isExpanded
                  ? "bg-[#111e1e] border-[#00d4aa]/60 shadow-[0_4px_20px_rgba(0,212,170,0.1)]"
                  : "bg-[#0e1717] hover:bg-[#121c1c] border-[#1e2e2e] hover:border-[#2d4242]"
              }`}
            >
              {/* Card Main Row */}
              <div
                onClick={() => handleExpandAndFetchFull(msg.id)}
                className="p-3 sm:p-3.5 cursor-pointer flex items-start gap-3 select-none"
              >
                {/* Sender Avatar Badge */}
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1c2e2e] to-[#121e1e] border border-[#2d4242] flex items-center justify-center text-xs font-black text-[#00d4aa] shrink-0 shadow-inner">
                  {initialChar}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                  {/* Top Bar: Sender Name + Category Tag + Date */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-[#e8f5f5] truncate max-w-[150px] sm:max-w-[220px]">
                        {sender.name}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold rounded-md border ${category.bg} ${category.color} ${category.border}`}>
                        <CategoryIcon className="w-2.5 h-2.5" />
                        <span>{category.label}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-[#5c8a8a] font-medium shrink-0">
                      <Calendar className="w-3 h-3 text-[#4a7070]" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  {/* Subject Line */}
                  <h4 className="text-xs sm:text-[13px] font-semibold text-[#c8dede] leading-snug line-clamp-1 mb-1">
                    {msg.subject || (isRtl ? "بدون عنوان" : "No Subject")}
                  </h4>

                  {/* Snippet / AI Summary */}
                  <p className="text-[11px] text-[#7a9e9e] leading-relaxed line-clamp-2 font-normal">
                    {msg.snippet}
                  </p>
                </div>

                {/* Expand / Accordion Arrow */}
                <div className="p-1 rounded-md text-[#4a7070] hover:text-[#00d4aa] hover:bg-[#172525] transition-colors shrink-0 mt-0.5">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {/* Expanded Details Drawer */}
              {isExpanded && (
                <div className="px-3 sm:px-4 pb-3.5 pt-2 border-t border-[#1e2e2e]/70 bg-[#090f0f] animate-fadeIn">
                  {/* Meta Details */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#5c8a8a] pb-2 border-b border-[#1e2e2e]/50 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#7a9e9e]">{isRtl ? "المرسل:" : "From:"}</span>
                      <span className="text-[#a3c2c2] font-mono">{msg.from}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#7a9e9e]">{isRtl ? "التاريخ:" : "Date:"}</span>
                      <span className="text-[#a3c2c2]">{msg.date}</span>
                    </div>
                  </div>

                  {/* Message Body Content */}
                  <div className="space-y-1.5 mb-3">
                    <span className="text-[10px] font-bold text-[#00d4aa] uppercase tracking-wider flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {isRtl ? "محتوى الرسالة الكامل" : "Full Email Content"}
                    </span>

                    {fullBodyLoading === msg.id ? (
                      <div className="flex items-center justify-center gap-2 py-6 text-xs text-[#5c8a8a]">
                        <Loader2 className="w-4 h-4 animate-spin text-[#00d4aa]" />
                        <span>{isRtl ? "جاري قراءة نص الرسالة من بريدك..." : "Fetching full message body..."}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-[#c8dede] bg-[#0c1414] p-3 rounded-lg border border-[#1e2e2e] leading-relaxed max-h-[220px] overflow-y-auto custom-scrollbar whitespace-pre-wrap font-sans">
                        {fullBodies[msg.id] || msg.snippet}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCopySummary(msg)}
                      className="px-2.5 py-1.5 text-[11px] font-medium text-[#a3c2c2] hover:text-[#e8f5f5] bg-[#142020] hover:bg-[#1a2b2b] border border-[#1e2e2e] rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#00d4aa]" />
                          <span className="text-[#00d4aa]">{isRtl ? "تم النسخ" : "Copied"}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#5c8a8a]" />
                          <span>{isRtl ? "نسخ الملخص" : "Copy Brief"}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRequestReply(msg)}
                      className="px-3 py-1.5 text-[11px] font-bold text-[#0c1414] bg-[#00d4aa] hover:bg-[#00ffcc] rounded-lg transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,212,170,0.25)] cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#0c1414]" />
                      <span>{isRtl ? "صياغة رد ذكي" : "Draft AI Reply"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Status */}
      <div className="px-3.5 py-2 bg-[#090f0f] border-t border-[#1e2e2e]/50 flex items-center justify-between text-[10px] text-[#4a7070]">
        <div className="flex items-center gap-1">
          <Inbox className="w-3 h-3 text-[#00d4aa]" />
          <span>{isRtl ? "متصل بحساب Gmail الخاص بك بأمان" : "Securely synchronized via Google OAuth"}</span>
        </div>
        <span className="font-mono">
          {filteredMessages.length} / {messages.length} {isRtl ? "معروضة" : "displayed"}
        </span>
      </div>
    </div>
  );
}
