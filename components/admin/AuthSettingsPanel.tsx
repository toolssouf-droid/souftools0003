"use client";

import React, { useState, useEffect } from "react";
import { getAuthCookie } from "@/lib/authCookies";
import {
  Mail,
  Shield,
  Key,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Send,
  Lock,
  Server,
  Zap,
  Check,
  Eye,
  EyeOff,
  Sparkles
} from "lucide-react";

export const AuthSettingsPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Testing states
  const [testEmail, setTestEmail] = useState("");
  const [testingMail, setTestingMail] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; engine?: string } | null>(null);

  // Passwords visibility
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [showResendKey, setShowResendKey] = useState(false);
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);
  const [showGithubSecret, setShowGithubSecret] = useState(false);

  // Auth Providers State (Google & GitHub OAuth)
  const [authProviders, setAuthProviders] = useState({
    googleClientId: "",
    googleClientSecret: "",
    githubClientId: "",
    githubClientSecret: "",
    requireEmailVerification: true,
  });

  // Email Delivery Settings (Dual-Engine: SMTP / Gmail + Resend)
  const [emailSettings, setEmailSettings] = useState({
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "",
    resendApiKey: "",
    resendFrom: "SoufTools <onboarding@resend.dev>",
    primaryEngine: "smtp_gmail" as "smtp_gmail" | "http_resend",
  });

  // Fetch current settings from server
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = {};
      const effectiveEmail =
        cookieData?.email ||
        (typeof window !== "undefined" ? localStorage.getItem("souftools_admin_email") : null) ||
        "souftoolsai@gmail.com";
      
      headers["x-user-email"] = effectiveEmail;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/keys", { 
        headers,
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authProviders) {
          setAuthProviders((prev) => ({ ...prev, ...data.authProviders }));
        }
        if (data.emailSettings) {
          setEmailSettings((prev) => ({ ...prev, ...data.emailSettings }));
        }
      }
    } catch (err) {
      console.error("Failed to load auth settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Save changes to server and disk
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);

      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const effectiveEmail =
        cookieData?.email ||
        (typeof window !== "undefined" ? localStorage.getItem("souftools_admin_email") : null) ||
        "souftoolsai@gmail.com";
      
      headers["x-user-email"] = effectiveEmail;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const cleanedEmailSettings = {
        ...emailSettings,
        smtpHost: (emailSettings.smtpHost || "smtp.gmail.com").trim(),
        smtpPort: Number(emailSettings.smtpPort || 465),
        smtpUser: emailSettings.smtpUser.trim(),
        smtpPass: emailSettings.smtpPass.replace(/[\s"']/g, "").trim(),
        resendApiKey: emailSettings.resendApiKey.trim(),
      };

      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          authProviders,
          emailSettings: cleanedEmailSettings,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data.success || !data.error)) {
        setEmailSettings(cleanedEmailSettings);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setSaveError(data.error || data.message || "فشل حفظ الإعدادات في السيرفر (تحقق من صلاحيات المسؤول).");
      }
    } catch (err: any) {
      setSaveError(err?.message || "حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  // Test live email delivery
  const handleTestEmail = async () => {
    if (!testEmail || !testEmail.includes("@")) {
      setTestResult({ success: false, message: "يرجى إدخال بريد إلكتروني صحيح لتجربة الإرسال." });
      return;
    }

    try {
      setTestingMail(true);
      setTestResult(null);

      // Save first before testing so the latest inputs take effect
      await handleSave();

      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmail: testEmail.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `تم إرسال رسالة الاختبار بنجاح عبر محرك (${data.engineUsed})! تحقق من صندوق البريد: ${testEmail}`,
          engine: data.engineUsed,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "فشل إرسال رسالة الاختبار.",
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || "حدث خطأ أثناء تجربة الإرسال.",
      });
    } finally {
      setTestingMail(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-8 h-8 text-[#00d4aa] animate-spin" />
        <span className="text-sm text-[#88b0b0]">جاري تحميل إعدادات المصادقة والبريد من السيرفر...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Header Info Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0c1616] via-[#101c1c] to-[#0a1212] border border-[#00d4aa]/30 shadow-lg shadow-black/40">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#00d4aa]/20 border border-[#00d4aa]/40 flex items-center justify-center text-[#00d4aa] shadow-[0_0_20px_rgba(0,212,170,0.25)]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#e8f5f5] flex items-center gap-2">
                <span>إعدادات المصادقة وهوية الدخول وإرسال البريد</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/30 font-mono">
                  Dual Engine
                </span>
              </h2>
              <p className="text-xs text-[#88b0b0] mt-1">
                إدارة معرفات OAuth المباشرة (Google & GitHub) وإعداد محركات إرسال رسائل التأكيد المزدوجة (SMTP / Gmail + Resend Gateway).
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#00a884] hover:from-[#00f5c4] hover:to-[#00c79c] text-[#060a0a] font-bold text-xs sm:text-sm transition-all shadow-md shadow-[#00d4aa]/20 active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? "جاري الحفظ..." : "حفظ التغييرات في السيرفر"}</span>
          </button>
        </div>

        {saveSuccess && (
          <div className="mt-4 p-3 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/40 text-[#00d4aa] text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>تم حفظ ومزامنة جميع إعدادات المصادقة والبريد بنجاح على السيرفر والقرص!</span>
          </div>
        )}

        {saveError && (
          <div className="mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}
      </div>

      {/* Section 1: Social OAuth (Google & GitHub) Settings */}
      <div className="p-6 rounded-2xl bg-[#0e1616] border border-[#1e2e2e] space-y-6">
        <div className="flex items-center justify-between border-b border-[#1e2e2e] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#e8f5f5]">معرفات تسجيل الدخول المباشر (Google & GitHub OAuth)</h3>
              <p className="text-[11px] text-[#88b0b0]">
                ضع هنا Client ID و Secret الخاص بتطبيقاتك لتمكين المستخدمين من تسجيل الدخول المباشر.
              </p>
            </div>
          </div>
          <span className="text-[10px] px-2 py-1 rounded bg-[#111a1a] text-[#88b0b0] border border-[#1e2e2e] font-mono">
            OAuth 2.0
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Google OAuth Card */}
          <div className="p-5 rounded-xl bg-[#090f0f] border border-[#1e2e2e] space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#e8f5f5]">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>إعدادات Google OAuth (Google Cloud Console)</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[#88b0b0] mb-1 font-medium">Google Client ID (معرف العميل):</label>
                <input
                  type="text"
                  dir="ltr"
                  value={authProviders.googleClientId}
                  onChange={(e) => setAuthProviders({ ...authProviders, googleClientId: e.target.value })}
                  placeholder="348343638361-...apps.googleusercontent.com"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0d1414] border border-[#1e2e2e] focus:border-[#00d4aa] text-[#e8f5f5] font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#88b0b0] mb-1 font-medium">Google Client Secret (المفتاح السري):</label>
                <div className="relative">
                  <input
                    type={showGoogleSecret ? "text" : "password"}
                    dir="ltr"
                    value={authProviders.googleClientSecret}
                    onChange={(e) => setAuthProviders({ ...authProviders, googleClientSecret: e.target.value })}
                    placeholder="GOCSPX-..."
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0d1414] border border-[#1e2e2e] focus:border-[#00d4aa] text-[#e8f5f5] font-mono outline-none pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGoogleSecret(!showGoogleSecret)}
                    className="absolute left-2.5 top-2.5 text-[#88b0b0] hover:text-[#e8f5f5]"
                  >
                    {showGoogleSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* GitHub OAuth Card */}
          <div className="p-5 rounded-xl bg-[#090f0f] border border-[#1e2e2e] space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#e8f5f5]">
              <svg className="w-4 h-4 fill-current text-[#e8f5f5]" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span>إعدادات GitHub OAuth (GitHub Developer Apps)</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[#88b0b0] mb-1 font-medium">GitHub Client ID (معرف التطبيق):</label>
                <input
                  type="text"
                  dir="ltr"
                  value={authProviders.githubClientId}
                  onChange={(e) => setAuthProviders({ ...authProviders, githubClientId: e.target.value })}
                  placeholder="Iv1.xxxxxxxxxxxx"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0d1414] border border-[#1e2e2e] focus:border-[#00d4aa] text-[#e8f5f5] font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#88b0b0] mb-1 font-medium">GitHub Client Secret (المفتاح السري):</label>
                <div className="relative">
                  <input
                    type={showGithubSecret ? "text" : "password"}
                    dir="ltr"
                    value={authProviders.githubClientSecret}
                    onChange={(e) => setAuthProviders({ ...authProviders, githubClientSecret: e.target.value })}
                    placeholder="ghs_xxxxxxxxxxxx..."
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0d1414] border border-[#1e2e2e] focus:border-[#00d4aa] text-[#e8f5f5] font-mono outline-none pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGithubSecret(!showGithubSecret)}
                    className="absolute left-2.5 top-2.5 text-[#88b0b0] hover:text-[#e8f5f5]"
                  >
                    {showGithubSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Dual-Engine Email Verification System */}
      <div className="p-6 rounded-2xl bg-[#0e1616] border border-[#1e2e2e] space-y-6">
        <div className="flex items-center justify-between border-b border-[#1e2e2e] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#e8f5f5]">محرك إرسال رسائل التحقق وتأكيد البريد (Dual Mail Engine)</h3>
              <p className="text-[11px] text-[#88b0b0]">
                نظام إرسال متقدم ومزدوج: إذا تعطل المحرك الأول يعمل المحرك الثاني تلقائياً لضمان وصول رموز التحقق للمستخدمين.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-1 rounded bg-[#111a1a] text-[#00d4aa] border border-[#00d4aa]/30 font-mono">
              Auto-Failover Active
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Engine 1: SMTP / Gmail App Password */}
          <div className="p-5 rounded-xl bg-[#090f0f] border border-[#1e2e2e] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#e8f5f5]">
                <Server className="w-4 h-4 text-[#00d4aa]" />
                <span>المحرك الأول: SMTP / Gmail (App Password)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 font-mono">
                Direct Node.js
              </span>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-[11px] text-[#88b0b0] mb-1 font-medium">خادم SMTP (Host):</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={emailSettings.smtpHost}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0d1414] border border-[#1e2e2e] text-[#e8f5f5] font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#88b0b0] mb-1 font-medium">المنفذ (Port):</label>
                  <input
                    type="number"
                    dir="ltr"
                    value={emailSettings.smtpPort}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: Number(e.target.value) })}
                    placeholder="465"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0d1414] border border-[#1e2e2e] text-[#e8f5f5] font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#88b0b0] mb-1 font-medium">بريد الإرسال (Gmail / SMTP User):</label>
                <input
                  type="email"
                  dir="ltr"
                  value={emailSettings.smtpUser}
                  onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                  placeholder="toolssouf@gmail.com"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0d1414] border border-[#1e2e2e] focus:border-[#00d4aa] text-[#e8f5f5] font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#88b0b0] mb-1 font-medium">كلمة مرور التطبيقات (Gmail App Password):</label>
                <div className="relative">
                  <input
                    type={showSmtpPass ? "text" : "password"}
                    dir="ltr"
                    value={emailSettings.smtpPass}
                    onChange={(e) => setEmailSettings({ ...emailSettings, smtpPass: e.target.value })}
                    placeholder="xxxx xxxx xxxx xxxx"
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0d1414] border border-[#1e2e2e] focus:border-[#00d4aa] text-[#e8f5f5] font-mono outline-none pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPass(!showSmtpPass)}
                    className="absolute left-2.5 top-2.5 text-[#88b0b0] hover:text-[#e8f5f5]"
                  >
                    {showSmtpPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="mt-2 p-2.5 rounded-lg bg-[#0c1616] border border-[#1e2e2e] space-y-1.5 text-[11px] text-[#88b0b0]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#e8f5f5]">كيف تحصل على كلمة مرور التطبيقات (16 حرفاً)؟</span>
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#00d4aa] hover:underline inline-flex items-center gap-1 font-mono"
                    >
                      <span>فتح إعدادات Google</span>
                      <Globe className="w-3 h-3" />
                    </a>
                  </div>
                  <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-[#709595] leading-relaxed">
                    <li>تأكد من تفعيل <strong>التحقق بخطوتين (2-Step Verification)</strong> على حسابك ({emailSettings.smtpUser || "Google"}).</li>
                    <li>ادخل إلى <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-[#00d4aa] underline">صفحة كلمات مرور التطبيقات (App Passwords)</a>.</li>
                    <li>اكتب اسماً للتطبيق مثل (SoufTools) واضغط على <strong>إنشاء (Create)</strong>.</li>
                    <li>انسخ الكلمة الصفراء المكونة من 16 حرفاً والصقها هنا في الحقل أعلاه.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Engine 2: HTTP Gateway / Resend API */}
          <div className="p-5 rounded-xl bg-[#090f0f] border border-[#1e2e2e] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#e8f5f5]">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>المحرك الثاني: Resend Gateway (Fast Cloud Mail)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                HTTP API Gateway
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-[#88b0b0] mb-1 font-medium">مفتاح Resend API Key:</label>
                <div className="relative">
                  <input
                    type={showResendKey ? "text" : "password"}
                    dir="ltr"
                    value={emailSettings.resendApiKey}
                    onChange={(e) => setEmailSettings({ ...emailSettings, resendApiKey: e.target.value })}
                    placeholder="re_xxxxxxxxxxxx..."
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[#0d1414] border border-[#1e2e2e] focus:border-[#00d4aa] text-[#e8f5f5] font-mono outline-none pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResendKey(!showResendKey)}
                    className="absolute left-2.5 top-2.5 text-[#88b0b0] hover:text-[#e8f5f5]"
                  >
                    {showResendKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#88b0b0] mb-1 font-medium">بريد المرسل (From Address):</label>
                <input
                  type="text"
                  dir="ltr"
                  value={emailSettings.resendFrom}
                  onChange={(e) => setEmailSettings({ ...emailSettings, resendFrom: e.target.value })}
                  placeholder="SoufTools <onboarding@resend.dev>"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-[#0d1414] border border-[#1e2e2e] text-[#e8f5f5] font-mono outline-none"
                />
              </div>

              <div className="p-3 rounded-lg bg-[#111a1a] border border-[#1e2e2e] text-[11px] text-[#88b0b0] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00d4aa] shrink-0" />
                <span>
                  ميزة الحماية التلقائية: عند محاولة إرسال رسالة، سيجرب السيرفر المحرك الأول، وفي حال حدوث أي خطأ أو حظر سينتقل فوراً وبشكل صامت للمحرك الثاني!
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Test Email Tool */}
        <div className="pt-4 border-t border-[#1e2e2e]">
          <h4 className="text-xs font-bold text-[#e8f5f5] mb-3 flex items-center gap-2">
            <Send className="w-3.5 h-3.5 text-[#00d4aa]" />
            <span>تجربة إرسال رسالة تحقق حية الآن (Live Test Email):</span>
          </h4>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="email"
              dir="ltr"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="اكتب بريدك هنا لتجربة وصول الرسالة (مثال: toolssouf@gmail.com)"
              className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-[#090f0f] border border-[#1e2e2e] focus:border-[#00d4aa] text-[#e8f5f5] outline-none"
            />

            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testingMail || !testEmail}
              className="px-5 py-2 rounded-xl bg-[#00d4aa]/20 hover:bg-[#00d4aa]/30 border border-[#00d4aa]/40 text-[#00d4aa] text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {testingMail ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{testingMail ? "جاري الإرسال التجريبي..." : "إرسال رسالة اختبار"}</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
                testResult.success
                  ? "bg-[#00d4aa]/15 border border-[#00d4aa]/40 text-[#00d4aa]"
                  : "bg-red-950/40 border border-red-500/40 text-red-300"
              }`}
            >
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
