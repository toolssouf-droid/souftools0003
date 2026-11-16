"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  Layers,
  ShieldCheck,
  Activity,
  ChevronRight,
  Eye,
  EyeOff,
  Server,
  Loader2,
  Play,
  Copy,
  Check,
  Lock,
} from "lucide-react";

interface KeyItem {
  id: string;
  name: string;
  accountId: string;
  maskedToken: string;
  status: "healthy" | "degraded" | "failed" | "disabled";
  createdAt: string;
  lastUsedAt?: string;
  lastError?: string;
  successCount: number;
  failureCount: number;
  isActive: boolean;
}

interface ProviderInfo {
  name: string;
  status: string;
  model: string;
  keysCount?: number;
  activeCount?: number;
  disabledCount?: number;
  failedCount?: number;
  requiresKey?: boolean;
}

export function ImageGenAdminPanel() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<{
    cloudflare?: ProviderInfo;
    pollinations?: ProviderInfo;
  }>({});
  const [keys, setKeys] = useState<KeyItem[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSystemTestOpen, setIsSystemTestOpen] = useState(false);
  const [verifyingKeyId, setVerifyingKeyId] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ keyId: string; valid: boolean; message: string } | null>(null);

  // Form states for adding new Cloudflare Key
  const [newKeyName, setNewKeyName] = useState("");
  const [newAccountId, setNewAccountId] = useState("");
  const [newApiToken, setNewApiToken] = useState("");
  const [showApiToken, setShowApiToken] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // System test states
  const [systemTesting, setSystemTesting] = useState(false);
  const [systemTestReport, setSystemTestReport] = useState<any>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/image-keys");
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || {});
        setKeys(data.keys || []);
      }
    } catch (err) {
      console.error("Failed to fetch image keys config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountId.trim() || !newApiToken.trim()) {
      setFormError("الرجاء إدخال Account ID و API Token الخاص بـ Cloudflare Workers AI");
      return;
    }

    setFormSubmitting(true);
    setFormError("");
    setFormSuccess("");

    try {
      const res = await fetch("/api/admin/image-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_key",
          keyData: {
            name: newKeyName.trim() || "Cloudflare Workers AI Key",
            accountId: newAccountId.trim(),
            apiToken: newApiToken.trim(),
          },
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setFormSuccess("تم حفظ المفتاح المشفر بنجاح في مجمع المفاتيح!");
        setNewKeyName("");
        setNewAccountId("");
        setNewApiToken("");
        setTimeout(() => {
          setIsAddModalOpen(false);
          setFormSuccess("");
          fetchConfig();
        }, 1500);
      } else {
        setFormError(data.error || "حدث خطأ أثناء حفظ المفتاح");
      }
    } catch (err: any) {
      setFormError(err.message || "خطأ في الاتصال بالسيرفر");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleKey = async (keyId: string) => {
    try {
      const res = await fetch("/api/admin/image-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_key", keyId }),
      });
      if (res.ok) {
        fetchConfig();
      }
    } catch (err) {
      console.error("Toggle key error:", err);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("هل أنت تأكد من رغبتك في حذف هذا المفتاح من المجمع؟")) return;

    try {
      const res = await fetch("/api/admin/image-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_key", keyId }),
      });
      if (res.ok) {
        fetchConfig();
      }
    } catch (err) {
      console.error("Delete key error:", err);
    }
  };

  const handleVerifyKey = async (keyId: string) => {
    setVerifyingKeyId(keyId);
    setVerifyResult(null);

    try {
      const res = await fetch("/api/admin/image-keys/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });

      const data = await res.json().catch(() => ({ valid: false, message: "استجابة غير صالحة" }));
      setVerifyResult({
        keyId,
        valid: data.valid,
        message: data.message,
      });
      fetchConfig();
    } catch (err: any) {
      setVerifyResult({
        keyId,
        valid: false,
        message: err.message || "فشل الاتصال باختبار المفتاح",
      });
    } finally {
      setVerifyingKeyId(null);
    }
  };

  const handleRunSystemTest = async () => {
    setSystemTesting(true);
    setSystemTestReport(null);
    setIsSystemTestOpen(true);

    try {
      const res = await fetch("/api/admin/image-keys/test-system", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({ overallStatus: "failed" }));
      setSystemTestReport(data);
    } catch (err: any) {
      setSystemTestReport({
        overallStatus: "failed",
        steps: [
          {
            step: "فحص النظام الشامل",
            status: "error",
            detail: err.message || "حدث خطأ أثناء إجراء الفحص الشامل",
          },
        ],
      });
    } finally {
      setSystemTesting(false);
    }
  };

  return (
    <div className="space-y-6 text-[#e8f5f5]" dir="rtl">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#88b0b0]">
        <span>لوحة التحكم</span>
        <ChevronRight className="w-3.5 h-3.5 rotate-180 text-[#4a7070]" />
        <span>إدارة الأدوات والخدمات</span>
        <ChevronRight className="w-3.5 h-3.5 rotate-180 text-[#4a7070]" />
        <span className="text-[#00d4aa] font-bold">توليد الصور (Image Generation)</span>
      </div>

      {/* Header Info Panel */}
      <div className="glass-panel p-6 rounded-2xl border border-[#1e2e2e] bg-[#0c1414] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#00d4aa]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 text-[#00d4aa]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-[#e8f5f5]">إدارة نظام توليد الصور الذكي</h1>
                <p className="text-xs text-[#88b0b0] mt-0.5">
                  بنية تحتية متطورة تدعم التدوير المباشر لمفاتيح Cloudflare Workers AI مع مزود احتياطي لتوفر الخدمة 100%
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRunSystemTest}
              className="px-4 py-2.5 rounded-xl bg-[#111a1a] hover:bg-[#1a2626] border border-[#1e2e2e] text-xs font-bold text-[#e8f5f5] hover:text-[#00d4aa] transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 text-[#00d4aa]" />
              اختبار الفحص الشامل للنظام
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#00d4aa] text-[#0a0f0f] font-extrabold text-xs hover:opacity-90 transition-all shadow-lg shadow-[#00d4aa]/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              إضافة مفتاح Cloudflare جديد
            </button>
          </div>
        </div>
      </div>

      {/* Provider Health Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cloudflare Workers AI Card */}
        <div className="p-5 rounded-2xl bg-[#081010] border border-[#1e2e2e] relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1e2e2e]/80 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-[#00d4aa]" />
              <div>
                <h3 className="font-bold text-sm text-[#e8f5f5]">Cloudflare Workers AI</h3>
                <p className="text-[11px] text-[#88b0b0]">المزود الرئيسي (Primary Provider)</p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00d4aa] animate-ping" />
              جاهز ومفعل
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-[#0e1717] border border-[#1e2e2e]">
              <span className="text-[10px] text-[#88b0b0] block">إجمالي المفاتيح</span>
              <span className="text-base font-extrabold text-[#e8f5f5]">{keys.length}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0e1717] border border-[#1e2e2e]">
              <span className="text-[10px] text-[#88b0b0] block">المفاتيح النشطة</span>
              <span className="text-base font-extrabold text-[#00d4aa]">
                {keys.filter((k) => k.isActive && k.status === "healthy").length}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#0e1717] border border-[#1e2e2e]">
              <span className="text-[10px] text-[#88b0b0] block">النموذج الافتراضي</span>
              <span className="text-[11px] font-mono font-bold text-[#eab308]">Flux-1 Schnell</span>
            </div>
          </div>
        </div>

        {/* Pollinations.AI Fallback Card */}
        <div className="p-5 rounded-2xl bg-[#081010] border border-[#1e2e2e] relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#1e2e2e]/80 pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-[#0ea5e9]" />
              <div>
                <h3 className="font-bold text-sm text-[#e8f5f5]">Pollinations.AI</h3>
                <p className="text-[11px] text-[#88b0b0]">المزود الاحتياطي الضامن (Fallback)</p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#0ea5e9]/15 text-[#0ea5e9] border border-[#0ea5e9]/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              تغطية تلقائية 100%
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#0e1717] border border-[#1e2e2e] text-xs text-[#88b0b0] space-y-1">
            <div className="flex items-center justify-between text-[#e8f5f5]">
              <span>النموذج الاحتياطي:</span>
              <span className="font-mono text-[#0ea5e9]">Flux-1 (Pollinations Engine)</span>
            </div>
            <div className="flex items-center justify-between text-[#88b0b0]">
              <span>متطلبات المفاتيح:</span>
              <span className="text-[#00ff88]">لا يتطلب مفاتيح سرية (مجاني ومفتوح)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Cloudflare Keys Pool Management Table */}
      <div className="p-5 rounded-2xl bg-[#081010] border border-[#1e2e2e] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[#00d4aa]" />
            <h2 className="font-bold text-base text-[#e8f5f5]">مجمع مفاتيح Cloudflare (Key Pool)</h2>
          </div>

          <button
            onClick={fetchConfig}
            className="p-2 rounded-xl bg-[#111a1a] hover:bg-[#1a2626] text-[#88b0b0] hover:text-[#00d4aa] transition-colors"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#88b0b0]">
            <Loader2 className="w-6 h-6 animate-spin text-[#00d4aa]" />
            <span className="text-xs">جاري تحميل مجمع المفاتيح...</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="py-10 text-center rounded-xl bg-[#0e1717] border border-dashed border-[#1e2e2e] p-6 space-y-3">
            <AlertTriangle className="w-8 h-8 text-[#eab308] mx-auto" />
            <p className="text-sm text-[#e8f5f5] font-semibold">لا يوجد مفاتيح Cloudflare مسجلة في المجمع</p>
            <p className="text-xs text-[#88b0b0] max-w-md mx-auto">
              أضف أول مفتاح Cloudflare لتمكين المحرك الرئيسي السريع. سيعتمد النظام حالياً على المزود الاحتياطي تلقائياً.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#00d4aa] text-[#0a0f0f] font-bold text-xs hover:opacity-90 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              إضافة مفتاح الآن
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#1e2e2e] text-[#88b0b0] bg-[#0c1414]">
                  <th className="p-3 rounded-r-xl">اسم المفتاح</th>
                  <th className="p-3">Account ID</th>
                  <th className="p-3">رمز المفتاح (Masked Token)</th>
                  <th className="p-3">الحالة الصحية</th>
                  <th className="p-3">الاستخدام والتاريخ</th>
                  <th className="p-3 text-center rounded-l-xl">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2e2e]/50">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-[#0d1616] transition-colors">
                    <td className="p-3 font-semibold text-[#e8f5f5]">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-[#00d4aa]" />
                        <span>{k.name}</span>
                      </div>
                    </td>

                    <td className="p-3 font-mono text-[#88b0b0]">{k.accountId}</td>

                    <td className="p-3 font-mono text-[#00d4aa] bg-[#0a1414] px-2 py-1 rounded-md w-fit">
                      {k.maskedToken}
                    </td>

                    <td className="p-3">
                      {!k.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          معطل (Disabled)
                        </span>
                      ) : k.status === "healthy" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> ممتاز (Healthy)
                        </span>
                      ) : k.status === "degraded" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#eab308]/15 text-[#eab308] border border-[#eab308]/30 flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" /> تباطؤ (Degraded)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3" /> فشل (Failed)
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-[#88b0b0]">
                      <div className="text-[11px]">
                        نجاح: <span className="text-[#00ff88] font-bold">{k.successCount}</span> | فشل:{" "}
                        <span className="text-red-400 font-bold">{k.failureCount}</span>
                      </div>
                      {k.lastUsedAt && (
                        <span className="text-[10px] text-[#4a7070] block mt-0.5">
                          آخر استخدام: {new Date(k.lastUsedAt).toLocaleTimeString("ar-SA")}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Verify button */}
                        <button
                          onClick={() => handleVerifyKey(k.id)}
                          disabled={verifyingKeyId === k.id}
                          className="px-2.5 py-1 rounded-lg bg-[#111a1a] hover:bg-[#1a2626] border border-[#1e2e2e] text-[#e8f5f5] hover:text-[#00d4aa] text-[11px] font-medium flex items-center gap-1 transition-colors"
                          title="اختبار الصلاحية"
                        >
                          {verifyingKeyId === k.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-[#00d4aa]" />
                          ) : (
                            <Activity className="w-3 h-3 text-[#00d4aa]" />
                          )}
                          اختبار
                        </button>

                        {/* Toggle Active status */}
                        <button
                          onClick={() => handleToggleKey(k.id)}
                          className={`p-1.5 rounded-lg border text-[11px] transition-colors ${
                            k.isActive
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                              : "bg-[#00d4aa]/10 border-[#00d4aa]/30 text-[#00d4aa] hover:bg-[#00d4aa]/20"
                          }`}
                          title={k.isActive ? "تعطيل المفتاح" : "تفعيل المفتاح"}
                        >
                          {k.isActive ? "تعطيل" : "تفعيل"}
                        </button>

                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteKey(k.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors"
                          title="حذف المفتاح"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Verification Test Result Feedback Banner */}
                      {verifyResult && verifyResult.keyId === k.id && (
                        <div
                          className={`mt-2 p-2 rounded-lg text-[10px] font-medium text-right ${
                            verifyResult.valid
                              ? "bg-emerald-950/40 text-emerald-300 border border-emerald-500/30"
                              : "bg-red-950/40 text-red-300 border border-red-500/30"
                          }`}
                        >
                          {verifyResult.message}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add New Key Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0c1414] border border-[#1e2e2e] rounded-2xl p-6 shadow-2xl space-y-4 relative">
            <div className="flex items-center justify-between border-b border-[#1e2e2e] pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[#00d4aa]" />
                <h3 className="font-bold text-base text-[#e8f5f5]">إضافة مفتاح Cloudflare جديد</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#88b0b0] hover:text-[#e8f5f5] text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddKey} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#88b0b0] mb-1">اسم المفتاح (للتنظيم)</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="مثال: Cloudflare Production Key"
                  className="w-full p-2.5 text-xs rounded-xl bg-[#081010] border border-[#1e2e2e] text-[#e8f5f5] focus:border-[#00d4aa] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#88b0b0] mb-1">Cloudflare Account ID *</label>
                <input
                  type="text"
                  value={newAccountId}
                  onChange={(e) => setNewAccountId(e.target.value)}
                  placeholder="مثال: 9a8b7c6d5e4f3a2b1c..."
                  className="w-full p-2.5 text-xs rounded-xl bg-[#081010] border border-[#1e2e2e] text-[#e8f5f5] focus:border-[#00d4aa] focus:outline-none font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#88b0b0] mb-1">API Token (Workers AI Permission) *</label>
                <div className="relative">
                  <input
                    type={showApiToken ? "text" : "password"}
                    value={newApiToken}
                    onChange={(e) => setNewApiToken(e.target.value)}
                    placeholder="ضع رمز المفتاح هنا..."
                    className="w-full p-2.5 text-xs rounded-xl bg-[#081010] border border-[#1e2e2e] text-[#e8f5f5] focus:border-[#00d4aa] focus:outline-none font-mono pl-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiToken(!showApiToken)}
                    className="absolute left-2.5 top-2.5 text-[#88b0b0] hover:text-[#e8f5f5]"
                  >
                    {showApiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
                  {formSuccess}
                </div>
              )}

              <div className="pt-2 flex items-center gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#111a1a] text-[#88b0b0] hover:text-[#e8f5f5] text-xs font-bold"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-xl bg-[#00d4aa] text-[#0a0f0f] font-extrabold text-xs hover:opacity-90 flex items-center gap-1.5"
                >
                  {formSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  حفظ المفتاح المشفر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full System Diagnostics Test Modal */}
      {isSystemTestOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0c1414] border border-[#1e2e2e] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2e2e] pb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#00d4aa]" />
                <h3 className="font-bold text-base text-[#e8f5f5]">تقرير فحص النظام والمزودات</h3>
              </div>
              <button
                onClick={() => setIsSystemTestOpen(false)}
                className="text-[#88b0b0] hover:text-[#e8f5f5] text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            {systemTesting ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-[#00d4aa]">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-xs font-bold text-[#e8f5f5]">جاري اختبار المزودات وإنشاء صور تجريبية...</span>
              </div>
            ) : systemTestReport ? (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                    systemTestReport.overallStatus === "operational"
                      ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                      : "bg-red-950/40 border-red-500/30 text-red-300"
                  }`}
                >
                  <span>حالة النظام الإجمالية:</span>
                  <span>{systemTestReport.overallStatus === "operational" ? "جاهز للعمل 100%" : "يتطلب انتباه"}</span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {systemTestReport.steps?.map((step: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-[#081010] border border-[#1e2e2e] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-[#e8f5f5]">{step.step}</span>
                        {step.status === "success" && <span className="text-[#00ff88]">✓ نجاح</span>}
                        {step.status === "error" && <span className="text-red-400">✕ فشل</span>}
                        {step.status === "info" && <span className="text-[#0ea5e9]">ℹ معلومات</span>}
                      </div>
                      <p className="text-[11px] text-[#88b0b0]">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsSystemTestOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#111a1a] text-[#e8f5f5] hover:text-[#00d4aa] text-xs font-bold"
              >
                إغلاق التقرير
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
