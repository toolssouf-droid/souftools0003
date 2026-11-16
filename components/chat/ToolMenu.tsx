"use client";

import React, { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  Brain,
  Palette,
  Mail,
  Send,
  X,
  Sparkles,
  Unlink,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Bot,
  ShieldCheck,
  HardDrive,
  MessageSquare,
} from "lucide-react";
import { useGmailStore } from "@/store/gmailStore";
import { useGoogleDriveStore } from "@/store/googleDriveStore";
import { useTelegramStore } from "@/store/telegramStore";
import { useWhatsAppPairStore } from "@/store/whatsappPairStore";
import { useChatStore } from "@/store/chatStore";
import { isRtlLocale } from "@/lib/i18n";
import { getToolLocalizedDetails } from "@/lib/i18n/multilingualStrings";

interface ToolMenuProps {
  onClose: () => void;
  activeTools: string[];
  onToggleTool: (toolId: string) => void;
  onImageSelect?: () => void;
  onCameraSelect?: () => void;
  onFileSelect: () => void;
  onAudioSelect: () => void;
  isAudioRecording: boolean;
  locale: string;
}

export const ToolMenu: React.FC<ToolMenuProps> = ({
  onClose,
  activeTools,
  onToggleTool,
  locale,
}) => {
  const [mounted, setMounted] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // WhatsApp Pairing State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [copiedWhatsAppCode, setCopiedWhatsAppCode] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const isRtl = isRtlLocale(locale);
  const { isAdmin, userEmail, userId, userName } = useChatStore();
  const { isConnected: isGmailConnected, disconnectGmail } = useGmailStore();
  const { isConnected: isDriveConnected, connectDrive, disconnectDrive, email: driveEmail } = useGoogleDriveStore();
  const {
    isLinked: isTelegramLinked,
    pairingCode,
    botUsername,
    deepLink,
    isGeneratingCode,
    isChecking,
    generatePairingCode,
    checkPairingStatus,
    unlinkTelegram,
  } = useTelegramStore();

  const {
    isLinked: isWhatsAppLinked,
    pairedPhone: whatsAppPairedPhone,
    pairingCode: whatsAppPairingCode,
    botPhoneNumber: whatsAppBotPhoneNumber,
    deepLink: whatsAppDeepLink,
    isGeneratingCode: isGeneratingWhatsAppCode,
    isChecking: isCheckingWhatsApp,
    generatePairingCode: generateWhatsAppPairingCode,
    checkPairingStatus: checkWhatsAppPairingStatus,
    checkInitialStatus: checkWhatsAppInitialStatus,
    unlinkWhatsApp,
  } = useWhatsAppPairStore();

  useEffect(() => {
    setMounted(true);
    checkWhatsAppInitialStatus();
  }, [checkWhatsAppInitialStatus]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        if (!showTelegramModal && !showWhatsAppModal) {
          onClose();
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, showTelegramModal, showWhatsAppModal]);

  // Periodic polling for Telegram pairing status while modal is open
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (showTelegramModal && !isTelegramLinked && pairingCode) {
      timer = setInterval(async () => {
        const linked = await checkPairingStatus();
        if (linked) {
          setTimeout(() => {
            setShowTelegramModal(false);
          }, 1800);
        }
      }, 3000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showTelegramModal, isTelegramLinked, pairingCode, checkPairingStatus]);

  // Periodic polling for WhatsApp pairing status while modal is open
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (showWhatsAppModal && !isWhatsAppLinked && whatsAppPairingCode) {
      timer = setInterval(async () => {
        const linked = await checkWhatsAppPairingStatus();
        if (linked) {
          setTimeout(() => {
            setShowWhatsAppModal(false);
          }, 1800);
        }
      }, 3000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showWhatsAppModal, isWhatsAppLinked, whatsAppPairingCode, checkWhatsAppPairingStatus]);

  const toggleAndClose = (toolId: string) => {
    onToggleTool(toolId);
    onClose();
  };

  const handleOpenTelegramPairing = async () => {
    if (!pairingCode) {
      await generatePairingCode(userEmail || undefined, userId || undefined);
    }
    setShowTelegramModal(true);
  };

  const handleOpenWhatsAppPairing = async () => {
    if (!whatsAppPairingCode) {
      await generateWhatsAppPairingCode(userEmail || undefined, userId || undefined, userName || undefined);
    }
    setShowWhatsAppModal(true);
  };

  const handleCopyCode = () => {
    if (pairingCode) {
      navigator.clipboard.writeText(pairingCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleCopyWhatsAppCode = () => {
    if (whatsAppPairingCode) {
      navigator.clipboard.writeText(`ربط ${whatsAppPairingCode}`);
      setCopiedWhatsAppCode(true);
      setTimeout(() => setCopiedWhatsAppCode(false), 2000);
    }
  };

  const toolsData = [
    {
      id: "deep_thinking",
      icon: <Brain className="w-5 h-5 text-[#00ff88]" />,
      name: getToolLocalizedDetails("deep_reasoning", locale).name,
      desc: getToolLocalizedDetails("deep_reasoning", locale).desc,
      action: () => toggleAndClose("deep_thinking"),
      active: activeTools.includes("deep_thinking"),
    },
    {
      id: "create_image",
      icon: <Palette className="w-5 h-5 text-[#ff00aa]" />,
      name: getToolLocalizedDetails("image_generation", locale).name,
      desc: getToolLocalizedDetails("image_generation", locale).desc,
      action: () => toggleAndClose("create_image"),
      active: activeTools.includes("create_image"),
    },
    {
      id: "gmail_integration",
      icon: <Mail className="w-5 h-5 text-[#ea4335]" />,
      name: getToolLocalizedDetails("gmail_tool", locale).name,
      desc: getToolLocalizedDetails("gmail_tool", locale).desc,
      action: async () => {
        const { isConnected, connectGmail } = useGmailStore.getState();
        if (!isConnected) {
          try {
            await connectGmail();
            onToggleTool("gmail_integration");
          } catch (e) {
            console.error(e);
          }
        } else {
          toggleAndClose("gmail_integration");
        }
      },
      active: activeTools.includes("gmail_integration") || isGmailConnected,
    },
    {
      id: "google_drive_integration",
      icon: <HardDrive className="w-5 h-5 text-[#0F9D58]" />,
      name: getToolLocalizedDetails("google_drive_tool", locale).name,
      desc: getToolLocalizedDetails("google_drive_tool", locale).desc,
      action: async () => {
        const { isConnected, connectDrive } = useGoogleDriveStore.getState();
        if (!isConnected) {
          try {
            await connectDrive();
            onToggleTool("google_drive_integration");
          } catch (e) {
            console.error(e);
          }
        } else {
          toggleAndClose("google_drive_integration");
        }
      },
      active: activeTools.includes("google_drive_integration") || isDriveConnected,
    },
    {
      id: "telegram_integration",
      icon: <Send className="w-5 h-5 text-[#0088cc]" />,
      name: getToolLocalizedDetails("telegram_tool", locale).name,
      desc: getToolLocalizedDetails("telegram_tool", locale).desc,
      action: async () => {
        if (!isTelegramLinked) {
          await handleOpenTelegramPairing();
        } else {
          toggleAndClose("telegram_integration");
        }
      },
      active: activeTools.includes("telegram_integration") || isTelegramLinked,
    },
    {
      id: "whatsapp_integration",
      icon: <MessageSquare className="w-5 h-5 text-[#25D366]" />,
      name: getToolLocalizedDetails("whatsapp_tool", locale).name,
      desc: getToolLocalizedDetails("whatsapp_tool", locale).desc,
      action: async () => {
        if (!isWhatsAppLinked) {
          await handleOpenWhatsAppPairing();
        } else {
          toggleAndClose("whatsapp_integration");
        }
      },
      active: activeTools.includes("whatsapp_integration") || isWhatsAppLinked,
    },
  ];

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => {
          if (!showTelegramModal && !showWhatsAppModal) onClose();
        }}
      />

      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full sm:w-[560px] max-w-full bg-[#12161f] border-t sm:border border-[#1f2633] rounded-t-3xl sm:rounded-2xl shadow-[0_-20px_50px_rgba(0,0,0,0.9)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.95)] p-4 sm:p-5 select-none max-h-[85vh] sm:max-h-[580px] flex flex-col overflow-hidden"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Drag handle for mobile */}
        <div className="w-12 h-1.5 bg-[#1f2633] rounded-full mx-auto mb-3 sm:hidden shrink-0" />

        {/* Header Title */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#1f2633]/70 mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00d4aa]/15 flex items-center justify-center border border-[#00d4aa]/30">
              <Sparkles className="w-4 h-4 text-[#00d4aa] animate-pulse" />
            </div>
            <div>
              <h3 className="text-xs font-black text-[#f1f5f9] uppercase tracking-wider">
                {isRtl ? "مركز تحكم كودكس والوكيل الذكي" : "SoufAI Command Center Tools"}
              </h3>
              <p className="text-[10px] text-[#64748b] mt-0.5">
                {isRtl ? "اختر أداة حية أو قم بتفعيل وضع التوجيه الخاص بك" : "Activate dynamic skills & workflow states"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#64748b] hover:text-[#f43f5e] hover:bg-[#161b26] transition-all cursor-pointer border border-transparent hover:border-[#f43f5e]/20"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2-Column Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto custom-scrollbar flex-1 pr-1">
          {toolsData.map((tool) => {
            const isToolActive = tool.active;
            const isGmailTool = tool.id === "gmail_integration";
            const isDriveTool = tool.id === "google_drive_integration";
            const isTelegramTool = tool.id === "telegram_integration";
            const isWhatsAppTool = tool.id === "whatsapp_integration";
            const showGmailDisconnect = isGmailTool && (isAdmin || isGmailConnected) && isGmailConnected;
            const showDriveDisconnect = isDriveTool && isDriveConnected;
            const showTelegramActions = isTelegramTool && isTelegramLinked;
            const showWhatsAppActions = isWhatsAppTool && isWhatsAppLinked;

            return (
              <div
                key={tool.id}
                role="button"
                tabIndex={0}
                onClick={tool.action}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    tool.action();
                  }
                }}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 text-start group cursor-pointer relative overflow-hidden ${
                  isToolActive
                    ? isTelegramTool
                      ? "bg-[#0088cc]/10 border-[#0088cc] text-[#f1f5f9] shadow-[0_0_15px_rgba(0,136,204,0.15)]"
                      : isWhatsAppTool
                      ? "bg-[#25D366]/10 border-[#25D366] text-[#f1f5f9] shadow-[0_0_15px_rgba(37,211,102,0.15)]"
                      : "bg-[#00d4aa]/10 border-[#00d4aa] text-[#f1f5f9] shadow-[0_0_15px_rgba(0,212,170,0.15)]"
                    : "bg-[#161b26] hover:bg-[#1a2230] border-[#1f2633] hover:border-[#00d4aa]/40 text-[#94a3b8] hover:text-[#f1f5f9]"
                }`}
              >
                {/* Icon block */}
                <div
                  className={`p-2 rounded-lg shrink-0 transition-transform group-hover:scale-105 duration-200 ${
                    isToolActive
                      ? isTelegramTool
                        ? "bg-[#0088cc]/20 text-[#0088cc]"
                        : isWhatsAppTool
                        ? "bg-[#25D366]/20 text-[#25D366]"
                        : "bg-[#00d4aa]/20 text-[#00d4aa]"
                      : "bg-[#132020] text-[#a3c2c2] group-hover:text-[#00d4aa]"
                  }`}
                >
                  {tool.icon}
                </div>

                {/* Content details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                    <span className="text-xs font-bold leading-tight flex items-center gap-1.5">
                      {tool.name}
                      {isTelegramTool && isTelegramLinked && (
                        <span className="px-1.5 py-0.2 bg-[#0088cc]/20 text-[#0088cc] text-[9px] font-bold rounded">
                          {isRtl ? "متصل" : "Linked"}
                        </span>
                      )}
                      {isWhatsAppTool && isWhatsAppLinked && (
                        <span className="px-1.5 py-0.2 bg-[#25D366]/20 text-[#25D366] text-[9px] font-bold rounded">
                          {isRtl ? "متصل" : "Linked"}
                        </span>
                      )}
                      {isDriveTool && isDriveConnected && (
                        <span className="px-1.5 py-0.2 bg-[#0F9D58]/20 text-[#0F9D58] text-[9px] font-bold rounded">
                          {isRtl ? "متصل" : "Linked"}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {/* Admin Disconnect Button for Gmail */}
                      {showGmailDisconnect && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            disconnectGmail();
                            if (isToolActive) {
                              onToggleTool("gmail_integration");
                            }
                          }}
                          className="px-2 py-0.5 text-[9px] font-bold text-[#f43f5e] bg-[#f43f5e]/10 hover:bg-[#f43f5e]/25 border border-[#f43f5e]/30 hover:border-[#f43f5e]/60 rounded-md transition-all flex items-center gap-1 cursor-pointer shrink-0 z-10"
                          title={isRtl ? "إلغاء ربط حساب Gmail" : "Disconnect Gmail"}
                        >
                          <Unlink className="w-2.5 h-2.5" />
                          <span>{isRtl ? "إلغاء الربط" : "Disconnect"}</span>
                        </button>
                      )}

                      {/* Disconnect Button for Google Drive */}
                      {showDriveDisconnect && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            disconnectDrive();
                            if (isToolActive) {
                              onToggleTool("google_drive_integration");
                            }
                          }}
                          className="px-2 py-0.5 text-[9px] font-bold text-[#f43f5e] bg-[#f43f5e]/10 hover:bg-[#f43f5e]/25 border border-[#f43f5e]/30 hover:border-[#f43f5e]/60 rounded-md transition-all flex items-center gap-1 cursor-pointer shrink-0 z-10"
                          title={isRtl ? "إلغاء ربط Google Drive" : "Disconnect Google Drive"}
                        >
                          <Unlink className="w-2.5 h-2.5" />
                          <span>{isRtl ? "إلغاء الربط" : "Disconnect"}</span>
                        </button>
                      )}

                      {/* Disconnect Button for Telegram */}
                      {showTelegramActions && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            unlinkTelegram();
                            if (activeTools.includes("telegram_integration")) {
                              onToggleTool("telegram_integration");
                            }
                          }}
                          className="px-2 py-0.5 text-[9px] font-bold text-[#f43f5e] bg-[#f43f5e]/10 hover:bg-[#f43f5e]/25 border border-[#f43f5e]/30 hover:border-[#f43f5e]/60 rounded-md transition-all flex items-center gap-1 cursor-pointer shrink-0 z-10"
                          title={isRtl ? "إلغاء ربط بوت تيليجرام" : "Unlink Telegram"}
                        >
                          <Unlink className="w-2.5 h-2.5" />
                          <span>{isRtl ? "إلغاء الربط" : "Unlink"}</span>
                        </button>
                      )}

                      {/* Disconnect Button for WhatsApp */}
                      {showWhatsAppActions && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            unlinkWhatsApp();
                            if (activeTools.includes("whatsapp_integration")) {
                              onToggleTool("whatsapp_integration");
                            }
                          }}
                          className="px-2 py-0.5 text-[9px] font-bold text-[#f43f5e] bg-[#f43f5e]/10 hover:bg-[#f43f5e]/25 border border-[#f43f5e]/30 hover:border-[#f43f5e]/60 rounded-md transition-all flex items-center gap-1 cursor-pointer shrink-0 z-10"
                          title={isRtl ? "إلغاء ربط بوت واتساب" : "Unlink WhatsApp"}
                        >
                          <Unlink className="w-2.5 h-2.5" />
                          <span>{isRtl ? "إلغاء الربط" : "Unlink"}</span>
                        </button>
                      )}

                      {isToolActive && !showTelegramActions && !showWhatsAppActions && !showGmailDisconnect && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isTelegramTool
                              ? "bg-[#0088cc] shadow-[0_0_8px_#0088cc]"
                              : isWhatsAppTool
                              ? "bg-[#25D366] shadow-[0_0_8px_#25D366]"
                              : "bg-[#00d4aa] shadow-[0_0_8px_#00d4aa]"
                          } shrink-0`}
                        />
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-[#4a7070] group-hover:text-[#8db3b3] mt-1 leading-normal font-medium">
                    {tool.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom hint */}
        <div className="mt-3 pt-2.5 border-t border-[#1e2e2e]/40 text-center shrink-0">
          <span className="text-[10px] text-[#4a7070] font-mono">
            {isRtl
              ? "انقر لتفعيل/إيقاف أي وضع أو أداة حية للطلب القادم"
              : "Click to toggle skills or configure attachment pipeline"}
          </span>
        </div>

        {/* Telegram Pairing Modal Overlay */}
        <AnimatePresence>
          {showTelegramModal && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-[#0a1111]/95 backdrop-blur-md z-20 flex flex-col p-5 overflow-y-auto custom-scrollbar"
              dir={isRtl ? "rtl" : "ltr"}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#1e2e2e]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#0088cc]/20 border border-[#0088cc]/40 flex items-center justify-center text-[#0088cc]">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#e8f5f5]">
                      {isRtl ? "ربط حسابك ببوت تيليجرام" : "Link Telegram Personal Agent"}
                    </h4>
                    <p className="text-[10px] text-[#5c8a8a]">
                      {isRtl ? "مزامنة الذاكرة الشخصية، الأدوات، والتفاعل الفوري" : "Sync personal memory, tools & live responses"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTelegramModal(false)}
                  className="p-1.5 rounded-lg text-[#5c8a8a] hover:text-white hover:bg-[#152424] transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isTelegramLinked ? (
                <div className="my-auto py-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#00d4aa]/20 border border-[#00d4aa]/40 text-[#00d4aa] flex items-center justify-center mx-auto animate-bounce">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-[#e8f5f5]">
                    {isRtl ? "تم ربط حسابك في تيليجرام بنجاح!" : "Telegram Successfully Linked!"}
                  </h4>
                  <p className="text-xs text-[#5c8a8a] max-w-xs mx-auto">
                    {isRtl
                      ? "يمكنك الآن التحدث مع البوت، إرسال الصور، التسجيلات الصوتية وستتم مزامنة ذاكرتك وسياقك تلقائياً."
                      : "You can now chat with your personal agent on Telegram with synchronized context & memory."}
                  </p>
                  <button
                    onClick={() => setShowTelegramModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#0c1414] bg-[#00d4aa] hover:bg-[#00ffcc] rounded-xl transition-all cursor-pointer shadow-lg"
                  >
                    {isRtl ? "إتمام والعودة للدردشة" : "Done & Return"}
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between py-3 space-y-4">
                  <div className="space-y-3">
                    <div className="bg-[#0e1717] border border-[#1e2e2e] rounded-xl p-3.5 space-y-2">
                      <span className="text-[11px] font-bold text-[#8db3b3] block">
                        {isRtl ? "1. افتح البوت في تطبيق تيليجرام:" : "1. Open the bot on Telegram:"}
                      </span>
                      <a
                        href={deepLink || `https://t.me/${botUsername || "SoufToolsBot"}?start=${pairingCode || ""}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 p-2.5 bg-[#0088cc]/15 hover:bg-[#0088cc]/25 border border-[#0088cc]/40 rounded-lg text-xs font-bold text-[#38bdf8] transition-all cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Send className="w-4 h-4 text-[#0088cc]" />
                          @{botUsername || "SoufToolsBot"}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] bg-[#0088cc]/30 px-2 py-0.5 rounded">
                          {isRtl ? "فتح البوت مباشرة" : "Open Bot Direct"}
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      </a>
                    </div>

                    <div className="bg-[#0e1717] border border-[#1e2e2e] rounded-xl p-3.5 space-y-2">
                      <span className="text-[11px] font-bold text-[#8db3b3] block">
                        {isRtl ? "2. أو أرسل رمز الربط التالي للبوت:" : "2. Or send this pairing code to the bot:"}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[#152424] border border-[#233838] px-3 py-2 rounded-lg text-center font-mono text-sm font-black tracking-widest text-[#00ffcc]">
                          {isGeneratingCode ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto text-[#00ffcc]" />
                          ) : (
                            pairingCode || "SOUF-XXXX"
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          disabled={!pairingCode}
                          className="px-3 py-2 bg-[#1b2b2b] hover:bg-[#243a3a] border border-[#2d4747] text-xs font-bold text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {copiedCode ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#00ffcc]" />
                              <span>{isRtl ? "تم النسخ" : "Copied"}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{isRtl ? "نسخ" : "Copy"}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Polling live feedback */}
                  <div className="bg-[#091010] border border-[#182626] rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0088cc] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0088cc]"></span>
                      </span>
                      <span className="text-[11px] text-[#5c8a8a]">
                        {isRtl ? "في انتظار إرسال الرسالة في تيليجرام..." : "Waiting for activation in Telegram..."}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => checkPairingStatus()}
                      disabled={isChecking}
                      className="text-[10px] text-[#00d4aa] hover:underline font-bold cursor-pointer flex items-center gap-1"
                    >
                      {isChecking && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                      {isRtl ? "تحقق يدوي" : "Check Now"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* WhatsApp Pairing Modal Overlay */}
        <AnimatePresence>
          {showWhatsAppModal && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-[#0a1111]/95 backdrop-blur-md z-20 flex flex-col p-5 overflow-y-auto custom-scrollbar"
              dir={isRtl ? "rtl" : "ltr"}
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#1e2e2e]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#25D366]/20 border border-[#25D366]/40 flex items-center justify-center text-[#25D366]">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-[#e8f5f5]">
                      {isRtl ? "ربط حسابك ببوت واتساب" : "Link WhatsApp Personal Agent"}
                    </h4>
                    <p className="text-[10px] text-[#5c8a8a]">
                      {isRtl ? "مزامنة الذاكرة الشخصية، المهام، التذكيرات الذكية" : "Sync personal memory, tasks & smart reminders"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="p-1.5 rounded-lg text-[#5c8a8a] hover:text-white hover:bg-[#152424] transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isWhatsAppLinked ? (
                <div className="my-auto py-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#25D366]/20 border border-[#25D366]/40 text-[#25D366] flex items-center justify-center mx-auto animate-bounce">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-[#e8f5f5]">
                    {isRtl ? "تم ربط حسابك في واتساب بنجاح!" : "WhatsApp Successfully Linked!"}
                  </h4>
                  {whatsAppPairedPhone && (
                    <div className="inline-block px-3 py-1 bg-[#152424] border border-[#233838] rounded-full text-xs font-mono text-[#25D366]">
                      {whatsAppPairedPhone}
                    </div>
                  )}
                  <p className="text-xs text-[#5c8a8a] max-w-xs mx-auto">
                    {isRtl
                      ? "يمكنك الآن إرسال رسائل صوتية، طلب تذكيرات وجدولة مواعيدك، وستتم مزامنة ذاكرتك تلقائياً."
                      : "You can now chat with your personal agent on WhatsApp with continuous memory & reminders sync."}
                  </p>
                  <button
                    onClick={() => setShowWhatsAppModal(false)}
                    className="px-4 py-2 text-xs font-bold text-[#0c1414] bg-[#25D366] hover:bg-[#20ba59] rounded-xl transition-all cursor-pointer shadow-lg"
                  >
                    {isRtl ? "إتمام والعودة للدردشة" : "Done & Return"}
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between py-3 space-y-4">
                  <div className="space-y-3">
                    <div className="bg-[#0e1717] border border-[#1e2e2e] rounded-xl p-3.5 space-y-2">
                      <span className="text-[11px] font-bold text-[#8db3b3] block">
                        {isRtl ? "1. افتح المحادثة مع بوت واتساب:" : "1. Open chat with WhatsApp bot:"}
                      </span>
                      <a
                        href={whatsAppDeepLink || (whatsAppBotPhoneNumber ? `https://wa.me/${whatsAppBotPhoneNumber.replace(/\D/g, "")}?text=${encodeURIComponent(`ربط ${whatsAppPairingCode || ""}`)}` : "#")}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-2 p-2.5 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/40 rounded-lg text-xs font-bold text-[#25D366] transition-all cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-[#25D366]" />
                          {whatsAppBotPhoneNumber ? `واتساب (${whatsAppBotPhoneNumber})` : (isRtl ? "محادثة البوت" : "Bot Chat")}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] bg-[#25D366]/30 px-2 py-0.5 rounded text-white">
                          {isRtl ? "فتح واتساب مباشرة" : "Open WhatsApp"}
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      </a>
                    </div>

                    <div className="bg-[#0e1717] border border-[#1e2e2e] rounded-xl p-3.5 space-y-2">
                      <span className="text-[11px] font-bold text-[#8db3b3] block">
                        {isRtl ? "2. أو أرسل رمز الاقتران التالي للبوت في واتساب:" : "2. Or send this pairing code on WhatsApp:"}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-[#152424] border border-[#233838] px-3 py-2 rounded-lg text-center font-mono text-sm font-black tracking-widest text-[#25D366]">
                          {isGeneratingWhatsAppCode ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto text-[#25D366]" />
                          ) : (
                            whatsAppPairingCode || "WA-XXXX"
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyWhatsAppCode}
                          disabled={!whatsAppPairingCode}
                          className="px-3 py-2 bg-[#1b2b2b] hover:bg-[#243a3a] border border-[#2d4747] text-xs font-bold text-white rounded-lg transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {copiedWhatsAppCode ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-[#25D366]" />
                              <span>{isRtl ? "تم النسخ" : "Copied"}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{isRtl ? "نسخ" : "Copy"}</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[10px] text-[#5c8a8a]">
                        {isRtl ? `يمكنك إرسال: "ربط ${whatsAppPairingCode || "XXXX"}" في المحادثة مع البوت.` : `Send: "ربط ${whatsAppPairingCode || "XXXX"}" directly to the bot.`}
                      </p>
                    </div>
                  </div>

                  {/* Polling live feedback */}
                  <div className="bg-[#091010] border border-[#182626] rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#25D366]"></span>
                      </span>
                      <span className="text-[11px] text-[#5c8a8a]">
                        {isRtl ? "في انتظار تفعيل الربط عبر واتساب..." : "Waiting for activation in WhatsApp..."}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => checkWhatsAppPairingStatus()}
                      disabled={isCheckingWhatsApp}
                      className="text-[10px] text-[#25D366] hover:underline font-bold cursor-pointer flex items-center gap-1"
                    >
                      {isCheckingWhatsApp && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                      {isRtl ? "تحقق يدوي" : "Check Now"}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
};

