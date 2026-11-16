"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Mail,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Copy,
  Check,
  Power,
  PowerOff,
  Bot,
  Bell,
  ShieldCheck,
  Zap,
  Radio,
  ExternalLink,
  PhoneCall,
  Clock,
  AtSign,
  UserCheck,
  FileText,
  Sliders,
  Activity,
  Sparkles,
  Database,
} from "lucide-react";
import { getAuthCookie } from "@/lib/authCookies";
import { WhatsAppGatewayConfig, WhatsAppActivityLog, WhatsAppPairingMethod } from "@/lib/whatsapp/types";
import { useGmailStore } from "@/store/gmailStore";
import { copyToClipboard } from "@/lib/utils";
import { normalizeAndFixEmailAddress, getEmailDomainSuggestions } from "@/lib/utils/emailFormatter";
import { TelegramGatewayPanel } from "./TelegramGatewayPanel";

export const WhatsAppGatewayPanel: React.FC = () => {
  // Main Panel Tab: "whatsapp" | "telegram" | "gmail" | "behavior" | "logs"
  const [activeSection, setActiveSection] = useState<"whatsapp" | "telegram" | "gmail" | "behavior" | "logs">("whatsapp");

  // Configuration & Logs
  const [config, setConfig] = useState<WhatsAppGatewayConfig | null>(null);
  const [logs, setLogs] = useState<WhatsAppActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState("");

  // WhatsApp Pairing State
  const [activeMethod, setActiveMethod] = useState<WhatsAppPairingMethod>("qr");
  const [phoneInput, setPhoneInput] = useState("");
  const [qrGenerating, setQrGenerating] = useState(false);
  const [pairingCodeLoading, setPairingCodeLoading] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  // WhatsApp Test Message State
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("مرحباً بك! هذه رسالة تجريبية من وكيل منصة SoufAI الذكي عبر واتساب.");
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // Gmail OAuth Store Integration
  const {
    isConnected: isGmailConnected,
    email: connectedGmailAddress,
    connectGmail,
    disconnectGmail,
    accessToken: gmailAccessToken,
  } = useGmailStore();

  // Agent Dedicated Gmail Form State
  const [agentEmail, setAgentEmail] = useState("souftoolsheb@gmail.com");
  const [agentDisplayName, setAgentDisplayName] = useState("سوف - الوكيل الذكي المستقل (SoufAI Agent)");
  const [agentEmailSignature, setAgentEmailSignature] = useState(
    "—\nتم الإرسال والمراقبة بواسطة الوكيل الذكي المستقل SoufAI Agent\nالمنصة: SoufTools V2"
  );
  const [agentEmailAutoSend, setAgentEmailAutoSend] = useState(true);
  const [agentEmailNotifyOnTasks, setAgentEmailNotifyOnTasks] = useState(true);
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [gmailConnectError, setGmailConnectError] = useState<string | null>(null);

  // Gmail Live Test Dispatch State
  const [testEmailTo, setTestEmailTo] = useState("");
  const [testEmailSubject, setTestEmailSubject] = useState("رسالة اختبارية من الوكيل الذكي SoufAI");
  const [testEmailBody, setTestEmailBody] = useState(
    "مرحباً بك،\n\nهذه رسالة اختبارية لتأكيد ربط وجاهزية حساب البريد الإلكتروني الرسمي الخاص بالوكيل الذكي SoufAI.\n\nالوكيل جاهز الآن للاستيقاظ وتنفيذ ومراقبة كافة المهام المجدولة وإرسال التنبيهات المباشرة."
  );
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailSuccess, setTestEmailSuccess] = useState(false);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);

  const isInitialConfigLoadedRef = React.useRef(false);

  // Load configuration & logs
  const fetchConfig = async () => {
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = {};
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/whatsapp/config", { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
          // Only set activeMethod on initial fetch to avoid overriding user's active tab
          if (!isInitialConfigLoadedRef.current) {
            setActiveMethod(data.config.pairingMethod || "qr");
            if (data.config.agentPhoneNumber) {
              setPhoneInput(data.config.agentPhoneNumber);
            }
            isInitialConfigLoadedRef.current = true;
          }
          if (data.config.agentEmail) {
            setAgentEmail(data.config.agentEmail);
          }
          if (data.config.agentDisplayName) {
            setAgentDisplayName(data.config.agentDisplayName);
          }
          if (data.config.agentEmailSignature) {
            setAgentEmailSignature(data.config.agentEmailSignature);
          }
          if (typeof data.config.agentEmailAutoSend === "boolean") {
            setAgentEmailAutoSend(data.config.agentEmailAutoSend);
          }
          if (typeof data.config.agentEmailNotifyOnTasks === "boolean") {
            setAgentEmailNotifyOnTasks(data.config.agentEmailNotifyOnTasks);
          }
        }
        if (data.logs) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch gateway config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
    const intervalMs = config?.connectionStatus === "waiting_scan" || config?.connectionStatus === "connecting" ? 2500 : 8000;
    const interval = setInterval(fetchConfig, intervalMs);
    return () => clearInterval(interval);
  }, [config?.connectionStatus]);

  // Save all settings (WhatsApp + Gmail)
  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/whatsapp/config", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          ...config,
          pairingMethod: activeMethod,
          agentPhoneNumber: phoneInput || config.agentPhoneNumber,
          agentEmail,
          agentDisplayName,
          agentEmailSignature,
          agentEmailAutoSend,
          agentEmailNotifyOnTasks,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      }
    } catch (err) {
      console.error("Save config error:", err);
    } finally {
      setSaving(false);
    }
  };

  // WhatsApp: Generate QR code
  const handleGenerateQR = async () => {
    setActiveMethod("qr");
    setQrGenerating(true);
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/whatsapp/session", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ action: "generate_qr" }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch (err) {
      console.error("QR Error:", err);
    } finally {
      setQrGenerating(false);
    }
  };

  // WhatsApp: Request Pairing Code
  const handleRequestPairingCode = async () => {
    setActiveMethod("code");
    if (!phoneInput.trim()) {
      setPairingError("يرجى إدخال رقم الهاتف أولاً");
      return;
    }
    setPairingCodeLoading(true);
    setPairingError(null);
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/whatsapp/session", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ action: "request_pairing_code", phoneNumber: phoneInput.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setConfig(data.config);
        if (data.formattedPhone) {
          setPhoneInput(data.formattedPhone);
          setTestPhone(data.formattedPhone);
        }
      } else {
        setPairingError(data.error || "فشل توليد رمز الاقتران للرقم المحدد");
      }
    } catch (err: any) {
      console.error("Pairing Code Error:", err);
      setPairingError(err.message || "حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setPairingCodeLoading(false);
    }
  };

  // WhatsApp: Confirm Pairing Connection
  const handleConfirmConnection = async (phoneNumber?: string) => {
    setPairingCodeLoading(true);
    setPairingError(null);
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/whatsapp/session", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          action: "confirm_connection",
          phoneNumber: phoneNumber || phoneInput.trim() || config?.agentPhoneNumber || "+966501234567",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setConfig(data.config);
        if (data.config?.connectedNumber) {
          setTestPhone(data.config.connectedNumber);
        }
      } else {
        setPairingError(data?.error || "فشل تأكيد اقتران الجلسة");
      }
    } catch (err: any) {
      console.error("Confirm Connection Error:", err);
      setPairingError(err.message || "حدث خطأ أثناء تأكيد الاقتران");
    } finally {
      setPairingCodeLoading(false);
    }
  };

  // WhatsApp: Disconnect
  const handleDisconnect = async () => {
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/whatsapp/session", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ action: "disconnect" }),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
      }
    } catch (err) {
      console.error("Disconnect Error:", err);
    }
  };

  // WhatsApp: Send Test Message
  const handleSendTestMessage = async () => {
    if (!testPhone.trim() || !testMessage.trim()) return;
    setTestSending(true);
    setTestSuccess(false);
    setTestError(null);
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/whatsapp/session", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          action: "send_test",
          to: testPhone.trim(),
          message: testMessage.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestSuccess(true);
        setTimeout(() => setTestSuccess(false), 5000);
        fetchConfig();
      } else {
        setTestError(data?.error || "فشل إرسال الرسالة الاختبارية");
      }
    } catch (err: any) {
      setTestError(err.message || "خطأ أثناء الاتصال بالخادم");
    } finally {
      setTestSending(false);
    }
  };

  // Gmail: Connect Agent Account
  const handleConnectGmail = async () => {
    setGmailConnecting(true);
    setGmailConnectError(null);
    try {
      const token = await connectGmail();
      if (token) {
        handleSaveConfig();
      }
    } catch (err: any) {
      console.error("Gmail OAuth error:", err);
      setGmailConnectError(err.message || "حدث خطأ أثناء فتح نافذة الربط مع Google");
    } finally {
      setGmailConnecting(false);
    }
  };

  // Gmail: Send Test Email
  const handleSendTestEmail = async () => {
    if (!testEmailTo.trim() || !testEmailSubject.trim() || !testEmailBody.trim()) {
      setTestEmailError("يرجى ملء جميع حقول الرسالة الاختبارية.");
      return;
    }

    if (!gmailAccessToken) {
      setTestEmailError("حساب Gmail غير متصل بتفويض OAuth. يرجى الضغط على زر ربط الحساب أولاً.");
      return;
    }

    setTestEmailSending(true);
    setTestEmailSuccess(false);
    setTestEmailError(null);

    try {
      const fullBody = agentEmailSignature
        ? `${testEmailBody.trim()}\n\n${agentEmailSignature}`
        : testEmailBody.trim();

      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmailTo.trim(),
          subject: testEmailSubject.trim(),
          emailBody: fullBody,
          token: gmailAccessToken,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestEmailSuccess(true);
        setTimeout(() => setTestEmailSuccess(false), 6000);
      } else {
        setTestEmailError(data?.error || "فشل في تسليم الرسالة إلى خادم Gmail");
      }
    } catch (err: any) {
      setTestEmailError(err.message || "حدث خطأ غير متوقع أثناء إرسال البريد");
    } finally {
      setTestEmailSending(false);
    }
  };

  // Copy pairing code to clipboard
  const handleCopyCode = async (code: string) => {
    await copyToClipboard(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  if (loading) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-[#1e2e2e] flex flex-col items-center justify-center min-h-[320px] space-y-4">
        <RefreshCw className="w-8 h-8 text-[#00d4aa] animate-spin" />
        <p className="text-sm text-[#88b0b0]">جاري تحميل إعدادات وقنوات اتصال الوكيل الذكي...</p>
      </div>
    );
  }

  const isConnected = config?.connectionStatus === "connected";

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* 1. Header Banner & Channel Status */}
      <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] relative overflow-hidden bg-gradient-to-br from-[#111a1a] to-[#0a0f0f]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00d4aa]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00d4aa]/20 to-[#0ea5e9]/20 border border-[#00d4aa]/40 flex items-center justify-center text-[#00d4aa] shrink-0 shadow-lg shadow-[#00d4aa]/10">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold text-[#e8f5f5]">
                  بوابة ربط واتساب وحساب الوكيل وجيميل (Agent Channels Hub)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30">
                  SoufAI Autonomous Agent V2
                </span>
              </div>
              <p className="text-xs text-[#88b0b0] mt-1 leading-relaxed max-w-2xl">
                إدارة الهوية الرقمية للوكيل المستقل: ربط رقم واتساب عبر الباركود أو رمز الاقتران، وإدارة حساب البريد الإلكتروني المخصص (Gmail) لإرسال التنبيهات وتنفيذ ومراقبة المهام المجدولة.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* WhatsApp Status Chip */}
            <div
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-sm ${
                isConnected
                  ? "bg-[#25D366]/15 text-[#25D366] border-[#25D366]/40"
                  : "bg-[#111a1a] text-[#88b0b0] border-[#1e2e2e]"
              }`}
            >
              <MessageSquare className="w-4 h-4 text-[#25D366]" />
              <span>واتساب: {isConnected ? "متصل بنجاح" : "غير متصل"}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-[#25D366] animate-pulse" : "bg-gray-500"
                }`}
              />
            </div>

            {/* Gmail Status Chip */}
            <div
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-sm ${
                isGmailConnected
                  ? "bg-[#ea4335]/15 text-[#ea4335] border-[#ea4335]/40"
                  : "bg-[#111a1a] text-[#88b0b0] border-[#1e2e2e]"
              }`}
            >
              <Mail className="w-4 h-4 text-[#ea4335]" />
              <span>جيميل: {isGmailConnected ? "متصل ومفوض" : "غير متصل"}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isGmailConnected ? "bg-[#ea4335] animate-pulse" : "bg-gray-500"
                }`}
              />
            </div>

            {/* Save Global Button */}
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-4 py-2 bg-[#00d4aa] text-[#0a0f0f] rounded-xl text-xs font-extrabold hover:bg-[#00b894] transition-all flex items-center gap-2 shadow-lg shadow-[#00d4aa]/20 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{saving ? "جاري الحفظ..." : "حفظ الإعدادات"}</span>
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/40 text-[#00d4aa] text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>تم حفظ كافة إعدادات الوكيل، البريد الإلكتروني، وقناة واتساب بنجاح في قاعدة البيانات.</span>
          </div>
        )}
      </div>

      {/* 2. Sub-Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#1e2e2e] pb-3 overflow-x-auto">
        {[
          { id: "whatsapp", label: "ربط واتساب والاقتران (WhatsApp)", icon: MessageSquare },
          { id: "telegram", label: "ربط بوت تيليجرام (Telegram Bot)", icon: Send },
          { id: "gmail", label: "حساب الوكيل وجيميل (Agent Gmail & Identity)", icon: Mail },
          { id: "behavior", label: "توجيهات وسلوك الوكيل (AI Instructions)", icon: Sliders },
          { id: "logs", label: "سجل الأنشطة والمراسلات (Live Activity)", icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isActive
                  ? "bg-[#00d4aa] text-[#0a0f0f] shadow-lg shadow-[#00d4aa]/20 font-black"
                  : "bg-[#111a1a] text-[#88b0b0] border border-[#1e2e2e] hover:border-[#00d4aa]/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= SECTION 1: WHATSAPP GATEWAY ================= */}
      {activeSection === "whatsapp" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Pairing & Connection (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-[#25D366]" />
                    <span>طريقة الربط والاقتران بواتساب (Pairing Method)</span>
                  </h3>
                  <p className="text-xs text-[#88b0b0] mt-1">
                    اختر الطريقة المفضلة لديك للربط: عبر مسح الباركود (QR Code) أو بإدخال رقم الهاتف واستلام رمز اقتران فوري.
                  </p>
                </div>

                {isConnected && (
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <PowerOff className="w-3.5 h-3.5" />
                    <span>فصل الاتصال</span>
                  </button>
                )}
              </div>

              {/* Method Switcher */}
              <div className="grid grid-cols-2 gap-3 p-1 bg-[#0a0f0f] rounded-xl border border-[#1e2e2e]">
                <button
                  onClick={() => setActiveMethod("qr")}
                  className={`py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeMethod === "qr"
                      ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md font-extrabold"
                      : "text-[#88b0b0] hover:text-[#e8f5f5]"
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>الربط عبر الباركود (QR Code)</span>
                </button>

                <button
                  onClick={() => setActiveMethod("code")}
                  className={`py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    activeMethod === "code"
                      ? "bg-[#00d4aa] text-[#0a0f0f] shadow-md font-extrabold"
                      : "text-[#88b0b0] hover:text-[#e8f5f5]"
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>الربط برقم الهاتف (Pairing Code)</span>
                </button>
              </div>

              {/* Connection Status Box */}
              <div className="p-4 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      isConnected
                        ? "bg-[#25D366] animate-pulse"
                        : config?.connectionStatus === "waiting_scan"
                        ? "bg-amber-400 animate-ping"
                        : "bg-gray-500"
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#e8f5f5]">
                        {isConnected
                          ? `متصل بالرقم: ${config?.connectedNumber || "رقم معتمد"}`
                          : config?.connectionStatus === "waiting_scan"
                          ? "بانتظار المسح أو إدخال الرمز من تطبيق واتساب..."
                          : "غير متصل حالياً"}
                      </span>
                      {config?.hasPersistentSession && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 text-[10px] font-bold">
                          <Database className="w-2.5 h-2.5" />
                          <span>جلسة محفوظة في PostgreSQL (دائمة)</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#4a7070] mt-0.5">
                      {isConnected
                        ? "الوكيل جاهز لاستقبال وإرسال الرسائل والتنبيهات المجدولة تلقائياً."
                        : config?.hasPersistentSession
                        ? "توجد بيانات جلسة محفوظة في قاعدة البيانات السحابية PostgreSQL، جاري الاتصال التلقائي بالخوادم."
                        : "قم بمسح الكود أو طلب رمز الاقتران، ثم اضغط على تأكيد الربط لتفعيل الجلسة."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {!isConnected && (
                    <button
                      onClick={() => handleConfirmConnection()}
                      disabled={pairingCodeLoading}
                      className="px-3.5 py-2 bg-[#25D366] text-[#0a0f0f] rounded-xl text-xs font-black hover:bg-[#20ba59] transition-all flex items-center gap-1.5 shadow-md shadow-[#25D366]/20 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {pairingCodeLoading ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>تأكيد الربط والاتصال فوراً</span>
                    </button>
                  )}
                  {config?.lastConnectedAt && (
                    <span className="text-left text-[11px] text-[#88b0b0]">
                      آخر اتصال: {new Date(config.lastConnectedAt).toLocaleDateString("ar-EG")}
                    </span>
                  )}
                </div>
              </div>

              {/* QR Code Tab Content */}
              {activeMethod === "qr" && (
                <div className="p-6 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e] flex flex-col items-center justify-center text-center space-y-4">
                  {config?.qrCodeData ? (
                    <div className="space-y-3 flex flex-col items-center">
                      <div className="p-4 bg-white rounded-2xl shadow-2xl border-4 border-[#00d4aa]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={config.qrCodeData}
                          alt="WhatsApp QR Code"
                          className="w-56 h-56 object-contain"
                        />
                      </div>
                      <span className="text-xs text-[#88b0b0] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#00d4aa]" />
                        ينتهي صلاحية هذا الرمز بعد قليل، يتم التحديث التلقائي.
                      </span>
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-[#1e2e2e] rounded-2xl flex flex-col items-center space-y-3 max-w-sm">
                      <QrCode className="w-16 h-16 text-[#4a7070]" />
                      <p className="text-xs text-[#88b0b0] leading-relaxed">
                        اضغط على الزر بالأسفل لتوليد كود QR متصل ومسحه عبر كاميرا واتساب.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={handleGenerateQR}
                      disabled={qrGenerating}
                      className="px-5 py-2.5 bg-[#00d4aa] text-[#0a0f0f] rounded-xl text-xs font-extrabold hover:bg-[#00b894] transition-all flex items-center gap-2 shadow-lg shadow-[#00d4aa]/20 cursor-pointer disabled:opacity-50"
                    >
                      {qrGenerating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <QrCode className="w-4 h-4" />
                      )}
                      <span>{config?.qrCodeData ? "تحديث رمز الـ QR" : "توليد كود QR للربط"}</span>
                    </button>

                    {config?.qrCodeData && (
                      <button
                        onClick={() => handleConfirmConnection()}
                        disabled={pairingCodeLoading}
                        className="px-5 py-2.5 bg-[#25D366] text-[#0a0f0f] rounded-xl text-xs font-black hover:bg-[#20ba59] transition-all flex items-center gap-2 shadow-lg shadow-[#25D366]/20 cursor-pointer disabled:opacity-50"
                      >
                        {pairingCodeLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>تأكيد مسح الـ QR والربط</span>
                      </button>
                    )}
                  </div>

                  {/* Guide */}
                  <div className="w-full text-right p-4 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-xs text-[#88b0b0] space-y-1.5">
                    <div className="font-bold text-[#e8f5f5] flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-[#00d4aa]" />
                      <span>خطوات الربط عبر الباركود:</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 pr-1 text-[11px]">
                      <li>افتح تطبيق واتساب على هاتفك المحمول.</li>
                      <li>اضغط على <strong>القائمة (⋮)</strong> أو <strong>الإعدادات</strong> واختر <strong>الأجهزة المرتبطة</strong>.</li>
                      <li>اضغط على <strong>ربط جهاز</strong> ووجّه الكاميرا نحو رمز الـ QR أعلاه.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Pairing Code Tab Content */}
              {activeMethod === "code" && (
                <div className="p-6 rounded-2xl bg-[#0a0f0f] border border-[#1e2e2e] space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-[#e8f5f5] mb-2">
                      رقم الهاتف المخصص للوكيل (مع الرمز الدولي الكامل بدون أصفار إضافية):
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder="+966501234567 أو 0501234567 أو +212600000000"
                        value={phoneInput}
                        onChange={(e) => {
                          setPhoneInput(e.target.value);
                          setPairingError(null);
                        }}
                        className="flex-1 px-4 py-2.5 bg-[#111a1a] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa] font-mono text-left"
                        dir="ltr"
                      />
                      <button
                        onClick={handleRequestPairingCode}
                        disabled={pairingCodeLoading || !phoneInput.trim()}
                        className="px-5 py-2.5 bg-[#00d4aa] text-[#0a0f0f] rounded-xl text-xs font-extrabold hover:bg-[#00b894] transition-all flex items-center gap-2 shadow-lg shadow-[#00d4aa]/20 cursor-pointer disabled:opacity-50"
                      >
                        {pairingCodeLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Smartphone className="w-4 h-4" />
                        )}
                        <span>طلب رمز الاقتران</span>
                      </button>
                    </div>

                    {pairingError && (
                      <div className="mt-2 text-xs font-bold text-red-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{pairingError}</span>
                      </div>
                    )}
                  </div>

                  {config?.pairingCode && (
                    <div className="p-5 rounded-2xl bg-gradient-to-tr from-[#00d4aa]/10 to-[#111a1a] border-2 border-[#00d4aa] flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <span className="text-xs text-[#88b0b0]">رمز الاقتران المخصص لواتساب:</span>
                        <div className="text-2xl font-black text-[#00d4aa] font-mono tracking-widest mt-0.5">
                          {config.pairingCode}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyCode(config.pairingCode!)}
                          className="px-4 py-2 bg-[#111a1a] hover:bg-[#1e2e2e] text-[#e8f5f5] border border-[#1e2e2e] rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-[#00d4aa]" /> : <Copy className="w-4 h-4" />}
                          <span>{copiedCode ? "تم النسخ!" : "نسخ الرمز"}</span>
                        </button>

                        <button
                          onClick={() => handleConfirmConnection(phoneInput)}
                          disabled={pairingCodeLoading}
                          className="px-4 py-2 bg-[#25D366] text-[#0a0f0f] rounded-xl text-xs font-black hover:bg-[#20ba59] transition-all flex items-center gap-2 shadow-md shadow-[#25D366]/20 cursor-pointer disabled:opacity-50"
                        >
                          {pairingCodeLoading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>تأكيد وإكتمال الاقتران بالرقم</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Guide */}
                  <div className="text-right p-4 rounded-xl bg-[#111a1a] border border-[#1e2e2e] text-xs text-[#88b0b0] space-y-1.5">
                    <div className="font-bold text-[#e8f5f5] flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-[#00d4aa]" />
                      <span>خطوات إدخال الرمز في واتساب (بدون كاميرا):</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 pr-1 text-[11px]">
                      <li>افتح واتساب على هاتفك وانتقل إلى: <strong>الأجهزة المرتبطة &gt; ربط جهاز</strong>.</li>
                      <li>اضغط على الرابط بالأسفل: <strong>"الربط باستخدام رقم الهاتف بدلاً من ذلك"</strong>.</li>
                      <li>أدخل الرمز المكون من 8 خانات الظاهر أعلاه وسيتم الاقتران فوراً.</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

            {/* Test WhatsApp Dispatch */}
            <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-4">
              <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
                <Send className="w-4 h-4 text-[#00d4aa]" />
                <span>فحص وتجربة إرسال رسالة واتساب (Live Test Center)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-bold text-[#88b0b0] mb-1">
                    رقم هاتف المستلم:
                  </label>
                  <input
                    type="text"
                    placeholder="+966500000000"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] font-mono text-left focus:outline-none focus:border-[#00d4aa]"
                    dir="ltr"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-[#88b0b0] mb-1">
                    نص الرسالة الاختبارية:
                  </label>
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={handleSendTestMessage}
                  disabled={testSending || !testPhone.trim()}
                  className="px-4 py-2 bg-[#25D366] text-[#0a0f0f] rounded-xl text-xs font-extrabold hover:bg-[#20ba59] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {testSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>{testSending ? "جاري الإرسال..." : "إرسال رسالة اختبارية"}</span>
                </button>

                {testSuccess && (
                  <span className="text-xs text-[#25D366] font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    تم إرسال الرسالة وتسليمها بنجاح!
                  </span>
                )}

                {testError && (
                  <span className="text-xs text-red-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    {testError}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Fast WhatsApp Settings (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
              <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#00d4aa]" />
                <span>إعدادات تحكم واتساب</span>
              </h3>

              <div>
                <label className="block text-[11px] font-bold text-[#88b0b0] mb-1">
                  اسم الوكيل في واتساب:
                </label>
                <input
                  type="text"
                  value={config?.agentName || ""}
                  onChange={(e) =>
                    setConfig(config ? { ...config, agentName: e.target.value } : null)
                  }
                  className="w-full px-3.5 py-2 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa]"
                />
              </div>

              {/* Toggles */}
              <div className="pt-2 space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#e8f5f5] block">
                      الرد الذكي التلقائي عبر نماذج SoufAI
                    </span>
                    <span className="text-[10px] text-[#88b0b0] block">
                      يقوم الوكيل بالرد تلقائياً على رسائل واتساب عبر النموذج المخصص أدناه.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config?.autoAiReply ?? true}
                    onChange={(e) =>
                      setConfig(config ? { ...config, autoAiReply: e.target.checked } : null)
                    }
                    className="w-4 h-4 accent-[#00d4aa] cursor-pointer"
                  />
                </label>

                {/* Model Tier Selector for WhatsApp */}
                <div className="p-3 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] space-y-1.5">
                  <label className="block text-[11px] font-bold text-[#e8f5f5] flex items-center justify-between">
                    <span>النموذج المعتمد للرد على واتساب:</span>
                    <span className="text-[10px] text-[#00d4aa] font-mono">SoufAI Model</span>
                  </label>
                  <select
                    value={config?.preferredModelId || "core"}
                    onChange={(e) =>
                      setConfig(config ? { ...config, preferredModelId: e.target.value } : null)
                    }
                    className="w-full px-3 py-2 bg-[#111a1a] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa] cursor-pointer"
                  >
                    <option value="core">⚡ SoufAI Core (المتوازن والمعتمد)</option>
                    <option value="spark">🚀 SoufAI Spark (الخاطف فائق السرعة)</option>
                    <option value="pro">🧠 SoufAI Pro (الاحترافي التحليلي)</option>
                    <option value="ultra">👑 SoufAI Ultra (الفائق الأقصى)</option>
                  </select>
                  <p className="text-[10px] text-[#4a7070]">
                    يتم توجيه المحادثات تلقائياً للمزود والمفاتيح التي قمت بتعيينها لهذا النموذج في لوحة التحكم.
                  </p>
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#e8f5f5] block">
                      إرسال إشعارات المهام المجدولة لواتساب
                    </span>
                    <span className="text-[10px] text-[#88b0b0] block">
                      إرسال رسالة فور استيقاظ الوكيل وإنجاز الجدولة.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config?.scheduledNotify ?? true}
                    onChange={(e) =>
                      setConfig(config ? { ...config, scheduledNotify: e.target.checked } : null)
                    }
                    className="w-4 h-4 accent-[#00d4aa] cursor-pointer"
                  />
                </label>
              </div>

              <div className="pt-2">
                <label className="block text-[11px] font-bold text-[#88b0b0] mb-1">
                  رسالة الترحيب التلقائية:
                </label>
                <textarea
                  rows={3}
                  value={config?.welcomeMessage || ""}
                  onChange={(e) =>
                    setConfig(config ? { ...config, welcomeMessage: e.target.value } : null)
                  }
                  className="w-full px-3 py-2 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa] leading-relaxed"
                />
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full py-2.5 bg-[#111a1a] hover:bg-[#1e2e2e] text-[#00d4aa] border border-[#00d4aa]/40 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Check className="w-4 h-4" />
                <span>حفظ إعدادات واتساب</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 2: AGENT DEDICATED GMAIL & IDENTITY ================= */}
      {activeSection === "gmail" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          {/* Main Column: Gmail Account & Identity (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Identity Card */}
            <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#ea4335]/15 border border-[#ea4335]/40 flex items-center justify-center text-[#ea4335] shrink-0">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
                      <span>إعدادات حساب الوكيل وجيميل (Dedicated Agent Gmail)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#ea4335]/20 text-[#ea4335] font-mono">
                        OAuth 2.0
                      </span>
                    </h3>
                    <p className="text-xs text-[#88b0b0] mt-0.5">
                      تحديد البريد الإلكتروني الرسمي واسم العرض الذي يستخدمه الوكيل لمراسلة المستخدمين وإرسال التنبيهات.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isGmailConnected ? (
                    <button
                      onClick={disconnectGmail}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <PowerOff className="w-3.5 h-3.5" />
                      <span>قطع الاتصال / تبديل الحساب</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGmail}
                      disabled={gmailConnecting}
                      className="px-4 py-2 bg-gradient-to-r from-[#ea4335] to-[#f43f5e] text-white rounded-xl text-xs font-extrabold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-red-500/20 cursor-pointer disabled:opacity-50"
                    >
                      {gmailConnecting ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Mail className="w-4 h-4" />
                      )}
                      <span>ربط حساب Gmail للوكيل الآن (OAuth)</span>
                    </button>
                  )}
                </div>
              </div>

              {gmailConnectError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 leading-relaxed">
                  {gmailConnectError}
                </div>
              )}

              {/* Status Indicator */}
              <div className="p-4 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isGmailConnected ? "bg-[#25D366] animate-pulse" : "bg-amber-400"
                    }`}
                  />
                  <div>
                    <span className="text-xs font-bold text-[#e8f5f5]">
                      {isGmailConnected
                        ? `حساب Gmail مفوض ومتصل: ${connectedGmailAddress || agentEmail}`
                        : "حساب Gmail غير متصل بتفويض OAuth حالياً"}
                    </span>
                    <p className="text-[11px] text-[#88b0b0] mt-0.5">
                      {isGmailConnected
                        ? "الوكيل يمتلك تصريح الإرسال عبر خادم Gmail الرسمي مع تشفير النقل الكامل."
                        : "اضغط على زر الربط لتفويض الوكيل بإرسال الرسائل الرسمية من حسابك المخصص."}
                    </p>
                  </div>
                </div>

                {isGmailConnected && (
                  <span className="px-2.5 py-1 bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30 rounded-lg text-[11px] font-bold">
                    ✅ جاهز للإرسال التلقائي
                  </span>
                )}
              </div>

              {/* Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#e8f5f5] flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-[#ea4335]" />
                      <span>عنوان بريد الوكيل ودعم المنصة (Support & Agent Email):</span>
                    </label>
                    {agentEmail.trim() !== "" &&
                      normalizeAndFixEmailAddress(agentEmail) !== agentEmail.trim() &&
                      !agentEmail.includes(" ") && (
                        <button
                          type="button"
                          onClick={() => setAgentEmail(normalizeAndFixEmailAddress(agentEmail))}
                          className="text-[10px] text-[#00d4aa] bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 border border-[#00d4aa]/30 px-2 py-0.5 rounded-md cursor-pointer transition-colors"
                        >
                          إصلاح الصيغة ({normalizeAndFixEmailAddress(agentEmail)})
                        </button>
                      )}
                  </div>
                  <input
                    type="text"
                    value={agentEmail}
                    onChange={(e) => setAgentEmail(e.target.value)}
                    placeholder="souftoolsheb@gmail.com"
                    className="w-full px-4 py-2.5 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] font-mono text-left focus:outline-none focus:border-[#00d4aa]"
                    dir="ltr"
                  />
                  {/* Domain Suggestions Chips */}
                  {getEmailDomainSuggestions(agentEmail).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-[#88b0b0]">إكمال سريع:</span>
                      {getEmailDomainSuggestions(agentEmail).map((dom) => (
                        <button
                          key={dom}
                          type="button"
                          onClick={() => {
                            const raw = agentEmail.trim();
                            if (raw.includes("@")) {
                              setAgentEmail(`${raw.split("@")[0]}${dom}`);
                            } else {
                              setAgentEmail(`${raw}${dom}`);
                            }
                          }}
                          className="px-2 py-0.5 rounded-md bg-[#162525] hover:bg-[#00d4aa]/20 hover:text-[#00d4aa] text-[#a3c2c2] border border-[#1e2e2e] text-[10px] font-mono transition-all cursor-pointer"
                        >
                          {dom}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-[#4a7070] block leading-relaxed">
                    💡 هذا هو البريد الرسمي الذي يعتمده الوكيل عند طلب أي مستخدم التواصل مع الدعم أو خدمة العملاء أو مراسلة المنصة.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#e8f5f5] mb-1.5 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#00d4aa]" />
                    <span>اسم عرض الوكيل (Agent Display Name):</span>
                  </label>
                  <input
                    type="text"
                    value={agentDisplayName}
                    onChange={(e) => setAgentDisplayName(e.target.value)}
                    placeholder="سوف - الوكيل الذكي المستقل (SoufAI Agent)"
                    className="w-full px-4 py-2.5 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa]"
                  />
                  <span className="text-[10px] text-[#4a7070] mt-1 block">
                    الاسم المعروض الذي يظهر في صندوق الوارد للمستلم.
                  </span>
                </div>
              </div>

              {/* Email Signature */}
              <div>
                <label className="block text-xs font-bold text-[#e8f5f5] mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#00d4aa]" />
                  <span>توقيع البريد الإلكتروني التلقائي للوكيل (Email Signature):</span>
                </label>
                <textarea
                  rows={3}
                  value={agentEmailSignature}
                  onChange={(e) => setAgentEmailSignature(e.target.value)}
                  placeholder="—&#10;تم الإرسال بواسطة الوكيل الذكي SoufAI"
                  className="w-full px-4 py-2.5 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa] leading-relaxed font-mono"
                />
                <span className="text-[10px] text-[#4a7070] mt-1 block">
                  يتم إلحاق هذا التوقيع تلقائياً أسفل كل رسالة بريد إلكتروني يرسلها الوكيل.
                </span>
              </div>
            </div>

            {/* Test Live Email Dispatch */}
            <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#ea4335]" />
                  <span>مركز فحص وتجربة إرسال بريد إلكتروني حي (Live Gmail Dispatch Test)</span>
                </h3>
                <span className="text-[11px] text-[#88b0b0]">
                  لتجربة الإرسال والتأكد من نجاح ربط حساب الوكيل
                </span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[#88b0b0] mb-1">
                      البريد الإلكتروني للمستلم:
                    </label>
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] font-mono text-left focus:outline-none focus:border-[#00d4aa]"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#88b0b0] mb-1">
                      موضوع البريد الإلكتروني:
                    </label>
                    <input
                      type="text"
                      value={testEmailSubject}
                      onChange={(e) => setTestEmailSubject(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#88b0b0] mb-1">
                    محتوى الرسالة:
                  </label>
                  <textarea
                    rows={3}
                    value={testEmailBody}
                    onChange={(e) => setTestEmailBody(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa] leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleSendTestEmail}
                    disabled={testEmailSending || !testEmailTo.trim()}
                    className="px-5 py-2.5 bg-[#ea4335] text-white rounded-xl text-xs font-extrabold hover:bg-[#d93025] transition-all flex items-center gap-2 shadow-lg shadow-red-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {testEmailSending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{testEmailSending ? "جاري الإرسال عبر Gmail..." : "إرسال بريد اختباري الآن"}</span>
                  </button>

                  {testEmailSuccess && (
                    <span className="text-xs text-[#25D366] font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      تم تسليم البريد الإلكتروني بنجاح تام إلى خادم Gmail!
                    </span>
                  )}

                  {testEmailError && (
                    <span className="text-xs text-red-400 font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      {testEmailError}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Autonomous Email Permissions (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
              <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#00d4aa]" />
                <span>صلاحيات الاستيقاظ والتنفيذ التلقائي</span>
              </h3>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#e8f5f5] block">
                      الإرسال التلقائي للبريد المجدول
                    </span>
                    <span className="text-[10px] text-[#88b0b0] block">
                      يستيقظ الوكيل ويرسل البريد دون الحاجة لضغط زر من المستخدم.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={agentEmailAutoSend}
                    onChange={(e) => setAgentEmailAutoSend(e.target.checked)}
                    className="w-4 h-4 accent-[#00d4aa] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#e8f5f5] block">
                      إرسال تقرير إنجاز المهام على البريد
                    </span>
                    <span className="text-[10px] text-[#88b0b0] block">
                      إرسال ملخص بالبريد عند انتهاء مهام العمل أو المراقبة.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={agentEmailNotifyOnTasks}
                    onChange={(e) => setAgentEmailNotifyOnTasks(e.target.checked)}
                    className="w-4 h-4 accent-[#00d4aa] cursor-pointer"
                  />
                </label>
              </div>

              {/* Signature Preview */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-[#88b0b0] block mb-1">
                  معاينة توقيع الوكيل الصادر:
                </span>
                <div className="p-3 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] text-[11px] text-[#4a7070] font-mono whitespace-pre-wrap">
                  {agentEmailSignature || "لا يوجد توقيع مخصص"}
                </div>
              </div>

              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="w-full py-2.5 bg-[#111a1a] hover:bg-[#1e2e2e] text-[#00d4aa] border border-[#00d4aa]/40 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Check className="w-4 h-4" />
                <span>حفظ إعدادات بريد الوكيل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= SECTION 3: BEHAVIOR & SYSTEM PROMPT ================= */}
      {activeSection === "behavior" && (
        <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-5 animate-fade-in">
          <div>
            <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#00d4aa]" />
              <span>توجيهات وشخصية الوكيل الذكي في واتساب والبريد (System Prompt)</span>
            </h3>
            <p className="text-xs text-[#88b0b0] mt-1">
              حدد طريقة تفاعل الوكيل، نبرة حديثه، وحدود صلاحياته عند مراسلة المستخدمين عبر القنوات الخارجية.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#e8f5f5] mb-2">
              التعليمات الأساسية للوكيل (System Instructions):
            </label>
            <textarea
              rows={6}
              value={config?.systemPrompt || ""}
              onChange={(e) =>
                setConfig(config ? { ...config, systemPrompt: e.target.value } : null)
              }
              className="w-full px-4 py-3 bg-[#0a0f0f] border border-[#1e2e2e] rounded-xl text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa] leading-relaxed font-mono"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-6 py-2.5 bg-[#00d4aa] text-[#0a0f0f] rounded-xl text-xs font-extrabold hover:bg-[#00b894] transition-all flex items-center gap-2 shadow-lg shadow-[#00d4aa]/20 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>حفظ التعليمات والتوجيهات</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= SECTION 4: LIVE LOGS ================= */}
      {activeSection === "logs" && (
        <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#e8f5f5] flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#00d4aa]" />
              <span>سجل الأنشطة والمراسلات الحية (Live Activity Logs)</span>
            </h3>
            <button
              onClick={fetchConfig}
              className="p-2 rounded-xl bg-[#111a1a] hover:bg-[#1e2e2e] text-[#88b0b0] border border-[#1e2e2e] transition-colors cursor-pointer"
              title="تحديث السجل"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="فلترة السجل برقم الهاتف أو الكلمة..."
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] text-[#e8f5f5] text-xs focus:outline-none focus:border-[#00d4aa] transition-colors"
            />
            {logSearchQuery && (
              <button
                onClick={() => setLogSearchQuery("")}
                className="text-xs text-[#88b0b0] hover:text-[#e8f5f5] px-2 py-1 rounded bg-[#111a1a]"
              >
                مسح
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {logs.filter(
              (l) =>
                !logSearchQuery ||
                l.phone.includes(logSearchQuery) ||
                l.content.toLowerCase().includes(logSearchQuery.toLowerCase())
            ).length === 0 ? (
              <div className="p-8 text-center text-xs text-[#88b0b0] border border-dashed border-[#1e2e2e] rounded-xl">
                لا توجد سجلات مراسلات مطابقة للبحث.
              </div>
            ) : (
              logs
                .filter(
                  (l) =>
                    !logSearchQuery ||
                    l.phone.includes(logSearchQuery) ||
                    l.content.toLowerCase().includes(logSearchQuery.toLowerCase())
                )
                .map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.direction === "inbound"
                            ? "bg-blue-500/15 text-blue-400"
                            : log.direction === "outbound"
                            ? "bg-[#25D366]/15 text-[#25D366]"
                            : "bg-[#00d4aa]/15 text-[#00d4aa]"
                        }`}
                      >
                        {log.direction === "inbound"
                          ? "وارد"
                          : log.direction === "outbound"
                          ? "صادر"
                          : "نظام"}
                      </span>
                      <span className="font-mono text-[#88b0b0] text-[11px]">{log.phone}</span>
                      {log.automated && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/15 text-purple-400 font-bold">
                          آلي
                        </span>
                      )}
                    </div>
                    <p className="text-[#e8f5f5] text-xs leading-relaxed break-words">{log.content}</p>
                  </div>

                  <span className="text-[10px] text-[#4a7070] shrink-0 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= SECTION: TELEGRAM BOT ================= */}
      {activeSection === "telegram" && <TelegramGatewayPanel />}
    </div>
  );
};
