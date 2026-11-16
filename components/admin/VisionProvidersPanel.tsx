"use client";

import React, { useState, useEffect } from "react";
import { getAuthCookie } from "@/lib/authCookies";
import {
  Eye,
  Zap,
  Star,
  DollarSign,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Sliders,
  Sparkles,
  Layers,
  Activity,
  ShieldCheck,
  Cpu,
} from "lucide-react";

export interface VisionModelConfig {
  id: string;
  name: string;
  providerId: string;
  providerNameAr: string;
  visionSupport: boolean;
  status: "active" | "degraded" | "inactive";
  priority: number;
  costTier: "free" | "low" | "medium" | "high";
  speedTier: "fastest" | "balanced" | "detailed";
}

export const VisionProvidersPanel: React.FC = () => {
  const [strategy, setStrategy] = useState<"fastest" | "quality" | "lowest_cost">("fastest");
  const [models, setModels] = useState<VisionModelConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeCount, setActiveCount] = useState<number>(0);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = {};
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/vision-providers", { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStrategy(data.strategy || "fastest");
        setModels(data.models || []);
        setActiveCount(data.activeCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch vision providers config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleStrategyChange = async (newStrategy: "fastest" | "quality" | "lowest_cost") => {
    setStrategy(newStrategy);
    setSaving(true);
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      await fetch("/api/admin/vision-providers", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ strategy: newStrategy }),
      });
    } catch (err) {
      console.error("Failed to update strategy:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (modelId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    setModels((prev) =>
      prev.map((m) => (m.id === modelId ? { ...m, status: newStatus as any } : m))
    );

    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      await fetch("/api/admin/vision-providers", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ modelId, status: newStatus }),
      });
      fetchConfig();
    } catch (err) {
      console.error("Failed to update model status:", err);
    }
  };

  const handlePriorityChange = async (modelId: string, newPriority: number) => {
    setModels((prev) =>
      prev.map((m) => (m.id === modelId ? { ...m, priority: newPriority } : m))
    );

    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      await fetch("/api/admin/vision-providers", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ modelId, priority: newPriority }),
      });
    } catch (err) {
      console.error("Failed to update priority:", err);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950 p-6 border border-purple-500/20 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Eye className="w-6 h-6" />
              </span>
              <h2 className="text-xl font-bold text-white">نظام الرؤية البصرية المتعدد الوسائط (AI Vision System)</h2>
            </div>
            <p className="text-sm text-slate-300">
              إدارة نماذج الرؤية البصرية المستقلة (Multimodal Vision Models) لتمكين الوكيل الذكي من تحليل وفهم وتعديل ومقارنة الصور بسلاسة عبر أي مزود متاح.
            </p>
          </div>

          <button
            onClick={fetchConfig}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            تحديث الحالة
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">النماذج النشطة</span>
            <div className="text-lg font-bold text-emerald-400 flex items-center gap-1.5 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
              {activeCount} نماذج
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">استراتيجية الاختيار</span>
            <div className="text-lg font-bold text-purple-400 flex items-center gap-1.5 mt-0.5">
              <Sliders className="w-4 h-4" />
              {strategy === "fastest" ? "الأسرع ⚡" : strategy === "quality" ? "الأعلى جودة 🌟" : "الأقل تكلفة 💰"}
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">حلقة مراجعة الجودة</span>
            <div className="text-lg font-bold text-cyan-400 flex items-center gap-1.5 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
              مفعلة تلقائياً (Loop)
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">استقلالية النماذج</span>
            <div className="text-lg font-bold text-indigo-400 flex items-center gap-1.5 mt-0.5">
              <Cpu className="w-4 h-4" />
              ربط ديناميكي كامل
            </div>
          </div>
        </div>
      </div>

      {/* Auto Selection Strategy Selector */}
      <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          استراتيجية التوجيه التلقائي لنماذج الرؤية (Auto Selection Strategy)
        </h3>
        <p className="text-xs text-slate-400">
          حدد كيفية قيام طبقة Vision Capability Layer باختيار النموذج المناسب تلقائياً أثناء تحليل أو مقارنة الصور:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <button
            onClick={() => handleStrategyChange("fastest")}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
              strategy === "fastest"
                ? "bg-purple-950/40 border-purple-500/50 text-white shadow-lg shadow-purple-950/30"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-bold text-sm text-purple-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-yellow-400" />
                ⚡ الأسرع استجابة (Fastest)
              </span>
              {strategy === "fastest" && <span className="w-2 h-2 rounded-full bg-purple-400"></span>}
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              يعطي الأولوية للنماذج فائقة السرعة مثل Gemini 2.0 Flash و Qwen VL لضمان استجابة لحظية في المحادثة.
            </p>
          </button>

          <button
            onClick={() => handleStrategyChange("quality")}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
              strategy === "quality"
                ? "bg-indigo-950/40 border-indigo-500/50 text-white shadow-lg shadow-indigo-950/30"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-bold text-sm text-indigo-300 flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-400" />
                🌟 الأعلى دقة وجودة (Highest Quality)
              </span>
              {strategy === "quality" && <span className="w-2 h-2 rounded-full bg-indigo-400"></span>}
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              يعتمد نماذج الاستدلال البصري المتقدمة مثل GPT-4o Vision و Claude 3.5 Sonnet للتحليلات المعقدة والمستندات.
            </p>
          </button>

          <button
            onClick={() => handleStrategyChange("lowest_cost")}
            className={`p-4 rounded-xl border text-right transition-all flex flex-col justify-between ${
              strategy === "lowest_cost"
                ? "bg-emerald-950/40 border-emerald-500/50 text-white shadow-lg shadow-emerald-950/30"
                : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-bold text-sm text-emerald-300 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                💰 الأقل تكلفة (Lowest Cost)
              </span>
              {strategy === "lowest_cost" && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              يعتمد الفئات المجانية والمنخفضة التكلفة أولاً للحفاظ على استهلاك الحصص اليومية.
            </p>
          </button>
        </div>
      </div>

      {/* Vision Models Table */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            قائمة مزودي ونماذج الرؤية البصرية المدعومة (AI Vision Providers)
          </h3>
          <span className="text-xs text-slate-400">إجمالي النماذج: {models.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-950/60 text-slate-400 text-xs border-b border-slate-800">
              <tr>
                <th className="p-3 font-medium">اسم النموذج</th>
                <th className="p-3 font-medium">المزود</th>
                <th className="p-3 font-medium">دعم الرؤية</th>
                <th className="p-3 font-medium">السرعة</th>
                <th className="p-3 font-medium">التكلفة</th>
                <th className="p-3 font-medium">الأولوية</th>
                <th className="p-3 font-medium text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {models.map((model) => (
                <tr key={model.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-slate-100">{model.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{model.id}</div>
                  </td>

                  <td className="p-3 text-slate-300 font-medium">
                    {model.providerNameAr}
                  </td>

                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      مدعوم 🟢
                    </span>
                  </td>

                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${
                      model.speedTier === "fastest"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-blue-500/10 text-blue-400"
                    }`}>
                      {model.speedTier === "fastest" ? "⚡ سريع جداً" : model.speedTier === "detailed" ? "🔍 دقيق جداً" : "🎯 متوازن"}
                    </span>
                  </td>

                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md ${
                      model.costTier === "free"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : model.costTier === "low"
                        ? "bg-cyan-500/10 text-cyan-400"
                        : "bg-purple-500/10 text-purple-400"
                    }`}>
                      {model.costTier === "free" ? "🆓 مجاني" : model.costTier === "low" ? "💵 منخفض" : "💎 متوسط/مرتفع"}
                    </span>
                  </td>

                  <td className="p-3">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={model.priority}
                      onChange={(e) => handlePriorityChange(model.id, parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-center text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                  </td>

                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleToggleStatus(model.id, model.status)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        model.status === "active"
                          ? "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30"
                      }`}
                    >
                      {model.status === "active" ? "نشط 🟢" : "معطل 🔴"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
