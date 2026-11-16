"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  LogOut,
  LogIn,
  Layers,
  Trash2,
  Globe,
  Compass,
  Settings,
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Send,
  Search,
  MessageCircle,
  Film,
  Clapperboard,
  Sparkles
} from "lucide-react";
import { isUserAdmin } from "@/lib/auth/adminRoles";
import { UserDashboardModal } from "@/components/ui/UserDashboardModal";
import { useChatStore } from "@/store/chatStore";
import { authClient } from "@/lib/auth/authClient";
import { SoufToolsLogo } from "@/components/ui/Logos";
import {
  SoufChatPlusIcon,
  SoufBotIcon,
  SoufHistoryIcon,
  SoufBrainIcon,
  SoufAdminIcon
} from "@/components/ui/BrandIcons";
import { SoufAIIcon } from "@/components/icons/SoufIcons";
import { setAuthCookie, removeAuthCookie, getAuthCookie } from "@/lib/authCookies";
import { performCompleteSignOut } from "@/lib/auth/unifiedAuth";
import { bootstrapCloudSync } from "@/lib/sync/cloudSyncClient";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { isRtlLocale } from "@/lib/i18n";
import { getWorkspaceStrings } from "@/lib/i18n/multilingualStrings";

interface SidebarProps {
  locale: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ locale }) => {
  const pathname = usePathname();
  const router = useRouter();
  const isRtl = isRtlLocale(locale);
  const ws = getWorkspaceStrings(locale);

  const {
    sessions,
    activeSessionId,
    createNewSession,
    setActiveSession,
    deleteSession,
    userEmail,
    setUserEmail,
    setUserId,
    setSessions,
    isAdmin,
    sidebarOpen,
    setSidebarOpen,
    currentModel,
    isDashboardOpen,
    setIsDashboardOpen,
    dashboardTab,
    setDashboardTab,
  } = useChatStore();

  const [chatFilter, setChatFilter] = React.useState<"all" | "web" | "telegram">("all");
  const [chatSearchQuery, setChatSearchQuery] = React.useState("");

  const filteredSessions = React.useMemo(() => {
    return (sessions || []).filter((s) => {
      const isTg = Boolean(s.isTelegram || s.source === "telegram" || s.id.startsWith("tg_"));
      if (chatFilter === "telegram" && !isTg) return false;
      if (chatFilter === "web" && isTg) return false;
      if (chatSearchQuery.trim()) {
        const q = chatSearchQuery.toLowerCase();
        const matchTitle = (s.title || "").toLowerCase().includes(q);
        const matchUser = (s.telegramUsername || s.telegramSender || "").toLowerCase().includes(q);
        return matchTitle || matchUser;
      }
      return true;
    });
  }, [sessions, chatFilter, chatSearchQuery]);

  const telegramCount = React.useMemo(() => {
    return (sessions || []).filter((s) => Boolean(s.isTelegram || s.source === "telegram" || s.id.startsWith("tg_"))).length;
  }, [sessions]);

  const isRealUserEmail = Boolean(
    userEmail &&
    userEmail.includes("@") &&
    !userEmail.endsWith("@souftools.app") &&
    !userEmail.endsWith("@souftools.internal") &&
    !userEmail.startsWith("usr_guest_") &&
    !userEmail.startsWith("guest_user@") &&
    userEmail !== "default_user"
  );

  const isEffectiveAdmin =
    isAdmin ||
    (isRealUserEmail && isUserAdmin(userEmail)) ||
    ["toolssouf@gmail.com", "souftoolsheb@gmail.com"].includes(
      (userEmail || "").toLowerCase().trim()
    );

  React.useEffect(() => {
    // If user explicitly signed out, do not restore session
    if (typeof window !== "undefined" && sessionStorage.getItem("souftools_just_logged_out") === "true") {
      return;
    }

    // 1. Check local session across storage/cookie
    const cookieData = getAuthCookie();
    const storeEmail = useChatStore.getState().userEmail;
    const activeEmail = cookieData?.email || storeEmail;
    const activeUid = cookieData?.userId || useChatStore.getState().userId;

    const isGuest = !activeEmail || 
      activeEmail.startsWith("usr_guest_") || 
      activeEmail.startsWith("guest_user@") || 
      activeEmail.endsWith("@souftools.app") ||
      activeEmail.endsWith("@souftools.internal") ||
      activeEmail === "user@ocean.ai" || 
      activeEmail === "default_user";

    if (activeEmail && !isGuest && !userEmail) {
      setUserEmail(activeEmail);
      if (activeUid) setUserId(activeUid);
      if (isUserAdmin(activeEmail)) {
        useChatStore.getState().setIsAdmin(true);
      }
    } else if (isGuest && activeEmail) {
      removeAuthCookie();
      setUserEmail(null);
      setUserId(null);
    }

    if (isRealUserEmail && isUserAdmin(activeEmail || userEmail)) {
      useChatStore.getState().setIsAdmin(true);
    }

    // 2. Load Better Auth session if present
    authClient.getSession().then((session) => {
      if (typeof window !== "undefined" && sessionStorage.getItem("souftools_just_logged_out") === "true") {
        return;
      }
      if (session?.data?.user?.email) {
        const sessionEmail = session.data.user.email;
        if (
          !sessionEmail.startsWith("usr_guest_") &&
          !sessionEmail.startsWith("guest_user@") &&
          !sessionEmail.endsWith("@souftools.app") &&
          !sessionEmail.endsWith("@souftools.internal")
        ) {
          setUserEmail(sessionEmail);
          setUserId(session.data.user.id);
          setAuthCookie(sessionEmail, session.data.user.id);
          if (isUserAdmin(sessionEmail)) {
            useChatStore.getState().setIsAdmin(true);
          }
        }
      }
    }).catch(() => {});

    // 3. Bootstrap user state & real-time sync from PostgreSQL backend
    const currentUid = (!isGuest && activeEmail) || activeUid;
    if (currentUid && !isGuest) {
      bootstrapCloudSync().catch(() => {});
    }
  }, [setUserEmail, setUserId, setSessions, userEmail, isRealUserEmail]);

  const handleLogout = async () => {
    await performCompleteSignOut(locale);
  };

  const handleNewChat = () => {
    const id = createNewSession();
    router.push(`/${locale}/chat`);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleSelectSession = (id: string) => {
    setActiveSession(id);
    router.push(`/${locale}/chat`);
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  // Prefetch critical application routes safely after initial page load settles
  React.useEffect(() => {
    const timer = setTimeout(() => {
      try {
        router.prefetch(`/${locale}/chat`);
      } catch {}
    }, 1500);

    return () => clearTimeout(timer);
  }, [router, locale]);

  const renderSidebarContent = () => (
    <div className="flex flex-col justify-between h-full w-full">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between pb-3.5 border-b border-[#1e2e2e]">
          <Link
            href={`/${locale}/launch`}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <SoufToolsLogo size={28} />
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-[#e8f5f5] via-[#00d4aa] to-[#00f5c4] bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">
                SoufTools
              </span>
            </div>
          </Link>

          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-[#4a7070] hover:text-[#e8f5f5] hover:bg-[#111a1a] transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Button: New Chat */}
        <div className="mt-3.5">
          <button
            onClick={handleNewChat}
            className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00f5c4] hover:from-[#00b894] hover:to-[#00d4aa] text-[#0a0f0f] font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,212,170,0.25)] hover:shadow-[0_0_25px_rgba(0,212,170,0.4)] active:scale-[0.99] cursor-pointer"
          >
            <SoufChatPlusIcon size={16} />
            <span>{ws.newChat}</span>
          </button>
        </div>

        {/* Navigation Section */}
        <div className="mt-4 space-y-1">
          <Link
            href={`/${locale}/launch`}
            onClick={() => {
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              pathname.endsWith("/launch")
                ? "bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 shadow-sm"
                : "text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#12161f]"
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>{ws.launch}</span>
          </Link>

          {/* Media Cinema Library Navigation Button */}
          <Link
            href={`/${locale}/library`}
            onClick={() => {
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${
              pathname.includes("/library")
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                : "text-[#94a3b8] hover:text-purple-300 hover:bg-purple-950/20 border border-transparent hover:border-purple-500/30"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Film className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
              <span>{isRtl ? "مكتبتي السينمائية (Library)" : "Media Library"}</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30 flex items-center gap-1">
              <Clapperboard className="w-2.5 h-2.5" />
              <span>{isRtl ? "أفلامي" : "Films"}</span>
            </span>
          </Link>

          {/* Direct Admin Dashboard Navigation Button */}
          {isEffectiveAdmin && (
            <Link
              href={`/${locale}/admin`}
              onClick={() => {
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all group ${
                pathname.includes("/admin")
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                  : "bg-amber-500/10 text-amber-400 hover:text-amber-200 hover:bg-amber-500/20 border border-amber-500/25"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>{isRtl ? "لوحة تحكم المسؤول (Admin)" : "Admin Dashboard"}</span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
                ADMIN
              </span>
            </Link>
          )}
        </div>

        {/* Scrollable Conversation History Section */}
        <div className="mt-4 pt-3 border-t border-[#1f2633]/70 flex flex-col min-h-0 max-h-[38vh] sm:max-h-[42vh]">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#00d4aa]" />
              <span className="text-xs font-semibold text-[#94a3b8]">
                {isRtl ? "سجل المحادثات" : "Chat History"}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#161b26] text-[#64748b] font-mono">
                {sessions.length}
              </span>
            </div>
            {telegramCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium flex items-center gap-1">
                <Send className="w-2.5 h-2.5" />
                <span>{telegramCount}</span>
              </span>
            )}
          </div>

          {/* Filter Chips: All, Web, Telegram, My Library */}
          <div className="flex items-center gap-1 mb-2 px-0.5 overflow-x-auto custom-scrollbar pb-0.5">
            <button
              type="button"
              onClick={() => setChatFilter("all")}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all shrink-0 ${
                chatFilter === "all"
                  ? "bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/30 shadow-sm"
                  : "text-[#64748b] hover:text-[#f1f5f9] bg-[#12161f]/60 hover:bg-[#12161f]"
              }`}
            >
              {isRtl ? "الكل" : "All"}
            </button>
            <button
              type="button"
              onClick={() => setChatFilter("web")}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all shrink-0 ${
                chatFilter === "web"
                  ? "bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/30 shadow-sm"
                  : "text-[#64748b] hover:text-[#f1f5f9] bg-[#12161f]/60 hover:bg-[#12161f]"
              }`}
            >
              {isRtl ? "الويب" : "Web"}
            </button>
            <button
              type="button"
              onClick={() => setChatFilter("telegram")}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all shrink-0 ${
                chatFilter === "telegram"
                  ? "bg-sky-500/25 text-sky-300 border border-sky-500/40 shadow-sm shadow-sky-500/20"
                  : "text-[#64748b] hover:text-sky-300 bg-[#12161f]/60 hover:bg-sky-950/20"
              }`}
            >
              <Send className="w-2.5 h-2.5 text-sky-400" />
              <span>{isRtl ? "تيليجرام" : "Telegram"}</span>
              {telegramCount > 0 && (
                <span className="text-[9px] px-1 py-0.2 rounded-full bg-sky-500/30 text-sky-200 font-mono">
                  {telegramCount}
                </span>
              )}
            </button>
            <Link
              href={`/${locale}/library`}
              onClick={() => {
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all shrink-0 ${
                pathname.includes("/library")
                  ? "bg-purple-500/30 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-500/30"
                  : "text-[#94a3b8] hover:text-purple-300 bg-[#12161f]/60 hover:bg-purple-950/25 border border-purple-500/20"
              }`}
              title={isRtl ? "فتح صفحة مكتبتي وسجل مشاهدة الأفلام" : "Open My Media Library"}
            >
              <Film className="w-2.5 h-2.5 text-purple-400" />
              <span>{isRtl ? "مكتبتي" : "Library"}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            </Link>
          </div>

          {/* Search bar when history is growing */}
          {sessions.length > 4 && (
            <div className="relative mb-2 px-0.5">
              <Search className={`w-3 h-3 absolute top-2.5 text-[#64748b] ${isRtl ? "right-2.5" : "left-2.5"}`} />
              <input
                type="text"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                placeholder={isRtl ? "بحث في المحادثات..." : "Search chats..."}
                className={`w-full py-1 text-xs bg-[#12161f]/80 border border-[#1f2633] rounded-lg text-[#f1f5f9] placeholder-[#64748b] focus:outline-none focus:border-[#00d4aa]/50 transition-colors ${
                  isRtl ? "pr-7 pl-2" : "pl-7 pr-2"
                }`}
              />
            </div>
          )}

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {filteredSessions.length === 0 ? (
              <div className="py-4 text-center px-2">
                <p className="text-[11px] text-[#64748b]">
                  {chatFilter === "telegram"
                    ? (isRtl ? "لا توجد رسائل تيليجرام بعد" : "No Telegram messages yet")
                    : (isRtl ? "لا توجد محادثات سابقة" : "No previous conversations")}
                </p>
                {chatFilter === "telegram" && (
                  <p className="text-[10px] text-[#64748b] mt-1">
                    {isRtl ? "أرسل رسالة لبوت تيليجرام لتظهر هنا فوراً" : "Send a message to your bot to see it here"}
                  </p>
                )}
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isActive = session.id === activeSessionId;
                const isTg = Boolean(
                  session.isTelegram ||
                  session.source === "telegram" ||
                  session.id.startsWith("tg_")
                );

                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`group relative flex items-center justify-between p-2 rounded-xl text-xs transition-all cursor-pointer border ${
                      isActive
                        ? isTg
                          ? "bg-sky-950/30 text-sky-200 border-sky-500/40 shadow-sm shadow-sky-500/10"
                          : "bg-[#00d4aa]/15 text-[#00d4aa] border-[#00d4aa]/35 shadow-sm shadow-[#00d4aa]/10"
                        : isTg
                        ? "text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-sky-950/20 border-sky-900/20 hover:border-sky-500/30"
                        : "text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#12161f] border-transparent hover:border-[#1f2633]"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-1">
                      {isTg ? (
                        <div className="w-5 h-5 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
                          <Send className="w-3 h-3" />
                        </div>
                      ) : (
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      )}
                      <div className="flex flex-col truncate">
                        <span className="truncate font-medium leading-tight">
                          {session.title || (isRtl ? "محادثة جديدة" : "New Chat")}
                        </span>
                        {isTg && (session.telegramSender || session.telegramUsername) && (
                          <span className="text-[9px] text-sky-400/80 truncate">
                            {session.telegramUsername ? `@${session.telegramUsername}` : session.telegramSender}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isTg && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">
                          TG
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-[#557575] hover:text-red-400 hover:bg-red-950/30 transition-all"
                        title={isRtl ? "حذف المحادثة" : "Delete chat"}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom User Area */}
      <div className="pt-3 border-t border-[#1e2e2e] space-y-2">
        {isRealUserEmail ? (
          <div className="p-2.5 rounded-xl bg-[#111a1a]/90 border border-[#1e2e2e] flex items-center justify-between">
            <div className="flex flex-col truncate pr-2">
              <span className="text-xs text-[#e8f5f5] font-medium truncate">
                {userEmail}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-[#00d4aa] font-mono">
                  {isEffectiveAdmin ? "System Administrator" : "Active Member"}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-[#4a7070] hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer shrink-0"
              title={ws.logout}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href={`/${locale}/login`}
            className="w-full py-2 px-3 rounded-xl bg-[#111a1a] hover:bg-[#162222] border border-[#00d4aa]/30 text-[#00d4aa] text-xs font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{ws.login}</span>
          </Link>
        )}

        {/* Language selector container */}
        <div className="flex items-center justify-between text-[11px] text-[#64748b] px-2 py-1 bg-[#0e121a] rounded-lg border border-[#1f2633]/50">
          <span className="flex items-center gap-1.5 font-medium">
            <Globe className="w-3.5 h-3.5 text-[#00d4aa]" />
            {ws.selectLanguage}:
          </span>
          <LanguageSwitcher locale={locale} />
        </div>

        {/* User Dashboard & Settings Gear Button */}
        <Link
          href={`/${locale}/settings`}
          className="w-full p-2.5 rounded-2xl bg-[#12161f] hover:bg-[#161b26] border border-[#1f2633] hover:border-[#00d4aa]/50 transition-all flex items-center justify-between group cursor-pointer shadow-md shadow-black/20 text-start"
          title={isRtl ? "لوحة الإعدادات والتحكم المركزية" : "Settings & Control Center"}
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00d4aa]/20 to-[#38bdf8]/20 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa] group-hover:rotate-45 transition-transform duration-300 shrink-0">
              <Settings className="w-4 h-4" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold text-[#f1f5f9] group-hover:text-[#00d4aa] transition-colors truncate">
                {isRtl ? "لوحة الإعدادات والتحكم" : "Settings & Control"}
              </span>
              <span className="text-[10px] text-[#64748b] truncate flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00d4aa] inline-block animate-pulse shrink-0" />
                <span className="truncate">{isRtl ? "واجهة التحكم المركزية" : "Full Control Center"}</span>
              </span>
            </div>
          </div>

          <div className="p-1 rounded-lg bg-[#0a0c10] border border-[#1f2633] text-[#94a3b8] group-hover:text-[#00d4aa] transition-colors shrink-0">
            {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Drawer Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          x: sidebarOpen ? 0 : isRtl ? "100%" : "-100%",
        }}
        transition={{ type: "spring", stiffness: 350, damping: 35 }}
        className={`fixed top-0 bottom-0 ${
          isRtl ? "right-0 border-l" : "left-0 border-r"
        } w-72 bg-[#0a0c10]/98 border-[#1f2633] backdrop-blur-2xl z-50 p-4 shadow-2xl lg:hidden h-screen`}
      >
        {renderSidebarContent()}
      </motion.aside>

      {/* Desktop Persistent / Collapsible Smooth Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: sidebarOpen ? "18rem" : "0rem",
          opacity: sidebarOpen ? 1 : 0,
        }}
        transition={{ duration: 0.28, ease: [0.2, 0, 0, 1] }}
        className={`hidden lg:flex flex-col h-screen bg-[#0a0c10]/98 backdrop-blur-2xl z-30 shrink-0 overflow-hidden relative ${
          sidebarOpen ? (isRtl ? "border-l border-[#1f2633] p-4" : "border-r border-[#1f2633] p-4") : "border-0 p-0 pointer-events-none"
        }`}
      >
        <div className="w-[16rem] min-w-[16rem] h-full flex flex-col justify-between">
          {renderSidebarContent()}
        </div>
      </motion.aside>

      {/* User Dashboard & Settings Modal */}
      <UserDashboardModal
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
        locale={locale}
        initialTab={dashboardTab}
      />
    </>
  );
};
