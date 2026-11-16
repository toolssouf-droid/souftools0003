"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Zap,
  Globe,
  GitBranch,
  Crown,
  Sun,
  Moon,
  MessageSquare,
  PlusCircle,
  Loader2,
  Cpu,
  Home,
  Wrench,
  Menu,
  X,
  Settings,
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { ParticleBackground } from "@/components/ui/ParticleBackground";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/chatStore";
import { getAuthCookie } from "@/lib/authCookies";
import { auth } from "@/lib/firebase";
import { isRtlLocale } from "@/lib/i18n";
import { SoufBehaviorEngine } from "@/lib/behavior/behaviorEngine";

interface HomePageClientProps {
  locale: string;
}

export function HomePageClient({ locale }: HomePageClientProps) {
  const router = useRouter();
  const { userEmail } = useChatStore();
  const isRtl = isRtlLocale(locale);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Prefetch routes for instant navigation
  React.useEffect(() => {
    router.prefetch(`/${locale}/chat`);
    router.prefetch(`/${locale}/models`);
    router.prefetch(`/${locale}/pricing`);
    router.prefetch(`/${locale}/tools`);
    router.prefetch(`/${locale}/settings`);
  }, [router, locale]);

  const handleStartChat = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setIsNavigating(true);

    const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
    const storeEmail = useChatStore.getState().userEmail;
    const rawEmail = userEmail || storeEmail || cookieData?.email || auth?.currentUser?.email;
    const isGuest = !rawEmail || 
      rawEmail.startsWith("usr_guest_") || 
      rawEmail.startsWith("guest_user@") || 
      rawEmail === "user@ocean.ai" || 
      rawEmail === "default_user";
    const isAuthenticated = !!(rawEmail && !isGuest);

    const prof = SoufBehaviorEngine.getProfile();
    const targetPath = isAuthenticated
      ? prof.preferredEntry === "chat"
        ? `/${locale}/chat`
        : `/${locale}/launch`
      : `/${locale}/login?redirect=chat`;

    router.push(targetPath);
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#f1f5f9] relative overflow-x-hidden flex flex-col justify-between selection:bg-[#00d4aa]/30 font-sans">
      {/* Background Particles & Glow Effects */}
      <ParticleBackground />

      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00d4aa]/12 rounded-full blur-[140px] pointer-events-none -z-0" />
      <div className="absolute top-1/3 left-0 w-96 h-96 bg-[#38bdf8]/10 rounded-full blur-[140px] pointer-events-none -z-0" />

      {/* TOP HEADER NAVIGATION */}
      <header className="sticky top-0 z-50 w-full border-b border-[#1f2633]/80 bg-[#0a0c10]/90 backdrop-blur-md px-3 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* LOGO */}
          <Link href={`/${locale}`} className="flex items-center gap-2 sm:gap-3 shrink-0">
            <SoufToolsLogo size={36} showText={true} />
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[10px] font-extrabold text-[#00d4aa] font-mono">
              AI STUDIO
            </span>
          </Link>

          {/* MIDDLE NAV LINKS */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2 bg-[#12161f]/90 p-1.5 rounded-2xl border border-[#1f2633]">
            <Link
              href={`/${locale}`}
              className="px-4 py-1.5 rounded-xl text-xs font-bold text-[#00d4aa] bg-[#00d4aa]/15 border border-[#00d4aa]/30 shadow-sm transition-all"
            >
              {isRtl ? "الرئيسية" : "Home"}
            </Link>

            <Link
              href={`/${locale}/models`}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1f2633]/50 transition-all"
            >
              {isRtl ? "النماذج" : "Models"}
            </Link>

            <Link
              href={`/${locale}/tools`}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1f2633]/50 transition-all"
            >
              {isRtl ? "مركز الأدوات" : "Toolbox"}
            </Link>

            <Link
              href={`/${locale}/pricing`}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1f2633]/50 transition-all"
            >
              {isRtl ? "الأسعار والترقية" : "Pricing"}
            </Link>

            <Link
              href={`/${locale}/about`}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1f2633]/50 transition-all"
            >
              {isRtl ? "عن المنصة" : "About"}
            </Link>
          </nav>

          {/* CONTROLS (Globe Language & Mobile Hamburger) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSwitcher locale={locale} />

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl bg-[#12161f] border border-[#1f2633] text-[#94a3b8] hover:text-[#00d4aa] transition-all cursor-pointer"
              aria-label="Toggle Mobile Navigation"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4 text-[#94a3b8]" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-[#1e2e2e] bg-[#0a0f0f]/95 backdrop-blur-2xl px-4 py-3 space-y-2 mt-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={`/${locale}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/40 text-[#00d4aa] text-xs font-bold"
                >
                  <Home className="w-4 h-4" />
                  <span>{isRtl ? "الرئيسية" : "Home"}</span>
                </Link>

                <Link
                  href={`/${locale}/chat`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-[#88b0b0] hover:text-[#00d4aa] text-xs font-bold"
                >
                  <MessageSquare className="w-4 h-4 text-[#00d4aa]" />
                  <span>{isRtl ? "المحادثة الذكية" : "AI Chat"}</span>
                </Link>

                <Link
                  href={`/${locale}/tools`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-[#88b0b0] hover:text-[#00d4aa] text-xs font-bold"
                >
                  <Wrench className="w-4 h-4 text-[#00d4aa]" />
                  <span>{isRtl ? "مركز الأدوات" : "Toolbox"}</span>
                </Link>

                <Link
                  href={`/${locale}/models`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-[#88b0b0] hover:text-[#00d4aa] text-xs font-bold"
                >
                  <Cpu className="w-4 h-4 text-[#00d4aa]" />
                  <span>{isRtl ? "النماذج" : "Models"}</span>
                </Link>

                <Link
                  href={`/${locale}/pricing`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-[#88b0b0] hover:text-[#00d4aa] text-xs font-bold"
                >
                  <Crown className="w-4 h-4 text-[#00d4aa]" />
                  <span>{isRtl ? "الأسعار والترقية" : "Pricing"}</span>
                </Link>

                <Link
                  href={`/${locale}/settings`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-[#88b0b0] hover:text-[#00d4aa] text-xs font-bold"
                >
                  <Settings className="w-4 h-4 text-[#00d4aa]" />
                  <span>{isRtl ? "الإعدادات" : "Settings"}</span>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* MAIN HERO CONTAINER WITH 3D SWIRLING CYBER-VORTEX */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-10 relative z-10 w-full flex flex-col items-center justify-center flex-1">
        {/* ============================================================ */}
        {/* SECTION 1: HERO & 3D CYBER-VORTEX PORTAL                     */}
        {/* ============================================================ */}
        <section className="flex flex-col items-center text-center space-y-4 sm:space-y-6 max-w-4xl mx-auto w-full">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111a1a] border border-[#00d4aa]/40 text-[#00d4aa] text-[11px] sm:text-xs font-bold shadow-md shadow-[#00d4aa]/10">
            <Zap className="w-3.5 h-3.5 shrink-0" />
            <span>{isRtl ? "منصة SoufTools — أداء خارق ونماذج جبارة" : "SoufTools — Next-Gen Sovereignty"}</span>
          </div>

          {/* Grand Headline */}
          <div className="space-y-1.5 sm:space-y-2">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#e8f5f5] leading-[1.25]">
              <span className="block text-lg sm:text-2xl text-[#88b0b0] font-bold mb-0.5">
                {isRtl ? "بوابة المستقبل:" : "Gateway to the Future:"}
              </span>
              <span className="block">{isRtl ? "منصة الذكاء الاصطناعي العالمية" : "World-Class AI Platform"}</span>
              <span className="text-gradient-teal block mt-0.5">{isRtl ? "فائقة الأداء، بلا حدود" : "Ultra High Performance, Limitless"}</span>
            </h1>

            <p className="text-xs sm:text-sm text-[#88b0b0] max-w-xl mx-auto leading-relaxed pt-1">
              {isRtl
                ? "استمتع بقوة أحدث نماذج الذكاء الاصطناعي مع استجابة أسرع، أداء أعلى، ودعم كامل للغة العربية لبناء تطبيقات وحلول ذكية بلا حدود."
                : "Experience top-tier AI models with automated intelligent routing, sub-second latency, full Arabic support, and zero downtime."}
            </p>
          </div>

          {/* CTAs (Prominent Foreground z-30) */}
          <div className="relative z-30 flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-1">
            {/* Start Chat Button */}
            <button
              type="button"
              onClick={handleStartChat}
              className={`px-7 sm:px-9 py-3 sm:py-3.5 rounded-2xl bg-[#00d4aa] hover:bg-[#00ff88] text-[#0a0f0f] font-extrabold text-xs sm:text-sm shadow-[0_0_30px_rgba(0,212,170,0.4)] hover:shadow-[0_0_45px_rgba(0,212,170,0.7)] hover:scale-105 active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 select-none cursor-pointer ${
                isNavigating ? "animate-pulse brightness-110 shadow-2xl shadow-[#00d4aa]/50" : ""
              }`}
            >
              {isNavigating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0a0f0f]" />
                  <span>{isRtl ? "جاري الانطلاق..." : "Launching..."}</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current animate-bounce-short" />
                  <span>{isRtl ? "ابدأ التجربة الآن" : "Start Trial Now"}</span>
                </>
              )}
            </button>

            {/* Explore Models */}
            <Link
              href={`/${locale}/models`}
              className="px-7 sm:px-9 py-3 sm:py-3.5 rounded-2xl bg-[#0a1414]/90 backdrop-blur-md hover:bg-[#142424] text-[#e8f5f5] border border-[#00d4aa]/30 hover:border-[#00d4aa]/60 font-bold text-xs sm:text-sm shadow-lg transition-all flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-[#00d4aa]" />
              <span>{isRtl ? "استكشف النماذج" : "Explore Models"}</span>
            </Link>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#1e2e2e] bg-[#080d0d] py-6 sm:py-8 px-4 text-xs text-[#4a7070] relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-right">
          <p className="text-xs font-semibold">
            SoufTools Platform. All rights reserved 2026 ©
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-medium">
            <Link href={`/${locale}/pricing`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "الأسعار" : "Pricing"}
            </Link>
            <span>•</span>
            <Link href={`/${locale}/privacy`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "الخصوصية" : "Privacy"}
            </Link>
            <span>•</span>
            <Link href={`/${locale}/terms`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "الشروط" : "Terms"}
            </Link>
            <span>•</span>
            <Link href={`/${locale}/about`} className="hover:text-[#00d4aa] transition-colors">
              {isRtl ? "عن المنصة" : "About"}
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:text-[#00d4aa] transition-colors"
            >
              <GitBranch className="w-4 h-4" />
            </a>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:text-[#00d4aa] transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:text-[#00d4aa] transition-colors"
            >
              <Globe className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
