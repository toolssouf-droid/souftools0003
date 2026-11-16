"use client";

import React, { useState } from "react";
import { Bell, BellOff, Loader2, Sparkles, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { useWebPushNotifications } from "@/hooks/useWebPushNotifications";

interface WebPushSubscriptionToggleProps {
  isRtl?: boolean;
  compact?: boolean;
}

export function WebPushSubscriptionToggle({ isRtl = true, compact = false }: WebPushSubscriptionToggleProps) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    sendTestPush,
  } = useWebPushNotifications();

  const [testStatus, setTestStatus] = useState<{ message: string; success: boolean } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!isSupported) {
    return null;
  }

  const handleToggle = async () => {
    setTestStatus(null);
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleSendTest = async () => {
    setIsTesting(true);
    setTestStatus(null);
    const res = await sendTestPush();
    setIsTesting(false);
    if (res && res.success) {
      setTestStatus({ message: res.message || "تم إرسال إشعار التجربة بنجاح!", success: true });
    } else {
      setTestStatus({ message: res?.error || res?.message || "تعذر إرسال الإشعار", success: false });
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5" dir={isRtl ? "rtl" : "ltr"}>
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
            isSubscribed
              ? "bg-[#00d4aa]/15 border-[#00d4aa]/30 text-[#00d4aa] hover:bg-[#00d4aa]/25 shadow-sm shadow-[#00d4aa]/10"
              : "bg-[#111a1a] border-[#1e2e2e] text-[#88b0b0] hover:text-[#e8f5f5] hover:border-[#00d4aa]/40"
          }`}
          title={isSubscribed ? "إلغاء تفعيل إشعارات سطح المكتب والهاتف" : "تفعيل إشعارات سطح المكتب والهاتف (Web Push)"}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isSubscribed ? (
            <Bell className="w-3.5 h-3.5 text-[#00d4aa]" />
          ) : (
            <BellOff className="w-3.5 h-3.5 text-[#88b0b0]" />
          )}
          <span>{isSubscribed ? (isRtl ? "الإشعارات مفعّلة" : "Push Active") : (isRtl ? "تفعيل الإشعارات" : "Enable Push")}</span>
        </button>

        {isSubscribed && (
          <button
            onClick={handleSendTest}
            disabled={isTesting}
            className="p-1 rounded-lg bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00d4aa]/40 text-[#88b0b0] hover:text-[#00d4aa] text-xs transition-all"
            title={isRtl ? "إرسال إشعار تجريبي فوري" : "Send Test Notification"}
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="p-3.5 rounded-2xl bg-gradient-to-b from-[#111a1a] to-[#0d1414] border border-[#1e2e2e] space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
              isSubscribed
                ? "bg-[#00d4aa]/20 border-[#00d4aa]/40 text-[#00d4aa] shadow-[0_0_12px_rgba(0,212,170,0.25)]"
                : "bg-[#162222] border-[#1e2e2e] text-[#88b0b0]"
            }`}
          >
            {isSubscribed ? <Bell className="w-4 h-4 text-[#00d4aa]" /> : <BellOff className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="text-xs font-bold text-[#e8f5f5] flex items-center gap-1.5">
              <span>{isRtl ? "إشعارات سطح المكتب والهاتف (Web Push)" : "Web Push Notifications"}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                  isSubscribed
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-neutral-800 text-neutral-400 border border-neutral-700"
                }`}
              >
                {isSubscribed ? (isRtl ? "نشط ومفعل" : "Active") : (isRtl ? "معطل" : "Disabled")}
              </span>
            </h4>
            <p className="text-[11px] text-[#88b0b0] mt-0.5">
              {isRtl
                ? "استلم تنبيهات المهام والومضات الذكية حتى عند إغلاق المتصفح تماماً."
                : "Receive tasks and smart alerts even when your browser is completely closed."}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
            isSubscribed
              ? "bg-[#162222] hover:bg-[#1a2828] text-rose-400 border border-rose-500/30 hover:border-rose-500/50"
              : "bg-gradient-to-r from-[#00d4aa] to-[#00f5c4] hover:from-[#00b894] hover:to-[#00d4aa] text-[#0a0f0f] shadow-[0_0_15px_rgba(0,212,170,0.3)] active:scale-95"
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isSubscribed ? (
            <span>{isRtl ? "إلغاء التفعيل" : "Disable"}</span>
          ) : (
            <span>{isRtl ? "تفعيل الآن" : "Enable Now"}</span>
          )}
        </button>
      </div>

      {/* Test Push Button & Error Message */}
      {isSubscribed && (
        <div className="pt-2 border-t border-[#1e2e2e]/60 flex items-center justify-between text-xs">
          <span className="text-[11px] text-[#6b9090]">
            {isRtl ? "تأكد من عمل الإشعارات على جهازك:" : "Test on your device:"}
          </span>
          <button
            onClick={handleSendTest}
            disabled={isTesting}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#162222] hover:bg-[#1a2828] border border-[#1e2e2e] hover:border-[#00d4aa]/40 text-[#00d4aa] text-[11px] font-medium transition-all cursor-pointer"
          >
            {isTesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            <span>{isRtl ? "إرسال إشعار تجريبي" : "Send Test Alert"}</span>
          </button>
        </div>
      )}

      {testStatus && (
        <div
          className={`p-2 rounded-xl text-[11px] flex items-center gap-2 border ${
            testStatus.success
              ? "bg-emerald-950/30 text-emerald-300 border-emerald-500/30"
              : "bg-rose-950/30 text-rose-300 border-rose-500/30"
          }`}
        >
          {testStatus.success ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>{testStatus.message}</span>
        </div>
      )}

      {error && (
        <div className="p-2 rounded-xl text-[11px] flex items-center gap-2 bg-rose-950/30 text-rose-300 border border-rose-500/30">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
