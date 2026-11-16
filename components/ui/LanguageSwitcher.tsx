"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Globe, Check, X, ChevronDown } from "lucide-react";
import { useSoufI18n } from "@/components/providers/I18nProvider";
import { SUPPORTED_LOCALES, LOCALE_METADATA_MAP, SupportedLocale } from "@/lib/i18n";

export interface LanguageSwitcherProps {
  locale?: string;
  dropUp?: boolean;
  align?: "start" | "end";
  className?: string;
  buttonClassName?: string;
  showLabel?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  locale,
  dropUp = false,
  align = "end",
  className = "",
  buttonClassName = "",
  showLabel = true,
}) => {
  const { locale: activeLocale, setLocale, isRtl, t } = useSoufI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    isDropUp?: boolean;
  }>({});

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check mounted and mobile status
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Lock body scroll on mobile when open
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, isMobile]);

  // Compute position for desktop popover
  const updatePosition = useCallback(() => {
    if (!buttonRef.current || typeof window === "undefined") return;

    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 260;
    const menuHeight = 360;
    const gap = 8;
    const padding = 16;

    // Check vertical space: should we drop up or drop down?
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldDropUp = dropUp || (spaceBelow < menuHeight && spaceAbove > spaceBelow);

    // Compute horizontal position with viewport clamping
    let leftPos: number;
    if (align === "start") {
      leftPos = isRtl ? rect.right - menuWidth : rect.left;
    } else {
      leftPos = isRtl ? rect.left : rect.right - menuWidth;
    }

    // Clamp horizontally to stay inside visible viewport
    leftPos = Math.max(padding, Math.min(leftPos, window.innerWidth - menuWidth - padding));

    if (shouldDropUp) {
      setCoords({
        bottom: window.innerHeight - rect.top + gap,
        left: leftPos,
        isDropUp: true,
      });
    } else {
      setCoords({
        top: rect.bottom + gap,
        left: leftPos,
        isDropUp: false,
      });
    }
  }, [align, dropUp, isRtl]);

  // Update coords on open, resize, or scroll
  useEffect(() => {
    if (isOpen && !isMobile) {
      updatePosition();
      const handleScrollOrResize = () => {
        updatePosition();
      };
      window.addEventListener("resize", handleScrollOrResize);
      window.addEventListener("scroll", handleScrollOrResize, true);
      return () => {
        window.removeEventListener("resize", handleScrollOrResize);
        window.removeEventListener("scroll", handleScrollOrResize, true);
      };
    }
  }, [isOpen, isMobile, updatePosition]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (loc: SupportedLocale) => {
    setLocale(loc);
    setIsOpen(false);
  };

  const currentMeta = LOCALE_METADATA_MAP[activeLocale] || LOCALE_METADATA_MAP["ar"];

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
        }}
        className={`px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-[#00d4aa] hover:border-[#00d4aa]/60 hover:bg-[#1e2e2e]/50 transition-all cursor-pointer flex items-center gap-1.5 sm:gap-2 shadow-sm text-xs font-semibold select-none ${buttonClassName}`}
        title={t("settings.language", undefined, "Interface Language")}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span className="text-sm leading-none">{currentMeta.flagSymbol}</span>
        {showLabel && <span className="hidden xs:inline">{currentMeta.nativeName}</span>}
        <Globe className="w-3.5 h-3.5 opacity-80 shrink-0" />
      </button>

      {/* Render Portal (Mobile Bottom-Sheet or Desktop Anchored Popover) */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <>
                {/* Mobile View: Dedicated Bottom Sheet */}
                {isMobile ? (
                  <div className="fixed inset-0 z-[99999] flex items-end justify-center p-0">
                    {/* Dark Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="fixed inset-0 bg-black/80 backdrop-blur-sm"
                      onClick={() => setIsOpen(false)}
                    />

                    {/* Bottom Sheet Modal */}
                    <motion.div
                      ref={dropdownRef}
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 28, stiffness: 320 }}
                      className="relative z-10 w-full bg-[#0c1414] border-t border-[#1e2e2e] rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.9)] p-4 pb-6 flex flex-col max-h-[80vh] overflow-hidden"
                      dir={isRtl ? "rtl" : "ltr"}
                    >
                      {/* Pull handle */}
                      <div className="w-12 h-1.5 rounded-full bg-[#203232] mx-auto mb-3 shrink-0" />

                      {/* Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-[#1a2828] mb-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa]">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-[#e8f5f5]">
                              {t("settings.language", undefined, isRtl ? "اختر لغة الواجهة" : "Select Interface Language")}
                            </h3>
                            <p className="text-[11px] text-[#5c8a8a]">
                              {isRtl ? "12 لغة متوفرة بالكامل" : "12 languages fully supported"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsOpen(false)}
                          className="p-2 rounded-xl text-[#7a9a9a] hover:text-[#e8f5f5] hover:bg-[#162222] transition-colors cursor-pointer"
                          aria-label="Close"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Language List */}
                      <div className="space-y-1.5 overflow-y-auto custom-scrollbar flex-1 pr-0.5">
                        {SUPPORTED_LOCALES.map((locKey) => {
                          const meta = LOCALE_METADATA_MAP[locKey];
                          const isCurrent = activeLocale === locKey;

                          return (
                            <button
                              key={locKey}
                              type="button"
                              onClick={() => handleSelect(locKey)}
                              className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all cursor-pointer text-start min-h-[52px] ${
                                isCurrent
                                  ? "bg-[#00d4aa]/15 text-[#00d4aa] font-bold border border-[#00d4aa]/40 shadow-sm"
                                  : "bg-[#0e1616] text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#142020] border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-2xl leading-none">{meta.flagSymbol}</span>
                                <div>
                                  <span className={`block text-xs font-bold ${isCurrent ? "text-[#00d4aa]" : "text-[#e8f5f5]"}`}>
                                    {meta.nativeName}
                                  </span>
                                  <span className="block text-[10px] opacity-60 font-normal">
                                    {meta.englishName}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {meta.direction === "rtl" && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#182626] text-[#00d4aa] font-mono font-bold border border-[#00d4aa]/20">
                                    RTL
                                  </span>
                                )}
                                {isCurrent && (
                                  <div className="w-6 h-6 rounded-full bg-[#00d4aa] text-[#0a0f0f] flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  /* Desktop View: Anchored Viewport-Aware Popover */
                  <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, scale: 0.95, y: coords.isDropUp ? 8 : -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: coords.isDropUp ? 8 : -8 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    style={{
                      position: "fixed",
                      top: coords.top !== undefined ? `${coords.top}px` : "auto",
                      bottom: coords.bottom !== undefined ? `${coords.bottom}px` : "auto",
                      left: coords.left !== undefined ? `${coords.left}px` : "auto",
                      width: "260px",
                      zIndex: 99999,
                    }}
                    className="max-h-[380px] overflow-hidden flex flex-col p-1.5 rounded-2xl bg-[#0c1414] border border-[#1e2e2e] shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-xl space-y-1 text-xs font-medium select-none"
                    dir={isRtl ? "rtl" : "ltr"}
                  >
                    <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-[#5c8a8a] font-bold border-b border-[#1e2e2e]/60 mb-1 flex items-center justify-between shrink-0">
                      <span>{t("settings.language", undefined, isRtl ? "لغة الواجهة" : "Select Language")}</span>
                      <span className="font-mono text-[9px] bg-[#142222] text-[#00d4aa] px-1.5 py-0.5 rounded border border-[#00d4aa]/20">
                        12 {isRtl ? "لغة" : "languages"}
                      </span>
                    </div>

                    <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1 pr-0.5">
                      {SUPPORTED_LOCALES.map((locKey) => {
                        const meta = LOCALE_METADATA_MAP[locKey];
                        const isCurrent = activeLocale === locKey;

                        return (
                          <button
                            key={locKey}
                            type="button"
                            onClick={() => handleSelect(locKey)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer text-start ${
                              isCurrent
                                ? "bg-[#00d4aa]/15 text-[#00d4aa] font-bold border border-[#00d4aa]/40 shadow-sm"
                                : "text-[#88b0b0] hover:text-[#e8f5f5] hover:bg-[#121c1c] border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-base leading-none">{meta.flagSymbol}</span>
                              <div>
                                <span className={`block text-xs font-semibold ${isCurrent ? "text-[#00d4aa]" : "text-[#e8f5f5]"}`}>
                                  {meta.nativeName}
                                </span>
                                <span className="block text-[10px] opacity-60 font-normal">
                                  {meta.englishName}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {meta.direction === "rtl" && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#162323] text-[#00d4aa] font-mono border border-[#00d4aa]/20">
                                  RTL
                                </span>
                              )}
                              {isCurrent && <Check className="w-3.5 h-3.5 text-[#00d4aa]" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};


