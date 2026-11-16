"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { useChatStore } from "@/store/chatStore";
import { ShieldCheck, Lock, LogIn, Menu, MessageSquare } from "lucide-react";
import {
  SoufKeyIcon,
  SoufSparklesIcon,
  SoufBotIcon,
  SoufStatsIcon,
  SoufToolsSuiteIcon,
  SoufCodeIcon,
  SoufGlobeIcon
} from "@/components/ui/BrandIcons";
import { SoufVisionLogo } from "@/components/ui/Logos";
import dynamic from "next/dynamic";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { isRtlLocale } from "@/lib/i18n";
import { ensureServerSession, isServerAdminSession } from "@/lib/auth/serverSessionClient";

// Dynamic Code-Split Admin Tab Panels for ultra-fast load
const KeysManager = dynamic(() => import("@/components/admin/KeysManager").then((m) => m.KeysManager), { ssr: false });
const AdminToolsPage = dynamic(() => import("./tools/page"), { ssr: false });
const AgentPanel = dynamic(() => import("@/components/admin/AgentPanel").then((m) => m.AgentPanel), { ssr: false });
const StatsPanel = dynamic(() => import("@/components/admin/StatsPanel").then((m) => m.StatsPanel), { ssr: false });
const RuntimeManager = dynamic(() => import("@/components/admin/RuntimeManager").then((m) => m.RuntimeManager), { ssr: false });
const VisionProvidersPanel = dynamic(() => import("@/components/admin/VisionProvidersPanel").then((m) => m.VisionProvidersPanel), { ssr: false });
const EfficiencyManagerPanel = dynamic(() => import("@/components/admin/EfficiencyManagerPanel").then((m) => m.EfficiencyManagerPanel), { ssr: false });
const SeoDashboardPanel = dynamic(() => import("@/components/admin/SeoDashboardPanel").then((m) => m.SeoDashboardPanel), { ssr: false });
const LanguageCenterPanel = dynamic(() => import("@/components/admin/LanguageCenterPanel").then((m) => m.LanguageCenterPanel), { ssr: false });
const WhatsAppGatewayPanel = dynamic(() => import("@/components/admin/WhatsAppGatewayPanel").then((m) => m.WhatsAppGatewayPanel), { ssr: false });
const ErrorDiagnosticsPanel = dynamic(() => import("@/components/admin/ErrorDiagnosticsPanel").then((m) => m.ErrorDiagnosticsPanel), { ssr: false });
import { AlertOctagon } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const routerParams = useParams();
  const locale = (routerParams?.locale as string) || "ar";
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { userEmail, setUserEmail, setUserId, setIsAdmin, sidebarOpen, setSidebarOpen } = useChatStore();

  const getTabFromPath = (path?: string) => {
    if (!path) return "keys";
    if (path.includes("/errors")) return "errors";
    if (path.includes("/seo")) return "seo";
    if (path.includes("/efficiency")) return "efficiency";
    if (path.includes("/vision")) return "vision";
    if (path.includes("/runtime")) return "runtime";
    if (path.includes("/tools")) return "tools";
    if (path.includes("/agent")) return "agent";
    if (path.includes("/whatsapp")) return "whatsapp";
    if (path.includes("/stats")) return "stats";
    if (path.includes("/languages")) return "languages";
    return "keys";
  };

  const [activeTab, setActiveTab] = useState(() => getTabFromPath(pathname));
  const [mounted, setMounted] = useState(false);
  const [adminAuthStatus, setAdminAuthStatus] = useState<"checking" | "authorized" | "unauthorized" | "error">("checking");
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathname) {
      setActiveTab(getTabFromPath(pathname));
    }
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const verifyAdminSession = async () => {
      try {
        const session = await ensureServerSession();
        if (cancelled) return;

        if (!isServerAdminSession(session)) {
          setAdminAuthStatus("unauthorized");
          return;
        }

        const user = session.user;
        setUserEmail(user.email);
        setUserId(user.id);
        setIsAdmin(true);
        setAdminAuthStatus("authorized");
      } catch (error) {
        console.error("Failed to verify admin session:", error);
        if (!cancelled) setAdminAuthStatus("error");
      }
    };

    void verifyAdminSession();
    return () => {
      cancelled = true;
    };
  }, [authCheckAttempt, setIsAdmin, setUserEmail, setUserId]);

  useEffect(() => {
    const handlePopState = () => {
      const path = typeof window !== "undefined" ? window.location.pathname : "";
      setActiveTab(getTabFromPath(path));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleTabClick = (tabId: string, path: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", path);
    }
  };

  const isRtl = isRtlLocale(locale);

  const tabs = [
    { id: "keys", label: isRtl ? "مفاتيح AI" : "AI Keys", icon: SoufKeyIcon, path: `/${locale}/admin/keys` },
    { id: "errors", label: isRtl ? "تشخيص وأخطاء السيرفر" : "Error Diagnostics", icon: AlertOctagon, path: `/${locale}/admin/errors` },
    { id: "efficiency", label: isRtl ? "إدارة الكفاءة" : "AI Efficiency", icon: SoufSparklesIcon, path: `/${locale}/admin/efficiency` },
    { id: "vision", label: isRtl ? "مزودي الرؤية" : "Vision AI", icon: SoufVisionLogo, path: `/${locale}/admin/vision` },
    { id: "runtime", label: isRtl ? "نظام Sandbox" : "Sandbox Engine", icon: SoufCodeIcon, path: `/${locale}/admin/runtime` },
    { id: "seo", label: isRtl ? "لوحة SEO" : "SEO Manager", icon: SoufGlobeIcon, path: `/${locale}/admin/seo` },
    { id: "tools", label: isRtl ? "الأدوات" : "Tools", icon: SoufToolsSuiteIcon, path: `/${locale}/admin/tools` },
    { id: "agent", label: isRtl ? "الوكيل Nodaba" : "Agent Nodaba", icon: SoufBotIcon, path: `/${locale}/admin/agent` },
    { id: "whatsapp", label: isRtl ? "ربط واتساب والوكيل (WhatsApp & Gmail)" : "Agent WhatsApp & Gmail", icon: MessageSquare, path: `/${locale}/admin/whatsapp` },
    { id: "stats", label: isRtl ? "الإحصائيات" : "Analytics", icon: SoufStatsIcon, path: `/${locale}/admin/stats` },
    { id: "languages", label: isRtl ? "مركز اللغات" : "Language Center", icon: SoufGlobeIcon, path: `/${locale}/admin/languages` },
  ];

  const isAuthorizedAdmin = adminAuthStatus === "authorized";

  // Protected Admin Gate
  if (adminAuthStatus === "checking") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0f0f] text-[#6e9999]" role="status" aria-live="polite">
        <div className="flex items-center gap-3 text-sm">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#1f2633] border-t-[#00d4aa]" />
          <span>{isRtl ? "جارٍ التحقق من جلسة المسؤول..." : "Verifying administrator session..."}</span>
        </div>
      </div>
    );
  }

  if (adminAuthStatus === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0f0f] p-6 text-center text-[#e8f5f5]">
        <div className="glass-card w-full max-w-md space-y-5 rounded-3xl p-8">
          <h2 className="text-xl font-bold">
            {isRtl ? "تعذر التحقق من جلسة المسؤول" : "Could not verify administrator session"}
          </h2>
          <p className="text-xs leading-relaxed text-[#6e9999]">
            {isRtl
              ? "تعذر الاتصال بخدمة المصادقة. تحقق من اتصال الخادم ثم أعد المحاولة."
              : "The authentication service could not be reached. Check the server connection and try again."}
          </p>
          <button
            type="button"
            onClick={() => setAuthCheckAttempt((attempt) => attempt + 1)}
            className="rounded-xl bg-[#00d4aa] px-5 py-3 text-xs font-bold text-[#0a0f0f]"
          >
            {isRtl ? "إعادة المحاولة" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthorizedAdmin) {
    return (
      <div className="flex h-screen bg-[#0a0f0f] items-center justify-center p-6 text-center">
        <div className="glass-card max-w-md w-full p-8 rounded-3xl border border-red-500/30 space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#e8f5f5]">
              {isRtl ? "لوحة الإدارة والتحكم محمية" : "Admin Control Panel Protected"}
            </h2>
            <p className="text-xs text-[#6e9999] mt-2 leading-relaxed">
              {isRtl
                ? "هذه الصفحة مخصصة لحسابات مسؤولي النظام فقط وتتطلب مصادقة أمنية موثقة. يرجى تسجيل الدخول عبر البوابة الرسمية للمتابعة."
                : "This panel is strictly restricted to system administrators. Please authenticate through the official login gateway to proceed."}
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 text-right leading-relaxed">
              {loginError}
            </div>
          )}

          <div className="pt-2 space-y-3">
            <Link
              href={`/${locale}/login?redirect=admin`}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] hover:from-[#00b894] hover:to-[#0284c7] text-[#0a0f0f] font-bold text-xs shadow-lg shadow-[#00d4aa]/25 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4 text-[#0a0f0f]" />
              <span>{isRtl ? "تسجيل الدخول عبر البوابة الرسمية" : "Sign In via Official Gateway"}</span>
            </Link>

            <Link
              href={`/${locale}`}
              className="block text-xs text-[#4a7070] hover:text-[#e8f5f5] transition-colors pt-2 text-center"
            >
              {isRtl ? "العودة للصفحة الرئيسية" : "Return to Home"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0f0f] overflow-hidden">
      <Sidebar locale={locale} />

      <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0a0f0f] p-3.5 sm:p-6 space-y-4 sm:space-y-6">
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-[#1e2e2e] flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl bg-[#111a1a] hover:bg-[#1e2e2e] text-[#4a7070] hover:text-[#00ff88] border border-[#1e2e2e] transition-colors shrink-0 cursor-pointer"
                title={isRtl ? "فتح القائمة" : "Open Menu"}
                aria-label="Toggle menu"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#00ff88]/20 border border-[#00ff88]/40 flex items-center justify-center text-[#00ff88] shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xs sm:text-base font-bold text-[#e8f5f5] whitespace-nowrap">
                    <span className="hidden sm:inline">{isRtl ? "لوحة تحكم SoufTools الإدارية" : "SoufTools Admin Control Center"}</span>
                    <span className="sm:hidden">{isRtl ? "لوحة التحكم" : "Admin"}</span>
                  </h1>
                  {userEmail && (
                    <span className="text-[10px] bg-[#00ff88]/20 text-[#00ff88] px-2 py-0.5 rounded-full border border-[#00ff88]/40 font-mono truncate max-w-[110px] sm:max-w-[240px]">
                      {userEmail}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] text-[#6b9999] hidden sm:block truncate mt-0.5">
                  {isRtl ? "التحكم في 40+ مزود، الأدوات والوكيل الذكي سوف" : "Manage 40+ providers, tools & Agent Souf"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <LanguageSwitcher locale={locale} />

              <Link
                href={`/${locale}/chat`}
                prefetch={true}
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-[#00d4aa]/15 text-[#00d4aa] hover:bg-[#00d4aa] hover:text-[#0a0f0f] border border-[#00d4aa]/30 font-bold text-xs transition-all flex items-center gap-1.5 sm:gap-2 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden xs:inline">{isRtl ? "الدردشة الحية" : "Live Chat"}</span>
                <span className="xs:hidden">{isRtl ? "دردشة" : "Chat"}</span>
              </Link>
            </div>
          </div>

          <div className="w-full overflow-x-auto no-scrollbar scroll-smooth py-0.5">
            <div className="flex items-center gap-1 sm:gap-1.5 bg-[#111a1a] p-1 sm:p-1.5 rounded-xl border border-[#1e2e2e] w-max min-w-full">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id, tab.path)}
                    className={`px-3 py-2 sm:px-3.5 sm:py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 select-none ${
                      isActive
                        ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/25 font-extrabold"
                        : "text-[#6b9999] hover:text-[#e8f5f5] hover:bg-[#1e2e2e]/60"
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1">
          {!mounted ? (
            children
          ) : (
            <div className="animate-fade-in duration-200">
              {activeTab === "keys" && <KeysManager />}
              {activeTab === "errors" && <ErrorDiagnosticsPanel />}
              {activeTab === "efficiency" && <EfficiencyManagerPanel />}
              {activeTab === "vision" && <VisionProvidersPanel />}
              {activeTab === "runtime" && <RuntimeManager />}
              {activeTab === "seo" && <SeoDashboardPanel />}
              {activeTab === "tools" && <AdminToolsPage />}
              {activeTab === "agent" && <AgentPanel />}
              {activeTab === "whatsapp" && <WhatsAppGatewayPanel />}
              {activeTab === "stats" && <StatsPanel />}
              {activeTab === "languages" && <LanguageCenterPanel />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
