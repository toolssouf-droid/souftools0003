"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { motion, AnimatePresence } from "motion/react";
import {
  Mail,
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
} from "lucide-react";
import Link from "next/link";

function TelegramGmailConnectContent({ params }: { params: Promise<{ locale: string }> }) {
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
        const res = await fetch(`/api/telegram/gmail?chatId=${encodeURIComponent(activeKey)}`);
        const data = await res.json();
        if (data.success && data.isConnected) {
          setIsConnected(true);
          setConnectedEmail(data.email || null);
        }
      } catch (err) {
        console.warn("Could not check Telegram Gmail status:", err);
      } finally {
        setCheckingStatus(false);
      }
    }

    checkCurrentStatus();
  }, [activeKey]);

  const handleConnectGmail = async () => {
    if (!activeKey) {
      setErrorMsg(
        isRtl
          ? "يرجى إدخال رمز الربط السريع (مثل GMAIL-8291) أو معرّف المحادثة (Chat ID)."
          : "Please enter your Telegram Pairing Key (e.g. GMAIL-8291) or Chat ID."
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/gmail.readonly");
      provider.addScope("https://www.googleapis.com/auth/gmail.send");
      provider.addScope("https://www.googleapis.com/auth/gmail.compose");
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
      const res = await fetch("/api/telegram/gmail", {
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
          ? `تم ربط بريد Gmail بنجاح مع بوت تيليجرام! (${userEmail})`
          : `Gmail successfully linked to Telegram bot! (${userEmail})`
      );
    } catch (err: any) {
      console.error("Telegram Gmail Link error:", err);
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
      await fetch("/api/telegram/gmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", chatId: activeKey, key: activeKey }),
      });
      setIsConnected(false);
      setConnectedEmail(null);
      setSuccessMsg(isRtl ? "تم إلغاء ربط حساب Gmail بنجاح." : "Gmail disconnected successfully.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed disconnecting.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030708] text-[#f4f8f8] flex flex-col items-center justify-center p-4 sm:p-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Background Subtle Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#00d4aa]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#00a3ff]/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#081212] border border-[#142323] text-xs font-mono text-[#00d4aa]">
            <Bot className="w-4 h-4 text-[#00d4aa]" />
            <span>SoufAI Telegram Gateway</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ea4335]/20 to-[#ea4335]/5 border border-[#ea4335]/30 flex items-center justify-center shadow-lg shadow-[#ea4335]/10">
              <Mail className="w-6 h-6 text-[#ea4335]" />
            </div>
            <div className="text-2xl font-light text-[#506e6e]">+</div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00d4aa]/20 to-[#00d4aa]/5 border border-[#00d4aa]/30 flex items-center justify-center shadow-lg shadow-[#00d4aa]/10">
              <Send className="w-6 h-6 text-[#00d4aa]" />
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#f4f8f8]">
            {isRtl ? "ربط بريد Gmail ببوت تيليجرام" : "Connect Gmail to Telegram Bot"}
          </h1>
          <p className="text-xs sm:text-sm text-[#8da5a5] max-w-sm mx-auto leading-relaxed">
            {isRtl
              ? "تمكّن من قراءة بريدك الإلكتروني، البحث في الرسائل الواردة، وإرسال الإيميلات بصوتك أو نصك مباشرة من داخل محادثة تيليجرام."
              : "Read incoming emails, search inbox, and send emails directly from your Telegram bot conversation."}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-[#060c0d]/90 backdrop-blur-2xl border border-[#122020] rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
          {checkingStatus ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3">
              <RefreshCw className="w-7 h-7 text-[#00d4aa] animate-spin" />
              <span className="text-xs font-mono text-[#8da5a5]">
                {isRtl ? "جاري التحقق من حالة الربط..." : "Checking connection status..."}
              </span>
            </div>
          ) : (
            <>
              {/* Pairing Key Input Section */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-[#8da5a5] flex items-center justify-between">
                  <span>{isRtl ? "رمز الربط أو معرّف المحادثة (Pairing Key / Chat ID)" : "Pairing Key or Chat ID"}</span>
                  {activeKey && (
                    <span className="text-[10px] font-mono text-[#00d4aa] bg-[#00d4aa]/10 px-2 py-0.5 rounded-full">
                      {isRtl ? "كود نشط" : "Active Code"}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder={isRtl ? "أدخل كود الربط (مثل GMAIL-8291) أو Chat ID" : "Enter pairing code (e.g. GMAIL-8291) or Chat ID"}
                    className="w-full bg-[#081212] border border-[#142323] focus:border-[#00d4aa] rounded-2xl px-4 py-3 text-xs text-[#f4f8f8] placeholder-[#405858] font-mono outline-none transition-all"
                  />
                </div>
                <p className="text-[10px] text-[#506e6e] leading-relaxed">
                  {isRtl
                    ? "يمكنك الحصول على كود الربط بإرسال /gmail داخل بوت تيليجرام، أو إدخال Chat ID الخاص بك مباشرة."
                    : "Get your code by sending /gmail in Telegram bot, or type your Chat ID."}
                </p>
              </div>

              {/* Status Banner */}
              {isConnected ? (
                <div className="p-4 rounded-2xl bg-[#00d4aa]/10 border border-[#00d4aa]/30 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-[#00d4aa] font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{isRtl ? "حساب Gmail مرتبط بنجاح! 🟢" : "Gmail Connected Successfully! 🟢"}</span>
                  </div>
                  {connectedEmail && (
                    <p className="font-mono text-[11px] text-[#a0c2c2] break-all">
                      {isRtl ? "البريد الإلكتروني: " : "Email: "}
                      <span className="text-[#f4f8f8]">{connectedEmail}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-[#8da5a5] leading-relaxed pt-1">
                    {isRtl
                      ? "يمكنك الآن العودة لتطبيق تيليجرام وسؤال البوت: 'فحص الجيميل'، 'هل لدي رسائل جديدة؟'، أو 'إرسال بريد إلكتروني'."
                      : "You can now go back to Telegram and ask: 'Check Gmail', 'Read unread emails', or 'Send an email'."}
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-[#081212] border border-[#142323] text-xs space-y-3">
                  <div className="flex items-center gap-2 text-[#8da5a5] font-semibold">
                    <ShieldCheck className="w-4 h-4 text-[#00d4aa]" />
                    <span>{isRtl ? "ربط آمن بمعايير Google OAuth 2.0" : "Secure Google OAuth 2.0 Integration"}</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-[#6d8a8a] list-disc list-inside">
                    <li>{isRtl ? "قراءة وفحص الرسائل الواردة بطلبك فقط." : "Read and search inbox only when requested."}</li>
                    <li>{isRtl ? "إرسال الإيميلات بخصوصية وأمان تام." : "Send emails securely upon your request."}</li>
                    <li>{isRtl ? "يمكنك إلغاء الربط في أي وقت بنقرة واحدة." : "You can disconnect anytime with 1-click."}</li>
                  </ul>
                </div>
              )}

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Success Alert */}
              {successMsg && !isConnected && (
                <div className="p-3.5 rounded-2xl bg-[#00d4aa]/10 border border-[#00d4aa]/30 text-[#00d4aa] text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {!isConnected ? (
                  <button
                    onClick={handleConnectGmail}
                    disabled={loading}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#ea4335] via-[#4285f4] to-[#00d4aa] text-white font-bold text-xs sm:text-sm shadow-xl shadow-[#ea4335]/20 hover:opacity-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{isRtl ? "جاري الاتصال بـ Google..." : "Connecting to Google..."}</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>{isRtl ? "تسجيل الدخول وربط حساب Gmail" : "Sign In & Connect Gmail Account"}</span>
                        <ArrowRight className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2.5">
                    <button
                      onClick={handleConnectGmail}
                      disabled={loading}
                      className="w-full py-3 px-4 rounded-2xl bg-[#0d1a1a] hover:bg-[#122424] border border-[#1a3030] text-[#00d4aa] font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                      <span>{isRtl ? "تحديث أو تبديل حساب Gmail" : "Refresh or Switch Gmail Account"}</span>
                    </button>

                    <button
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="w-full py-2.5 px-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>{isRtl ? "إلغاء ربط Gmail من تيليجرام" : "Disconnect Gmail from Telegram"}</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer Back Link */}
          <div className="pt-4 border-t border-[#0f1b1b] flex items-center justify-between text-[11px] text-[#506e6e]">
            <span>SoufAI System Engine</span>
            <Link href={`/${locale}`} className="hover:text-[#00d4aa] transition-colors flex items-center gap-1">
              <span>{isRtl ? "الانتقال للمنصة" : "Go to Platform"}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TelegramGmailConnectPage({ params }: { params: Promise<{ locale: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#030708] flex items-center justify-center text-[#8da5a5] font-mono text-xs">
          Loading...
        </div>
      }
    >
      <TelegramGmailConnectContent params={params} />
    </Suspense>
  );
}
