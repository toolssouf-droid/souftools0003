"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";
import {
  HardDrive,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Send,
  Search,
  Sparkles,
  Bot,
  ExternalLink,
  FileText,
  Brain,
} from "lucide-react";
import Link from "next/link";

function TelegramDriveConnectContent({ params }: { params: Promise<{ locale: string }> }) {
  const [locale, setLocale] = useState("ar");
  const searchParams = useSearchParams();
  const urlChatId = searchParams.get("chatId") || "";
  const urlKey = searchParams.get("key") || "";

  const [inputKey, setInputKey] = useState(urlKey || urlChatId || "");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setLocale(p.locale || "ar"));
  }, [params]);

  const isRtl = locale === "ar";
  const activeKey = (inputKey || urlKey || urlChatId || "").trim();

  useEffect(() => {
    if (!activeKey) {
      setCheckingStatus(false);
      return;
    }

    async function checkCurrentStatus() {
      try {
        const res = await fetch(`/api/telegram/drive?chatId=${encodeURIComponent(activeKey)}`);
        const data = await res.json();
        if (data.success && data.isConnected) {
          setIsConnected(true);
          setConnectedEmail(data.email || null);
        }
      } catch (err) {
        console.warn("Could not check Telegram Google Drive status:", err);
      } finally {
        setCheckingStatus(false);
      }
    }

    checkCurrentStatus();
  }, [activeKey]);

  const handleConnectDrive = async () => {
    if (!activeKey) {
      setErrorMsg(
        isRtl
          ? "يرجى إدخال رمز الربط السريع (مثل DRIVE-4391) أو معرّف المحادثة (Chat ID)."
          : "Please enter your Telegram Pairing Key (e.g. DRIVE-4391) or Chat ID."
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/drive.readonly");
      provider.addScope("https://www.googleapis.com/auth/drive.file");
      provider.setCustomParameters({
        prompt: "select_account consent",
        access_type: "offline",
      });

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken || null;
      const userEmail = result.user?.email || null;

      if (!token) {
        throw new Error(
          isRtl
            ? "لم يتم الحصول على رمز الوصول من Google."
            : "No access token retrieved from Google."
        );
      }

      // Save token to Telegram backend
      const res = await fetch("/api/telegram/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: activeKey,
          key: activeKey,
          accessToken: token,
          email: userEmail,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(
          data.error ||
            (isRtl ? "فشل ربط الحساب مع السيرفر." : "Failed saving token on server.")
        );
      }

      setIsConnected(true);
      setConnectedEmail(userEmail);
      setSuccessMsg(
        isRtl
          ? `تم ربط Google Drive بنجاح مع بوت تيليجرام! (${userEmail})`
          : `Google Drive successfully linked to Telegram bot! (${userEmail})`
      );
    } catch (err: any) {
      console.error("Telegram Google Drive Link error:", err);
      setErrorMsg(
        err.message ||
          (isRtl
            ? "حدث خطأ أثناء الاتصال بحساب Google."
            : "Authentication error occurred.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!activeKey) return;
    setLoading(true);
    try {
      await fetch("/api/telegram/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", chatId: activeKey, key: activeKey }),
      });
      setIsConnected(false);
      setConnectedEmail(null);
      setSuccessMsg(
        isRtl
          ? "تم إلغاء ربط حساب Google Drive بنجاح."
          : "Google Drive disconnected successfully."
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed disconnecting.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#030708] text-[#f4f8f8] flex flex-col items-center justify-center p-4 sm:p-6"
      dir={isRtl ? "rtl" : "ltr"}
    >
      {/* Background Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#0F9D58]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#4285F4]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#0F9D58]/20 to-[#4285F4]/20 border border-[#0F9D58]/30 mb-4 shadow-[0_0_25px_rgba(15,157,88,0.2)]">
            <HardDrive className="w-8 h-8 text-[#0F9D58]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-[#e8f5f5] to-[#a3c2c2] bg-clip-text text-transparent">
            {isRtl ? "تكامل Google Drive والذاكرة" : "Google Drive & Memory Integration"}
          </h1>
          <p className="text-xs text-[#a3c2c2] mt-1.5 max-w-xs mx-auto">
            {isRtl
              ? "ربط مستندات Google Drive ببوت تيليجرام ومزامنتها تلقائياً مع نظام الذاكرة الشخصية في SoufAI."
              : "Connect your Google Drive files with Telegram Bot and sync with your personal SoufAI memory."}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#0b1313]/80 border border-[#1e2e2e] rounded-2xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait">
            {checkingStatus ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 flex flex-col items-center justify-center text-center space-y-3"
              >
                <RefreshCw className="w-8 h-8 text-[#0F9D58] animate-spin" />
                <p className="text-sm text-[#a3c2c2]">
                  {isRtl ? "جارٍ التحقق من حالة الاتصال..." : "Checking connection status..."}
                </p>
              </motion.div>
            ) : (
              <div className="space-y-6">
                {/* Pairing Key Input Section */}
                <div className="space-y-2 text-right">
                  <label className="text-[11px] font-semibold text-[#a3c2c2] flex items-center justify-between">
                    <span>{isRtl ? "رمز الربط أو معرّف المحادثة (Pairing Key / Chat ID)" : "Pairing Key or Chat ID"}</span>
                    {activeKey && (
                      <span className="text-[10px] font-mono text-[#0F9D58] bg-[#0F9D58]/10 px-2 py-0.5 rounded-full border border-[#0F9D58]/20">
                        {isRtl ? "كود نشط" : "Active Code"}
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder={isRtl ? "أدخل كود الربط (مثل DRIVE-4391) أو Chat ID" : "Enter pairing code (e.g. DRIVE-4391) or Chat ID"}
                    className="w-full bg-[#081212] border border-[#1e2e2e] focus:border-[#0F9D58] rounded-xl px-4 py-3 text-xs text-[#f4f8f8] placeholder-[#506e6e] font-mono outline-none transition-all"
                  />
                  <p className="text-[10px] text-[#6d8a8a] leading-relaxed">
                    {isRtl
                      ? "يمكنك الحصول على كود الربط بإرسال /drive داخل بوت تيليجرام، أو إدخال Chat ID الخاص بك مباشرة."
                      : "Get your code by sending /drive in Telegram bot, or type your Chat ID."}
                  </p>
                </div>

                {/* Status Banner */}
                {isConnected ? (
              <motion.div
                key="connected"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-[#0F9D58]/10 border border-[#0F9D58]/30 text-[#0F9D58] flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(15,157,88,0.2)]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-[#0F9D58]/10 border border-[#0F9D58]/30 text-[#0F9D58] text-xs font-semibold mb-2">
                    {isRtl ? "حساب متصل ونشط" : "Active & Connected"}
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    {connectedEmail || (isRtl ? "حساب Google Drive" : "Google Drive Account")}
                  </h3>
                  <p className="text-xs text-[#a3c2c2] mt-1">
                    {isRtl
                      ? "بوت تيليجرام يستطيع الآن فحص مستنداتك وتحليلها وحفظ خلاصاتها في ذاكرتك."
                      : "Telegram bot can now inspect your documents and store their summaries in memory."}
                  </p>
                </div>

                <div className="bg-[#132020] rounded-xl p-3 text-start space-y-2 text-xs text-[#a3c2c2] border border-[#1e2e2e]">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <Sparkles className="w-4 h-4 text-[#0F9D58]" />
                    <span>{isRtl ? "طريقة الاستخدام في تيليجرام:" : "How to use in Telegram:"}</span>
                  </div>
                  <ul className="space-y-1.5 list-disc list-inside text-[11px] leading-relaxed">
                    <li>{isRtl ? "أرسل 'فحص مستندات درايف' أو 'ابحث عن [كلمة] في درايف'" : "Send 'search drive for [keyword]'"}</li>
                    <li>{isRtl ? "أرسل أي رابط Google Docs مباشرة لتحليله وحفظه بالذاكرة" : "Send any Google Docs link to parse and store in memory"}</li>
                    <li>{isRtl ? "اسأل 'ماذا تعرف عن ملفاتي من درايف؟' وسيجيبك AI من الذاكرة" : "Ask 'What do you know from my Drive?' and AI responds from memory"}</li>
                  </ul>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleDisconnect}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                    <span>{isRtl ? "إلغاء ربط Google Drive" : "Disconnect Google Drive"}</span>
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="not-connected"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                <div className="text-center space-y-1">
                  <h3 className="text-base font-bold text-white">
                    {isRtl ? "ربط Google Drive بالبوت" : "Connect Google Drive"}
                  </h3>
                  <p className="text-xs text-[#a3c2c2]">
                    {isRtl
                      ? "اضغط على الزر أدناه وسجّل دخولك بحساب Google للتصريح الآمن."
                      : "Click below and log in with your Google account for secure authorization."}
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 rounded-xl bg-[#0F9D58]/10 border border-[#0F9D58]/30 text-[#0F9D58] text-xs flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  onClick={handleConnectDrive}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0F9D58] to-[#4285F4] hover:opacity-95 text-white text-xs font-bold transition-all shadow-[0_0_20px_rgba(15,157,88,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <HardDrive className="w-4 h-4" />
                  )}
                  <span>
                    {isRtl ? "تسجيل الدخول والتصريح بنقرة واحدة" : "Connect Google Drive Account"}
                  </span>
                </button>

                <div className="flex items-center gap-2 text-[11px] text-[#a3c2c2] bg-[#132020] p-2.5 rounded-xl border border-[#1e2e2e]">
                  <ShieldCheck className="w-4 h-4 text-[#0F9D58] shrink-0" />
                  <span>
                    {isRtl
                      ? "ربط آمن ومشفر 100%. يمكنك إلغاء الربط في أي وقت بنقرة واحدة."
                      : "100% secure OAuth connection. Disconnect anytime."}
                  </span>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function TelegramDriveConnectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#030708] flex items-center justify-center text-white text-sm">
          <RefreshCw className="w-6 h-6 animate-spin text-[#0F9D58]" />
        </div>
      }
    >
      <TelegramDriveConnectContent params={params} />
    </Suspense>
  );
}
