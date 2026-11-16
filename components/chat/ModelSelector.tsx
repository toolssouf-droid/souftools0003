"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Check, Sparkles } from "lucide-react";
import { SOUFAI_MODELS, SoufAIModelDef } from "@/lib/providers";
import { useChatStore } from "@/store/chatStore";
import { ModelLogo } from "@/components/ui/Logos";
import { isRtlLocale } from "@/lib/i18n";
import { getModelLocalizedDetails } from "@/lib/i18n/multilingualStrings";

interface ModelSelectorProps {
  locale: string;
  dropUp?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ locale, dropUp = false }) => {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [actualDropUp, setActualDropUp] = useState<boolean>(dropUp);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  }>({});

  const [activeTiers, setActiveTiers] = useState<string[] | null>(null);

  const { currentModel, setCurrentModel } = useChatStore();
  const isRtl = isRtlLocale(locale);

  useEffect(() => {
    setMounted(true);
    // Purge legacy tiers from browser/phone localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("souftools_active_tiers");
      } catch {}
    }
  }, []);

  // Sync active model tiers from server admin configuration
  const fetchActiveTiers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/keys");
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.activeModelTiers) && data.activeModelTiers.length > 0) {
          setActiveTiers(data.activeModelTiers);
          
          const curModel = useChatStore.getState().currentModel;
          if (!data.activeModelTiers.includes(curModel)) {
            setCurrentModel(data.activeModelTiers[0]);
          }
        }
      }
    } catch (e) {
      // Keep existing activeTiers state or fallback
    }
  }, [setCurrentModel]);

  // Initial load
  useEffect(() => {
    fetchActiveTiers();
  }, [fetchActiveTiers]);

  // Real-time listener for tier changes from Admin Panel or across browser tabs
  useEffect(() => {
    const handleCustomEvent = (e: any) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setActiveTiers(e.detail);
        const curModel = useChatStore.getState().currentModel;
        if (!e.detail.includes(curModel)) {
          setCurrentModel(e.detail[0]);
        }
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === "souftools_active_tiers" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setActiveTiers(parsed);
            const curModel = useChatStore.getState().currentModel;
            if (!parsed.includes(curModel)) {
              setCurrentModel(parsed[0]);
            }
          }
        } catch {}
      }
    };

    window.addEventListener("souftools_active_tiers_changed", handleCustomEvent);
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener("souftools_active_tiers_changed", handleCustomEvent);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [setCurrentModel]);

  // Calculate coordinates relative to the trigger button
  const calculatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;

    // Determine whether to open upward or downward
    const shouldDropUp = dropUp ?? (spaceBelow < 260 && spaceAbove > spaceBelow);
    const newCoords: { top?: number; bottom?: number; left?: number; right?: number } = {};

    if (shouldDropUp) {
      newCoords.bottom = Math.max(8, window.innerHeight - rect.top + 6);
    } else {
      newCoords.top = Math.max(8, rect.bottom + 6);
    }

    const menuWidth = Math.min(290, window.innerWidth - 20);

    if (isRtl) {
      const rightEdge = window.innerWidth - rect.right;
      const clampedRight = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rightEdge));
      newCoords.right = clampedRight;
    } else {
      const leftEdge = rect.left;
      const clampedLeft = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, leftEdge));
      newCoords.left = clampedLeft;
    }

    setCoords(newCoords);
    setActualDropUp(shouldDropUp);
  }, [dropUp, isRtl]);

  // Toggle dropdown with synchronous position calculation
  const handleToggle = () => {
    if (!open) {
      calculatePosition();
      fetchActiveTiers();
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  // Recalculate position on scroll or resize when open
  useEffect(() => {
    if (!open) return;

    const handleScrollOrResize = () => {
      calculatePosition();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, calculatePosition]);

  const allModelsList: SoufAIModelDef[] = [
    SOUFAI_MODELS.core,
    SOUFAI_MODELS.pro,
    SOUFAI_MODELS.ultra,
    SOUFAI_MODELS.spark,
  ].filter(Boolean);

  // Filter based on activeTiers if configured in control panel
  const modelListToRender = (activeTiers && activeTiers.length > 0)
    ? allModelsList.filter((m) => activeTiers.includes(m.id))
    : allModelsList;

  const effectiveModels = modelListToRender.length > 0 ? modelListToRender : allModelsList;
  const activeDef: SoufAIModelDef = SOUFAI_MODELS[currentModel] || effectiveModels[0] || SOUFAI_MODELS.core;
  const activeMeta = getModelLocalizedDetails(activeDef.id, locale);

  return (
    <div className="relative inline-block text-right">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl bg-[#12161f] hover:bg-[#161b26] border border-[#1f2633] hover:border-[#00d4aa]/40 transition-all shadow-sm group cursor-pointer shrink-0"
        aria-label="Select AI Model"
        aria-expanded={open}
      >
        <ModelLogo modelId={activeDef.id} size={18} />
        <div className="flex items-center gap-1 min-w-0 max-w-[100px] xs:max-w-[130px] sm:max-w-[170px]">
          <span className="text-[11px] sm:text-xs font-bold text-[#f1f5f9] group-hover:text-[#00d4aa] transition-colors truncate">
            {isRtl ? activeDef.nameAr : activeDef.nameEn}
          </span>
          <span className="text-[8px] sm:text-[9px] bg-[#00d4aa]/20 text-[#00d4aa] px-1 py-0.2 rounded-full font-semibold border border-[#00d4aa]/30 shrink-0 hidden xs:inline">
            {activeMeta.badge || activeDef.badge}
          </span>
        </div>
        <ChevronDown
          className={`w-3 h-3 text-[#64748b] group-hover:text-[#00d4aa] transition-transform duration-200 shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
                {/* Non-intrusive transparent backdrop to handle outside clicks without obscuring UI */}
                <div
                  className="fixed inset-0 z-[99998] bg-transparent cursor-default"
                  onClick={() => setOpen(false)}
                />

                {/* Compact Dropdown Popover */}
                <motion.div
                  key="soufai-model-selector-popover"
                  initial={{
                    opacity: 0,
                    scale: 0.94,
                    y: actualDropUp ? 8 : -8,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.94,
                    y: actualDropUp ? 8 : -8,
                  }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: "fixed",
                    ...coords,
                    transformOrigin: actualDropUp
                      ? isRtl
                        ? "bottom right"
                        : "bottom left"
                      : isRtl
                      ? "top right"
                      : "top left",
                  }}
                  className="z-[99999] w-[280px] sm:w-[300px] max-w-[calc(100vw-20px)] bg-[#12161f]/95 backdrop-blur-xl border border-[#1f2633] rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.75)] p-2 flex flex-col select-none"
                  dir={isRtl ? "rtl" : "ltr"}
                >
                  {/* Top Header */}
                  <div className="px-2 py-1.5 border-b border-[#1f2633] flex items-center justify-between shrink-0 mb-1.5">
                    <span className="text-[11px] font-bold text-[#f1f5f9] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#00d4aa]" />
                      {isRtl ? "اختيار النموذج" : "Select Model"}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 font-semibold">
                      {effectiveModels.length} {isRtl ? "متاح" : "active"}
                    </span>
                  </div>

                  {/* Scrollable Model List supporting any number of models */}
                  <div className="space-y-1 overflow-y-auto max-h-[260px] custom-scrollbar pe-1">
                    {effectiveModels.map((m) => {
                      const isSelected = currentModel === m.id;
                      const localizedMeta = getModelLocalizedDetails(m.id, locale);

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setCurrentModel(m.id);
                            setOpen(false);
                          }}
                          className={`w-full p-2 rounded-xl transition-all flex items-center justify-between text-start cursor-pointer group ${
                            isSelected
                              ? "bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/40 shadow-sm"
                              : "bg-[#161b26]/80 hover:bg-[#1a2230] border border-transparent hover:border-[#1f2633] text-[#94a3b8] hover:text-[#f1f5f9]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-[#00d4aa]/20 text-[#00d4aa]"
                                  : "bg-[#142020] text-[#7a9595] group-hover:text-[#00d4aa]"
                              }`}
                            >
                              <ModelLogo modelId={m.id} size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-xs font-bold truncate ${
                                    isSelected ? "text-[#00d4aa]" : "text-[#e8f5f5]"
                                  }`}
                                >
                                  {isRtl ? m.nameAr : m.nameEn}
                                </span>
                                <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-[#162323] text-[#00d4aa] border border-[#00d4aa]/20 shrink-0">
                                  {localizedMeta.badge || m.badge}
                                </span>
                              </div>
                              <p className="text-[9.5px] text-[#6a8585] mt-0.5 truncate leading-tight">
                                {localizedMeta.description ||
                                  (isRtl ? m.descriptionAr : m.descriptionEn)}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-[#00d4aa] text-[#0a0f0f] flex items-center justify-center shrink-0 ms-1">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
