"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  ArrowLeft,
  Home,
  MessageSquare,
  Wrench,
  Cpu,
  Settings,
  Sparkles,
  Menu,
  X,
  Compass,
  Layers,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { SoufToolsLogo } from "@/components/ui/Logos";
import { isRtlLocale } from "@/lib/i18n";
import { BehavioralNotificationHub } from "@/components/ui/BehavioralNotificationHub";

export interface AppNavigationHeaderProps {
  locale: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  activeKey?: "home" | "chat" | "tools" | "models" | "images" | "audio" | "translate" | "settings" | "history" | "about" | "pricing" | "memory" | "impact" | "incubator" | "innovation" | string;
  actions?: React.ReactNode;
}

export function AppNavigationHeader({
  locale,
  title,
  subtitle,
  icon,
  backHref,
  backLabel,
  activeKey,
  actions,
}: AppNavigationHeaderProps) {
  const router = useRouter();
  const isRtl = isRtlLocale(locale);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine back navigation logic
  const targetBackHref = backHref || `/${locale}`;
  const defaultBackText = isRtl ? "الرجوع" : "Back";
  const displayBackLabel = backLabel || defaultBackText;

  const handleBackClick = (e: React.MouseEvent) => {
    // If user has specific backHref, prefer regular navigation
    if (backHref) return;
    
    // If history exists in window, try router.back()
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };

  const navLinks = [
    { key: "home", href: `/${locale}`, label: isRtl ? "الرئيسية" : "Home", icon: Home },
    { key: "chat", href: `/${locale}/chat`, label: isRtl ? "المحادثة الذكية" : "AI Chat", icon: MessageSquare, badge: "SoufAI" },
    { key: "tools", href: `/${locale}/tools`, label: isRtl ? "مركز الأدوات" : "Toolbox", icon: Wrench },
    { key: "models", href: `/${locale}/models`, label: isRtl ? "مركز النماذج" : "Model Hub", icon: Cpu },
    { key: "settings", href: `/${locale}/settings`, label: isRtl ? "الإعدادات" : "Settings", icon: Settings },
  ];

  const BackChevron = isRtl ? ArrowRight : ArrowLeft;
  const SubChevron = isRtl ? ChevronLeft : ChevronRight;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1f2633] bg-[#0a0c10]/92 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* Left section: Back Button & Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Direct Back / Return Button */}
            <Link
              href={targetBackHref}
              onClick={handleBackClick}
              className="group inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#12161f] hover:bg-[#161b26] border border-[#1f2633] hover:border-[#00d4aa]/50 text-[#94a3b8] hover:text-[#00d4aa] text-xs sm:text-sm font-semibold transition-all shadow-sm hover:shadow-[#00d4aa]/10 active:scale-95 shrink-0"
              title={isRtl ? "الرجوع للواجهة السابقة" : "Return to previous view"}
            >
              <BackChevron className="w-4 h-4 transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
              <span className="hidden xs:inline">{displayBackLabel}</span>
            </Link>

            {/* Platform Brand / Logo */}
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity"
            >
              <SoufToolsLogo size={28} showText={false} />
            </Link>

            {/* Separator */}
            <div className="h-4 w-px bg-[#1f2633] hidden sm:block shrink-0" />

            {/* Current Page Identity Badge */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              {icon && (
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#00d4aa]/10 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa] shrink-0">
                  {icon}
                </div>
              )}
              <div className="flex flex-col min-w-0 leading-tight">
                <h1 className="text-xs sm:text-sm font-bold text-[#f1f5f9] truncate">
                  {title}
                </h1>
                {subtitle && (
                  <span className="text-[10px] sm:text-xs text-[#94a3b8] truncate hidden md:inline">
                    {subtitle}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center / Right: Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#12161f] p-1 rounded-xl border border-[#1f2633]">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = activeKey === item.key;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md shadow-[#00d4aa]/20 font-bold"
                      : "text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#161b26]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge && !isActive && (
                    <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#00d4aa]/15 text-[#00d4aa]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right section: Actions & Mobile Menu Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <BehavioralNotificationHub locale={locale} />
            {actions}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-[#12161f] hover:bg-[#161b26] border border-[#1f2633] text-[#94a3b8] hover:text-[#00d4aa] transition-all cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden border-t border-[#1f2633] bg-[#0a0c10]/98 backdrop-blur-2xl overflow-hidden px-4 py-3"
            >
              <div className="grid grid-cols-2 gap-2 pt-1 pb-2">
                {navLinks.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeKey === item.key;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-xs font-bold ${
                        isActive
                          ? "bg-[#00d4aa]/15 border-[#00d4aa]/50 text-[#00d4aa]"
                          : "bg-[#12161f] border-[#1f2633] text-[#94a3b8] hover:text-[#f1f5f9]"
                      }`}
                    >
                      <Icon className="w-4 h-4 text-[#00d4aa]" />
                      <div className="flex flex-col">
                        <span>{item.label}</span>
                        {item.badge && (
                          <span className="text-[9px] text-[#00d4aa]/80 font-normal">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Quick direct return action in mobile drawer */}
              <div className="mt-2 pt-2 border-t border-[#1e2e2e] flex items-center justify-between">
                <Link
                  href={targetBackHref}
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    handleBackClick(e);
                  }}
                  className="flex items-center gap-2 text-xs font-semibold text-[#00d4aa] hover:underline"
                >
                  <BackChevron className="w-3.5 h-3.5" />
                  <span>{isRtl ? `العودة: ${displayBackLabel}` : `Back: ${displayBackLabel}`}</span>
                </Link>

                <Link
                  href={`/${locale}/chat`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#00d4aa] text-[#0a0f0f] text-xs font-bold shadow-sm shadow-[#00d4aa]/20"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{isRtl ? "محادثة فورية" : "Live Chat"}</span>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
  );
}
