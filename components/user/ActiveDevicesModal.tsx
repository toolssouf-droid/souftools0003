"use client";

/**
 * Active Devices & Multi-Device Security Management Modal
 * 
 * Allows users to inspect all active sessions across phones, desktops, and browsers,
 * generate instant 6-digit sync pairing codes, connect multiple browsers on the same phone,
 * and revoke individual devices or terminate all remote sessions instantly.
 */

import React, { useState, useEffect } from "react";
import { Laptop, Smartphone, Tablet, Globe, ShieldAlert, LogOut, CheckCircle2, RefreshCw, X, Link2, KeyRound, Copy, Check, ArrowRight, ShieldCheck } from "lucide-react";
import { getClientDeviceId } from "@/lib/sync/useSyncClient";
import { useChatStore } from "@/store/chatStore";

interface DeviceItem {
  id: string;
  name: string;
  deviceType: string;
  browser: string;
  os: string;
  ipAddress: string;
  status: "active" | "revoked";
  isCurrent: boolean;
  lastSeenAt: string;
  createdAt: string;
}

interface ActiveDevicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActiveDevicesModal: React.FC<ActiveDevicesModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"devices" | "pair">("devices");
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Pairing state
  const [myPairCode, setMyPairCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const fetchDevices = async () => {
    setIsLoading(true);
    try {
      const currentDeviceId = getClientDeviceId();
      const res = await fetch(`/api/v1/users/me/devices?currentDeviceId=${encodeURIComponent(currentDeviceId)}`, {
        headers: { "x-device-id": currentDeviceId },
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setDevices(data.devices || []);
      }
    } catch (err) {
      console.error("Failed to load devices:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePairCode = async () => {
    setIsGeneratingCode(true);
    try {
      const res = await fetch("/api/v1/sync/pair");
      const data = await res.json().catch(() => ({}));
      if (data && data.success && data.code) {
        setMyPairCode(data.code);
      }
    } catch (err) {
      console.error("Failed to generate pair code:", err);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode || inputCode.trim().length !== 6) {
      setMessage({ text: "يرجى إدخال رمز مكون من 6 أرقام", type: "error" });
      return;
    }

    setIsPairing(true);
    setMessage(null);

    try {
      const currentDeviceId = getClientDeviceId();
      const res = await fetch("/api/v1/sync/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: inputCode.trim(),
          currentGuestId: currentDeviceId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (data && data.success) {
        setMessage({ text: "تم ربط المتصفح ومزامنة المحادثات بنجاح!", type: "success" });
        if (Array.isArray(data.sessions) && data.sessions.length > 0) {
          useChatStore.setState({
            sessions: data.sessions,
            activeSessionId: data.sessions[0]?.id || null,
            messages: data.sessions[0]?.messages || [],
          });
        }
        setInputCode("");
        fetchDevices();
        setTimeout(() => {
          setActiveTab("devices");
        }, 1500);
      } else {
        setMessage({ text: data.message || "رمز المزامنة غير صالح أو منتهي الصلاحية", type: "error" });
      }
    } catch {
      setMessage({ text: "تعذر الاتصال بخادم المزامنة", type: "error" });
    } finally {
      setIsPairing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDevices();
      generatePairCode();
      setMessage(null);
    }
  }, [isOpen]);

  const handleRevokeSingle = async (deviceId: string) => {
    setRevokingId(deviceId);
    try {
      const currentDeviceId = getClientDeviceId();
      const res = await fetch("/api/v1/users/me/devices/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": currentDeviceId,
        },
        body: JSON.stringify({ deviceId, currentDeviceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.success) {
        setMessage({ text: "تم إنهاء جلسة الجهاز بنجاح", type: "success" });
        fetchDevices();
      } else {
        setMessage({ text: data?.message || "تعذر إلغاء الجلسة", type: "error" });
      }
    } catch {
      setMessage({ text: "خطأ في الشبكة أثناء إلغاء الجلسة", type: "error" });
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    if (!confirm("هل أنت متأكد من رغبتك في تسجيل الخروج من كافة الأجهزة الأخرى؟")) return;
    setIsRevokingAll(true);
    try {
      const currentDeviceId = getClientDeviceId();
      const res = await fetch("/api/v1/users/me/devices/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": currentDeviceId,
        },
        body: JSON.stringify({ revokeAllOther: true, currentDeviceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.success) {
        setMessage({ text: "تم تأمين حسابك وإلغاء جميع الأجهزة الأخرى بنجاح", type: "success" });
        fetchDevices();
      } else {
        setMessage({ text: data?.message || "تعذر إلغاء الأجهزة", type: "error" });
      }
    } catch {
      setMessage({ text: "خطأ في الاتصال بالخادم", type: "error" });
    } finally {
      setIsRevokingAll(false);
    }
  };

  if (!isOpen) return null;

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "mobile":
        return <Smartphone className="w-5 h-5 text-emerald-400" />;
      case "tablet":
        return <Tablet className="w-5 h-5 text-sky-400" />;
      case "desktop":
        return <Laptop className="w-5 h-5 text-indigo-400" />;
      default:
        return <Globe className="w-5 h-5 text-zinc-400" />;
    }
  };

  const formatLastSeen = (isoStr: string) => {
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes < 2) return "نشط الآن";
      if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `منذ ${diffHours} ساعة`;
      const diffDays = Math.floor(diffHours / 24);
      return `منذ ${diffDays} يوم`;
    } catch {
      return "مؤخراً";
    }
  };

  const otherActiveDevicesCount = devices.filter((d) => !d.isCurrent && d.status === "active").length;

  return (
    <div
      id="active-devices-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200 cursor-pointer"
      dir="rtl"
    >
      <div
        id="active-devices-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] cursor-default"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">الأجهزة والجلسات السحابية</h2>
              <p className="text-xs text-zinc-400">إدارة الأجهزة والمزامنة الحية بين المتصفحات</p>
            </div>
          </div>
          <button
            id="close-devices-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-800 px-6 bg-zinc-950/40">
          <button
            id="tab-devices-btn"
            onClick={() => setActiveTab("devices")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "devices"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>الجلسات والأجهزة النشطة ({devices.length})</span>
          </button>
          <button
            id="tab-pair-btn"
            onClick={() => {
              setActiveTab("pair");
              if (!myPairCode) generatePairCode();
            }}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "pair"
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>ربط متصفح / هاتف آخر فوراً</span>
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab 1: Active Devices */}
        {activeTab === "devices" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                <span className="text-xs">جاري فحص الجلسات السحابية النشطة...</span>
              </div>
            ) : devices.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-xs">
                لا توجد أجهزة نشطة مسجلة حالياً
              </div>
            ) : (
              devices.map((device) => (
                <div
                  key={device.id}
                  id={`device-card-${device.id}`}
                  className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                    device.isCurrent
                      ? "bg-emerald-950/20 border-emerald-500/30"
                      : device.status === "revoked"
                      ? "bg-zinc-950/40 border-zinc-800/40 opacity-50"
                      : "bg-zinc-800/40 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center shrink-0">
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-zinc-100 truncate">
                          {device.name || `${device.browser} على ${device.os}`}
                        </span>
                        {device.isCurrent && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                            هذا المتصفح
                          </span>
                        )}
                        {device.status === "revoked" && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 rounded-full">
                            تم إنهاؤه
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-400 flex-wrap">
                        <span className="bg-zinc-800/90 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700/50">
                          {device.os} • {device.browser}
                        </span>
                        <span className="bg-emerald-950/40 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                          <span className="text-[10px] text-emerald-500 font-sans">IP:</span>
                          {device.ipAddress || "127.0.0.1"}
                        </span>
                        <span className="text-emerald-400/90 pr-1">{formatLastSeen(device.lastSeenAt)}</span>
                      </div>
                    </div>
                  </div>

                  {!device.isCurrent && device.status === "active" && (
                    <button
                      id={`revoke-btn-${device.id}`}
                      onClick={() => handleRevokeSingle(device.id)}
                      disabled={revokingId === device.id}
                      className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-white bg-red-500/10 hover:bg-red-600 border border-red-500/20 rounded-lg transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                    >
                      {revokingId === device.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LogOut className="w-3.5 h-3.5" />
                      )}
                      <span>إنهاء الجلسة</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Quick Cross-Browser Pairing */}
        {activeTab === "pair" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Box 1: Show Code from This Browser */}
            <div className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">رمز المزامنة لهذا الحساب</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                  افتح المتصفح الآخر على نفس الهاتف (أو جهاز آخر) واكتب هذا الرمز لمزامنة كافة المحادثات والذاكرة فورياً:
                </p>
              </div>

              {isGeneratingCode ? (
                <div className="py-4 flex items-center gap-2 text-zinc-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                  <span>جاري توليد الرمز...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-zinc-900 px-6 py-3 rounded-2xl border border-zinc-700/80 my-2">
                  <span className="text-2xl font-black tracking-widest text-emerald-400 font-mono">
                    {myPairCode ? `${myPairCode.slice(0, 3)} ${myPairCode.slice(3)}` : "------"}
                  </span>
                  <button
                    id="copy-pair-code-btn"
                    onClick={() => {
                      if (myPairCode) {
                        navigator.clipboard.writeText(myPairCode);
                        setCodeCopied(true);
                        setTimeout(() => setCodeCopied(false), 2000);
                      }
                    }}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="نسخ الرمز"
                  >
                    {codeCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              )}
              <span className="text-[11px] text-zinc-500">صالح لمدة 15 دقيقة ويتجدد تلقائياً</span>
            </div>

            {/* Box 2: Enter Code from Other Browser */}
            <form onSubmit={handlePairSubmit} className="p-5 rounded-2xl bg-zinc-950/60 border border-zinc-800 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-white">أو أدخل الرمز من المتصفح الأول هنا</h3>
              </div>
              <p className="text-xs text-zinc-400">
                إذا كان لديك رمز ظاهر في المتصفح الآخر، أدخله هنا لربط هذا المتصفح فورياً:
              </p>

              <div className="flex items-center gap-2 pt-2">
                <input
                  id="pair-code-input"
                  type="text"
                  maxLength={6}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="مثال: 849201"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-center font-mono text-lg tracking-widest focus:outline-none focus:border-emerald-500"
                />
                <button
                  id="submit-pair-code-btn"
                  type="submit"
                  disabled={isPairing || inputCode.length !== 6}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0"
                >
                  {isPairing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  <span>ربط ومزامنة</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="text-xs text-zinc-400">
            {activeTab === "devices" ? (
              otherActiveDevicesCount > 0 ? (
                <span>يوجد <strong>{otherActiveDevicesCount}</strong> جهاز آخر متصل بالحساب</span>
              ) : (
                <span>لا توجد أجهزة أخرى نشطة حالياً</span>
              )
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>المزامنة السحابية محمية ومباشرة عبر PostgreSQL</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "devices" && otherActiveDevicesCount > 0 && (
              <button
                id="revoke-all-other-devices-btn"
                onClick={handleRevokeAllOther}
                disabled={isRevokingAll}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors shadow-lg shadow-red-950/40 flex items-center gap-2 cursor-pointer"
              >
                {isRevokingAll ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                <span>تسجيل الخروج من كافة الأجهزة الأخرى</span>
              </button>
            )}
            <button
              id="bottom-close-devices-modal-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-100 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <X className="w-4 h-4 text-zinc-400" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

