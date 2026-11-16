"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { useChatStore } from "@/store/chatStore";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { History, Search, Trash2, MessageSquare, ArrowLeft, ArrowRight, Clock, Bot } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { isRtlLocale } from "@/lib/i18n";

export default function HistoryPage() {
  const routerParams = useParams();
  const locale = (routerParams?.locale as string) || "ar";
  const [search, setSearch] = useState("");
  const router = useRouter();

  const { sessions, deleteSession, setActiveSession, sidebarOpen, setSidebarOpen } = useChatStore();
  const isRtl = isRtlLocale(locale);

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectSession = (id: string) => {
    setActiveSession(id);
    router.push(`/${locale}/chat`);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0f0f] overflow-hidden">
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "سجل المحادثات والأرشيف الذكي" : "Conversation History & Archive"}
        subtitle={isRtl ? "جلسات المحادثة المحفوظة والمشفرة" : "Saved & encrypted chat sessions"}
        icon={<History className="w-4 h-4 text-[#0ea5e9]" />}
        backHref={`/${locale}/chat`}
        backLabel={isRtl ? "العودة للدردشة" : "Back to Chat"}
        activeKey="history"
        actions={<LanguageSwitcher locale={locale} />}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar locale={locale} />

        <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0a0f0f] p-4 sm:p-6 space-y-6">
          {/* Header Description */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 sm:p-5 rounded-2xl border border-[#1e2e2e]">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#e8f5f5] flex items-center gap-2">
                <History className="w-5 h-5 text-[#0ea5e9]" />
                {isRtl ? "سجل المحادثات السابقة" : "Chat History"}
              </h2>
              <p className="text-xs text-[#88b0b0] mt-1">
                {isRtl ? "عرض ووصول سريع لكافة جلسات المحادثة المخزنة بآمان" : "View and access all your saved conversation sessions"}
              </p>
            </div>

            <div className="flex items-center gap-3 self-start">
              <Link
                href={`/${locale}/chat`}
                className="px-4 py-2.5 bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#0a0f0f] rounded-xl text-xs font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-md shadow-[#00d4aa]/20"
              >
                <MessageSquare className="w-4 h-4" />
                <span>{isRtl ? "الدردشة الحية" : "Live Chat"}</span>
              </Link>
            </div>
          </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-[#4a7070]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRtl ? "ابحث في عناوين المحادثات السابقة..." : "Search in past conversation titles..."}
            className="w-full bg-[#111a1a] text-xs text-[#e8f5f5] placeholder-[#4a7070] pr-10 pl-4 py-3 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none transition-all"
          />
        </div>

        {/* Sessions List Grid */}
        {filteredSessions.length === 0 ? (
          <div className="text-center py-20 text-[#4a7070] space-y-3">
            <Clock className="w-10 h-10 mx-auto text-[#1e2e2e]" />
            <p className="text-sm font-medium">{isRtl ? "لا توجد محادثات سابقة مطابقة للبحث" : "No past conversations match your query"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className="glass-card p-4 rounded-2xl border border-[#1e2e2e] hover:border-[#00d4aa] transition-all cursor-pointer flex flex-col justify-between group hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-[#1e2e2e] mb-3">
                    <span className="text-xs font-bold text-[#e8f5f5] group-hover:text-[#00d4aa] transition-colors truncate max-w-[180px]">
                      {session.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="p-1 text-[#4a7070] hover:text-red-400 rounded transition-colors"
                      title={isRtl ? "حذف المحادثة" : "Delete session"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-[11px] text-[#4a7070] line-clamp-2">
                    {session.messages[0]?.content || (isRtl ? "محادثة فارغة" : "Empty conversation")}
                  </p>
                </div>

                <div className="mt-4 pt-2 border-t border-[#1e2e2e] flex items-center justify-between text-[10px] text-[#4a7070]">
                  <span>{new Date(session.updatedAt).toLocaleDateString(locale)}</span>
                  <span className="bg-[#111a1a] px-2 py-0.5 rounded text-[#00d4aa] font-mono border border-[#1e2e2e]">
                    {session.messages.length} {isRtl ? "رسائل" : "messages"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
