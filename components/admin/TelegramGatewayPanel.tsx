"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  Bot,
  Key,
  Globe,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Power,
  PowerOff,
  Sliders,
  Activity,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  MessageSquare,
  Cpu,
  Terminal,
  Zap,
  CheckCheck
} from "lucide-react";
import { TelegramGatewayConfig, TelegramActivityLog } from "@/lib/telegram/types";
import { copyToClipboard } from "@/lib/utils";

export const TelegramGatewayPanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState<"bot_setup" | "webhook" | "behavior" | "test_dispatch" | "logs">("bot_setup");
  const [config, setConfig] = useState<TelegramGatewayConfig | null>(null);
  const [logs, setLogs] = useState<TelegramActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Bot Verification State
  const [tokenInput, setTokenInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Webhook State
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [webhookFeedback, setWebhookFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [checkingInfo, setCheckingInfo] = useState(false);

  // Test Message State
  const [testChatId, setTestChatId] = useState("");
  const [testMessageText, setTestMessageText] = useState("مرحباً بك! هذه رسالة تجريبية من منصة SoufAI للتأكد من نجاح ربط بوت تيليجرام.");
  const [sendingTest, setSendingTest] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Load config & logs
  const fetchConfig = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/telegram/config");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
          if (data.config.botToken && !tokenInput) {
            setTokenInput(data.config.botToken);
          }
          if (data.config.webhookUrl && !webhookUrlInput) {
            setWebhookUrlInput(data.config.webhookUrl);
          }
        }
        if (data.logs) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch telegram config:", err);
    } finally {
      setLoading(false);
    }
  }, [tokenInput, webhookUrlInput]);

  useEffect(() => {
    fetchConfig();
    const interval = setInterval(fetchConfig, 8000);
    return () => clearInterval(interval);
  }, [fetchConfig]);

  // Detect domain for auto webhook fill on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      setWebhookUrlInput((prev) => prev || `${origin}/api/telegram/webhook`);
    }
  }, []);

  const handleVerifyToken = async () => {
    if (!tokenInput.trim()) {
      setVerifyError("يرجى إدخال رمز البوت (Bot Token) أولاً.");
      return;
    }

    setVerifying(true);
    setVerifyError(null);
    setVerifySuccess(null);

    try {
      const res = await fetch("/api/admin/telegram/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_token", token: tokenInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.bot) {
        setVerifySuccess(`تم الاتصال بالبوت بنجاح: @${data.bot.username} (${data.bot.first_name})`);
        setConfig(data.config);
      } else {
        setVerifyError(data.error || "فشل التحقق من رمز البوت. يرجى التأكد من نسخه بشكل صحيح من @BotFather.");
      }
    } catch (err: any) {
      setVerifyError(err.message || "حدث خطأ أثناء الاتصال بالخادم.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSetWebhook = async () => {
    if (!webhookUrlInput.trim()) {
      setWebhookFeedback({ type: "error", msg: "يرجى كتابة رابط الويب هوك بشكل صحيح." });
      return;
    }

    setSettingWebhook(true);
    setWebhookFeedback(null);

    try {
      const res = await fetch("/api/admin/telegram/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_webhook", webhookUrl: webhookUrlInput.trim() }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setWebhookFeedback({ type: "success", msg: data.description || "تم تفعيل وتسجيل الويب هوك في تيليجرام بنجاح!" });
        setConfig(data.config);
      } else {
        setWebhookFeedback({ type: "error", msg: data.error || "فشل تسجيل الويب هوك في تيليجرام." });
      }
    } catch (err: any) {
      setWebhookFeedback({ type: "error", msg: err.message || "خطأ اتصال أثناء ضبط الويب هوك." });
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleDeleteWebhook = async () => {
    setSettingWebhook(true);
    setWebhookFeedback(null);
    try {
      const res = await fetch("/api/admin/telegram/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_webhook" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWebhookFeedback({ type: "success", msg: "تم إيقاف الويب هوك بنجاح." });
        setConfig(data.config);
      } else {
        setWebhookFeedback({ type: "error", msg: data.error || "فشل إلغاء الويب هوك." });
      }
    } catch (err: any) {
      setWebhookFeedback({ type: "error", msg: err.message || "خطأ أثناء العملية." });
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleGetWebhookInfo = async () => {
    setCheckingInfo(true);
    try {
      const res = await fetch("/api/admin/telegram/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_webhook_info" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWebhookInfo(data.info);
      } else {
        setWebhookFeedback({ type: "error", msg: data.error || "فشل جلب حالة الويب هوك من تيليجرام." });
      }
    } catch (err: any) {
      setWebhookFeedback({ type: "error", msg: err.message || "خطأ اتصال" });
    } finally {
      setCheckingInfo(false);
    }
  };

  const handleSendTestMessage = async () => {
    if (!testChatId.trim()) {
      setTestFeedback({ type: "error", msg: "يرجى إدخال معرف المحادثة (Chat ID) أولاً." });
      return;
    }
    if (!testMessageText.trim()) {
      setTestFeedback({ type: "error", msg: "يرجى كتابة نص الرسالة الاختبارية." });
      return;
    }

    setSendingTest(true);
    setTestFeedback(null);

    try {
      const res = await fetch("/api/admin/telegram/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_test_message",
          chatId: testChatId.trim(),
          message: testMessageText.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestFeedback({ type: "success", msg: `تم إرسال الرسالة بنجاح! رقم الرسالة: #${data.messageId}` });
        setConfig(data.config);
      } else {
        setTestFeedback({ type: "error", msg: data.error || "فشل إرسال الرسالة إلى تيليجرام." });
      }
    } catch (err: any) {
      setTestFeedback({ type: "error", msg: err.message || "خطأ أثناء إرسال الرسالة." });
    } finally {
      setSendingTest(false);
    }
  };

  const handleTestAiResponse = async () => {
    if (!testMessageText.trim()) {
      setTestFeedback({ type: "error", msg: "يرجى كتابة نص الرسالة لاختبار رد الذكاء الاصطناعي." });
      return;
    }

    setTestingAi(true);
    setAiTestResult(null);
    setTestFeedback(null);

    try {
      const res = await fetch("/api/admin/telegram/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_ai_response",
          chatId: testChatId.trim() || "admin_test",
          message: testMessageText.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAiTestResult(data.replyText || "تم توليد الرد بنجاح!");
        if (data.config) setConfig(data.config);
        if (data.logs) setLogs(data.logs);
        setTestFeedback({ type: "success", msg: "تم توليد رد الذكاء الاصطناعي واختبار دورة المعالجة بنجاح!" });
      } else {
        setTestFeedback({ type: "error", msg: data.error || "فشل توليد رد الذكاء الاصطناعي." });
      }
    } catch (err: any) {
      setTestFeedback({ type: "error", msg: err.message || "خطأ اتصال أثناء اختبار الذكاء الاصطناعي." });
    } finally {
      setTestingAi(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/admin/telegram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          botToken: tokenInput.trim() || config.botToken,
          webhookUrl: webhookUrlInput.trim() || config.webhookUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      console.error("Save telegram config error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في فصل اتصال بوت تيليجرام؟")) return;
    try {
      const res = await fetch("/api/admin/telegram/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setTokenInput("");
        setVerifySuccess(null);
      }
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-[#1e2e2e] flex flex-col items-center justify-center min-h-[320px] space-y-4">
        <RefreshCw className="w-8 h-8 text-[#0088cc] animate-spin" />
        <p className="text-sm text-[#88b0b0]">جاري تحميل إعدادات وقنوات اتصال بوت تيليجرام...</p>
      </div>
    );
  }

  const isConnected = config?.connectionStatus === "connected";

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* 1. Header Banner & Status */}
      <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] relative overflow-hidden bg-gradient-to-br from-[#0c1a24] to-[#0a0f0f]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0088cc]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#0088cc]/25 to-[#00d4aa]/25 border border-[#0088cc]/50 flex items-center justify-center text-[#0088cc] shrink-0 shadow-lg shadow-[#0088cc]/20">
              <Send className="w-7 h-7 -translate-x-0.5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold text-[#e8f5f5]">
                  بوابة ربط بوت تيليجرام والوكيل الذكي (Telegram Gateway)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0088cc]/15 text-[#0088cc] border border-[#0088cc]/30">
                  Telegram Bot API
                </span>
              </div>
              <p className="text-xs text-[#88b0b0] mt-1 leading-relaxed max-w-2xl">
                ربط المنصة ببوت تيليجرام الرسمي لاستقبال رسائل المستخدمين، ومعالجة الاستفسارات بنماذج SoufAI، وتفعيل الإشعارات وتوليد الردود والصور تلقائياً.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Indicator */}
            <div
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-sm ${
                isConnected
                  ? "bg-[#0088cc]/15 text-[#0088cc] border-[#0088cc]/40"
                  : "bg-[#111a1a] text-[#88b0b0] border-[#1e2e2e]"
              }`}
            >
              <Send className="w-4 h-4 text-[#0088cc]" />
              <span>
                {isConnected
                  ? `متصل: @${config?.botUsername || "Bot"}`
                  : "غير متصل (بانتظار الرمز)"}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-[#0088cc] animate-pulse" : "bg-gray-500"
                }`}
              />
            </div>

            {/* Save Global Button */}
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-4 py-2 bg-[#0088cc] text-white rounded-xl text-xs font-extrabold hover:bg-[#0077b5] transition-all flex items-center gap-2 shadow-lg shadow-[#0088cc]/20 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{saving ? "جاري الحفظ..." : "حفظ الإعدادات"}</span>
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-[#0088cc]/15 border border-[#0088cc]/40 text-[#0088cc] text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم حفظ كافة إعدادات بوت تيليجرام بنجاح على السيرفر.</span>
          </div>
        )}
      </div>

      {/* 2. Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#1e2e2e] pb-3 overflow-x-auto">
        {[
          { id: "bot_setup", label: "إعداد وربط البوت (Bot Token & Auth)", icon: Key },
          { id: "webhook", label: "الويب هوك والاستقبال الحي (Webhook)", icon: Globe },
          { id: "behavior", label: "سلوك ومحرك الذكاء (AI Instructions)", icon: Sliders },
          { id: "test_dispatch", label: "اختبار الإرسال المباشر (Test Dispatch)", icon: Send },
          { id: "logs", label: "سجل الرسائل والأنشطة (Activity Logs)", icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isActive
                  ? "bg-[#0088cc] text-white shadow-lg shadow-[#0088cc]/20 font-black"
                  : "bg-[#111a1a] text-[#88b0b0] border border-[#1e2e2e] hover:border-[#0088cc]/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= SECTION 1: BOT SETUP ================= */}
      {activeSection === "bot_setup" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-5">
              <div>
                <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#0088cc]" />
                  <span>رمز الوصول السري للبوت (HTTP API Bot Token)</span>
                </h3>
                <p className="text-xs text-[#88b0b0] mt-1">
                  قم بلصق الـ Token الذي حصلت عليه من <strong>@BotFather</strong> بعد إنشاء البوت على تيليجرام.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-[#88b0b0]">
                  Bot Token (من BotFather)
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="مثال: 7123456789:AAFn_XXXXXXX_XXXXXXXXXXXXXXX"
                    className="w-full px-4 py-3 bg-[#0a1111] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#0088cc] font-mono tracking-wider"
                  />
                  {tokenInput && (
                    <button
                      type="button"
                      onClick={() => setTokenInput("")}
                      className="absolute left-3 top-3 text-xs text-[#4a7070] hover:text-white"
                    >
                      مسح
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleVerifyToken}
                    disabled={verifying || !tokenInput.trim()}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#0088cc] to-[#0ea5e9] text-white font-extrabold text-xs rounded-xl hover:opacity-95 transition-all shadow-md shadow-[#0088cc]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {verifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                    <span>{verifying ? "جاري التحقق من تيليجرام..." : "التحقق وربط البوت الآن"}</span>
                  </button>

                  {isConnected && (
                    <button
                      onClick={handleDisconnect}
                      className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <PowerOff className="w-4 h-4" />
                      <span>فصل البوت</span>
                    </button>
                  )}
                </div>

                {verifySuccess && (
                  <div className="p-3.5 rounded-xl bg-[#0088cc]/15 border border-[#0088cc]/40 text-[#0088cc] text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{verifySuccess}</span>
                  </div>
                )}

                {verifyError && (
                  <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Bot Details Card */}
            {isConnected && config && (
              <div className="glass-panel p-6 rounded-2xl border border-[#0088cc]/30 bg-[#0088cc]/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#0088cc]/20 border border-[#0088cc]/40 flex items-center justify-center text-[#0088cc]">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{config.botDisplayName}</h4>
                      <p className="text-xs font-mono text-[#0088cc]">@{config.botUsername}</p>
                    </div>
                  </div>

                  <a
                    href={`https://t.me/${config.botUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#0088cc] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#0077b5] transition-all shadow-md shadow-[#0088cc]/20"
                  >
                    <span>فتح في تيليجرام</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#0a1111] border border-[#1e2e2e]">
                    <span className="text-[#527373] block text-[11px]">حالة الويب هوك</span>
                    <span className={`font-bold ${config.webhookActive ? "text-green-400" : "text-amber-400"}`}>
                      {config.webhookActive ? "مفعّل ونشط (Active)" : "غير مفعل (Polled)"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#0a1111] border border-[#1e2e2e]">
                    <span className="text-[#527373] block text-[11px]">المحادثات المعالجة</span>
                    <span className="font-bold text-white font-mono">{config.totalMessagesReceived} رسالة</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Step-by-Step Guide */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-4">
              <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0088cc]" />
                <span>دليل إنشاء وربط البوت خطوة بخطوة</span>
              </h3>

              <div className="space-y-3 text-xs text-[#88b0b0]">
                <div className="p-3 rounded-xl bg-[#0a1111] border border-[#1e2e2e] space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0088cc]/20 text-[#0088cc] flex items-center justify-center text-[10px]">1</span>
                    <span>التواصل مع BotFather</span>
                  </div>
                  <p className="text-[11px] text-[#527373] pr-7">
                    افتح تيليجرام وابحث عن <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[#0088cc] underline font-mono">@BotFather</a> واضغط Start.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#0a1111] border border-[#1e2e2e] space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0088cc]/20 text-[#0088cc] flex items-center justify-center text-[10px]">2</span>
                    <span>أمر إنشاء البوت الجديد</span>
                  </div>
                  <p className="text-[11px] text-[#527373] pr-7">
                    أرسل الأمر <code className="text-[#00d4aa] font-mono">/newbot</code> ثم اكتب اسم البوت واسم المستخدم (ينتهي بـ bot).
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#0a1111] border border-[#1e2e2e] space-y-1">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#0088cc]/20 text-[#0088cc] flex items-center justify-center text-[10px]">3</span>
                    <span>نسخ الـ Token والربط</span>
                  </div>
                  <p className="text-[11px] text-[#527373] pr-7">
                    انسخ الـ HTTP API Token والصقه في الحقل بالأعلى واضغط على &quot;التحقق وربط البوت الآن&quot;.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 2: WEBHOOK ================= */}
      {activeSection === "webhook" && (
        <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-5">
          <div>
            <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#0088cc]" />
              <span>إعداد مسار الاستقبال اللحظي (Telegram Webhook Endpoint)</span>
            </h3>
            <p className="text-xs text-[#88b0b0] mt-1">
              يقوم الويب هوك بتوجيه كافة الرسائل التي يرسلها مستخدمو تيليجرام مباشرة إلى سيرفر المنصة فور كتابتها لمعالجتها وتوليد الرد بالذكاء الاصطناعي.
            </p>
          </div>

          <div className="space-y-4 max-w-3xl">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#88b0b0]">
                رابط الاستقبال العام (Public Webhook URL)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  value={webhookUrlInput}
                  onChange={(e) => setWebhookUrlInput(e.target.value)}
                  placeholder="https://your-domain.com/api/telegram/webhook"
                  className="flex-1 px-4 py-3 bg-[#0a1111] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#0088cc] font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboard(webhookUrlInput);
                    setCopiedWebhook(true);
                    setTimeout(() => setCopiedWebhook(false), 2500);
                  }}
                  className="px-3 py-3 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#0088cc]/40 text-[#88b0b0] hover:text-white text-xs flex items-center gap-1.5 transition-all"
                >
                  {copiedWebhook ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedWebhook ? "تم النسخ" : "نسخ"}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleSetWebhook}
                disabled={settingWebhook || !isConnected}
                className="px-5 py-2.5 bg-[#0088cc] hover:bg-[#0077b5] text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-[#0088cc]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {settingWebhook ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                <span>{settingWebhook ? "جاري تفعيل الويب هوك..." : "تسجيل وتفعيل الويب هوك الآن"}</span>
              </button>

              <button
                onClick={handleGetWebhookInfo}
                disabled={checkingInfo || !isConnected}
                className="px-4 py-2.5 bg-[#111a1a] hover:bg-[#1a2626] text-[#88b0b0] hover:text-[#0088cc] border border-[#1e2e2e] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {checkingInfo ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                <span>فحص حالة الويب هوك في تيليجرام (Diagnostics)</span>
              </button>

              {config?.webhookActive && (
                <button
                  onClick={handleDeleteWebhook}
                  disabled={settingWebhook}
                  className="px-4 py-2.5 bg-[#111a1a] hover:bg-[#1a2626] text-[#88b0b0] hover:text-red-400 border border-[#1e2e2e] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <PowerOff className="w-4 h-4" />
                  <span>إلغاء تفعيل الويب هوك</span>
                </button>
              )}
            </div>

            {webhookInfo && (
              <div className="p-4 rounded-xl bg-[#091111] border border-[#1e2e2e] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>تقرير حالة الويب هوك من خوادم تيليجرام:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] ${webhookInfo.url ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"}`}>
                    {webhookInfo.url ? "مسجل ونشط" : "غير مسجل"}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#88b0b0] space-y-1">
                  <div>الرابط المسجل في تيليجرام: <span className="text-white break-all">{webhookInfo.url || "لا يوجد (None)"}</span></div>
                  <div>الرسائل المعلقة في الانتظار: <span className="text-white">{webhookInfo.pending_update_count || 0}</span></div>
                  {webhookInfo.last_error_message && (
                    <div className="text-red-400">آخر خطأ من تيليجرام: {webhookInfo.last_error_message}</div>
                  )}
                  {webhookInfo.last_error_date && (
                    <div>توقيت آخر خطأ: {new Date(webhookInfo.last_error_date * 1000).toLocaleTimeString("ar-EG")}</div>
                  )}
                </div>
              </div>
            )}

            {webhookFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  webhookFeedback.type === "success"
                    ? "bg-[#0088cc]/15 border-[#0088cc]/40 text-[#0088cc]"
                    : "bg-red-500/15 border-red-500/40 text-red-400"
                }`}
              >
                {webhookFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{webhookFeedback.msg}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SECTION 3: BEHAVIOR & AI ================= */}
      {activeSection === "behavior" && (
        <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-6">
          <div>
            <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#0088cc]" />
              <span>توجيهات وسلوك الذكاء الاصطناعي للبوت (AI Prompt & Behavior)</span>
            </h3>
            <p className="text-xs text-[#88b0b0] mt-1">
              تخصيص النموذج المعتمد، رسالة الترحيب الأولى عند إرسال /start، والتوجيه الأساسي للرد على استفسارات المستخدمين.
            </p>
          </div>

          <div className="space-y-4 max-w-4xl">
            {/* Auto AI Reply Toggle */}
            <div className="p-4 rounded-xl bg-[#0a1111] border border-[#1e2e2e] flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">الرد التلقائي عبر الذكاء الاصطناعي (Auto AI Reply)</span>
                <span className="text-[11px] text-[#527373]">توليد رد فوري للمستخدم عند إرسال أي رسالة نصية للبوت</span>
              </div>
              <button
                type="button"
                onClick={() => setConfig((prev) => prev ? { ...prev, autoAiReply: !prev.autoAiReply } : null)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  config?.autoAiReply ? "bg-[#0088cc]" : "bg-[#162424]"
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    config?.autoAiReply ? "left-1" : "right-1"
                  }`}
                />
              </button>
            </div>

            {/* Default Model */}
            <div>
              <label className="block text-xs font-bold text-[#88b0b0] mb-2">
                النموذج المعتمد لمعالجة رسائل تيليجرام (من نماذج SoufAI)
              </label>
              <select
                value={config?.defaultModel || "spark"}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, defaultModel: e.target.value } : null)}
                className="w-full sm:w-96 px-4 py-2.5 bg-[#0a1111] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#0088cc]"
              >
                <option value="spark">SoufAI Spark (⚡ الأسرع - استجابة فورية)</option>
                <option value="core">SoufAI Core (🔵 متوازن للاستخدام اليومي)</option>
                <option value="pro">SoufAI Pro (💎 تفكير عميق وأبحاث)</option>
                <option value="ultra">SoufAI Ultra (🚀 أعلى دقة وذكاء)</option>
              </select>
              <p className="text-[11px] text-[#527373] mt-1.5">
                يتم تنفيذ هذا النموذج حصراً وفق المزودات والمفاتيح المسجلة في تبويب &quot;مفاتيح ومزودات الذكاء&quot; بلوحة التحكم.
              </p>
            </div>

            {/* Welcome Message */}
            <div>
              <label className="block text-xs font-bold text-[#88b0b0] mb-2">
                رسالة الترحيب الافتتاحية (Welcome /start Message)
              </label>
              <textarea
                rows={2}
                value={config?.welcomeMessage || ""}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, welcomeMessage: e.target.value } : null)}
                className="w-full px-4 py-2.5 bg-[#0a1111] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#0088cc] resize-none"
              />
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-xs font-bold text-[#88b0b0] mb-2">
                التعليمات البرمجية وهوية الوكيل (System Prompt)
              </label>
              <textarea
                rows={4}
                value={config?.systemPrompt || ""}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, systemPrompt: e.target.value } : null)}
                className="w-full px-4 py-2.5 bg-[#0a1111] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#0088cc] resize-none font-sans"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-6 py-2.5 bg-[#0088cc] hover:bg-[#0077b5] text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-[#0088cc]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>حفظ توجيهات وإعدادات النموذج</span>
              </button>

              {saveSuccess && (
                <span className="text-xs text-[#00d4aa] flex items-center gap-1 font-bold">
                  <CheckCheck className="w-4 h-4" />
                  <span>تم حفظ الإعدادات على السيرفر بنجاح</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 4: TEST DISPATCH ================= */}
      {activeSection === "test_dispatch" && (
        <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-5">
          <div>
            <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
              <Send className="w-5 h-5 text-[#0088cc]" />
              <span>إرسال رسالة تجريبية مباشرة (Direct Test Message Dispatch)</span>
            </h3>
            <p className="text-xs text-[#88b0b0] mt-1">
              اختبر قدرة البوت على إرسال الرسائل فورياً إلى أي مستخدم عبر معرف المحادثة (Chat ID).
            </p>
          </div>

          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-bold text-[#88b0b0] mb-2">
                معرف المحادثة (Chat ID الخاص بك على تيليجرام)
              </label>
              <input
                type="text"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
                placeholder="مثال: 123456789"
                className="w-full px-4 py-2.5 bg-[#0a1111] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#0088cc] font-mono"
              />
              <span className="text-[10px] text-[#527373] mt-1 block">
                ملاحظة: يمكنك معرفة الـ Chat ID الخاص بك بإرسال رسالة إلى بوت <code className="text-[#0088cc]">@userinfobot</code> على تيليجرام.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#88b0b0] mb-2">
                نص الرسالة الاختبارية
              </label>
              <textarea
                rows={3}
                value={testMessageText}
                onChange={(e) => setTestMessageText(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#0a1111] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#0088cc] resize-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                onClick={handleSendTestMessage}
                disabled={sendingTest || !isConnected}
                className="px-5 py-2.5 bg-gradient-to-r from-[#0088cc] to-[#0ea5e9] hover:opacity-95 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-[#0088cc]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {sendingTest ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{sendingTest ? "جاري الإرسال المباشر..." : "إرسال الرسالة إلى تيليجرام"}</span>
              </button>

              <button
                onClick={handleTestAiResponse}
                disabled={testingAi}
                className="px-5 py-2.5 bg-[#162424] hover:bg-[#1f3333] border border-[#0088cc]/30 text-[#00d4aa] font-extrabold text-xs rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {testingAi ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-[#0088cc]" />}
                <span>{testingAi ? "جاري تشغيل الذكاء الاصطناعي..." : "اختبار محاكاة رد الذكاء الاصطناعي"}</span>
              </button>
            </div>

            {aiTestResult && (
              <div className="p-4 rounded-xl bg-[#071010] border border-[#0088cc]/30 space-y-2">
                <span className="text-[11px] font-bold text-[#00d4aa] flex items-center gap-1.5">
                  <Bot className="w-4 h-4 text-[#0088cc]" />
                  <span>نتيجة رد الذكاء الاصطناعي (SoufAI Output):</span>
                </span>
                <p className="text-xs text-[#e8f5f5] whitespace-pre-wrap bg-[#0e1717] p-3 rounded-lg border border-[#1e2e2e]">
                  {aiTestResult}
                </p>
              </div>
            )}

            {testFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  testFeedback.type === "success"
                    ? "bg-[#0088cc]/15 border-[#0088cc]/40 text-[#0088cc]"
                    : "bg-red-500/15 border-red-500/40 text-red-400"
                }`}
              >
                {testFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{testFeedback.msg}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= SECTION 5: ACTIVITY LOGS ================= */}
      {activeSection === "logs" && (
        <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#0088cc]" />
              <span>سجل الرسائل والعمليات الحية (Live Telegram Activity Logs)</span>
            </h3>
            <button
              onClick={fetchConfig}
              className="px-3 py-1.5 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-xs text-[#88b0b0] hover:text-white flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تحديث السجل</span>
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#527373]">
                لا توجد سجلات مراسلات حتى الآن.
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#0a1111] border border-[#1e2e2e] flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.direction === "inbound"
                          ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                          : log.direction === "outbound"
                          ? "bg-[#0088cc]/15 text-[#0088cc] border border-[#0088cc]/30"
                          : "bg-gray-500/15 text-gray-400 border border-gray-500/30"
                      }`}
                    >
                      {log.direction === "inbound" ? "وارد (Inbound)" : log.direction === "outbound" ? "صادر (Outbound)" : "نظام"}
                    </span>
                    <span className="font-mono text-[#88b0b0]">{log.senderName || log.chatId}:</span>
                    <span className="text-[#e8f5f5] truncate max-w-md">{log.content}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-[#527373]">
                    {log.latencyMs && <span className="font-mono text-[#00d4aa]">{log.latencyMs}ms</span>}
                    <span>{new Date(log.timestamp).toLocaleTimeString("ar-EG")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
