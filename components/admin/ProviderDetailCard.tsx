"use client";

import React, { useState } from "react";
import { AI_PROVIDERS } from "@/lib/providers";
import { PROVIDER_KEY_FORMATS, validateKeySyntax } from "@/lib/keyFormats";
import { decryptKey } from "@/lib/encryption";
import {
  Key,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Activity,
  Sparkles,
  Zap,
  RefreshCw,
  Star,
  ChevronUp,
  ChevronDown,
  X,
  Layers,
  ShieldCheck,
  Tag,
  Info,
  AlertCircle
} from "lucide-react";

export interface ApiKeyItem {
  key: string;
  shortName: string;
  reqCount: number;
  lastUsed: string;
  status: "active" | "failed" | "slow";
  latencyMs?: number;
}

export interface ProviderDetail {
  id: string; // unique internal instance ID or providerId
  providerId: string;
  accountId?: string;
  name: string;
  priority: number;
  routingMode: "round_robin" | "priority";
  models: string[];
  activeModels?: string[];
  defaultAgentModel?: string;
  systemPrompt?: string;
  keys: ApiKeyItem[];
}

interface ProviderDetailCardProps {
  provider: ProviderDetail;
  onUpdateProvider: (updated: ProviderDetail) => void;
  onRemoveProvider: (id: string) => void;
  onMovePriority: (id: string, direction: "up" | "down") => void;
  onTestKey: (providerId: string, keyVal: string, accountId?: string) => Promise<{ status: "active" | "failed" | "slow"; latencyMs: number }>;
  healthData?: any;
  onUnbanModel?: (providerId: string, model: string) => void;
  onUnbanKey?: (providerId: string, key: string) => void;
}

export const ProviderDetailCard: React.FC<ProviderDetailCardProps> = ({
  provider,
  onUpdateProvider,
  onRemoveProvider,
  onMovePriority,
  onTestKey,
  healthData,
  onUnbanModel,
  onUnbanKey,
}) => {
  const [newKeyInput, setNewKeyInput] = useState("");
  const [fetchingModels, setFetchingModels] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [testingKeyIdx, setTestingKeyIdx] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  const showNotification = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Toggle routing mode
  const handleToggleRoutingMode = (mode: "round_robin" | "priority") => {
    onUpdateProvider({
      ...provider,
      routingMode: mode,
    });
    showNotification(`تم تغيير نمط التوزيع إلى ${mode === "priority" ? "Priority" : "Round Robin"}`, "info");
  };

  // Delete a model tag
  const handleRemoveModelTag = (tagToRemove: string) => {
    const updatedModels = provider.models.filter((m) => m !== tagToRemove);
    const currentActive = provider.activeModels !== undefined ? provider.activeModels : provider.models;
    const updatedActiveModels = currentActive.filter((m) => m !== tagToRemove);
    onUpdateProvider({
      ...provider,
      models: updatedModels,
      activeModels: updatedActiveModels,
      defaultAgentModel: provider.defaultAgentModel === tagToRemove ? (updatedModels[0] || "") : provider.defaultAgentModel,
    });
    showNotification(`تم حذف النموذج ${tagToRemove}`, "info");
  };

  // Deselect all models
  const handleDeselectAllModels = () => {
    onUpdateProvider({
      ...provider,
      activeModels: [],
    });
    showNotification("تم إلغاء تحديد جميع النماذج لهذا المزود ⭕", "info");
  };

  // Select all models
  const handleSelectAllModels = () => {
    onUpdateProvider({
      ...provider,
      activeModels: [...provider.models],
    });
    showNotification("تم تحديد جميع النماذج لهذا المزود 🟢", "success");
  };

  // Fetch live models from provider
  const handleFetchLatestModels = async () => {
    setFetchingModels(true);
    try {
      const pDef = AI_PROVIDERS.find((p) => p.id === provider.providerId);
      let fetchedModels: string[] | null = null;
      let errorMessage: string | null = null;

      // Attempt to fetch from API, passing decrypted active key if present
      const activeKeyRaw = provider.keys.find(k => k.status === "active")?.key || provider.keys[0]?.key || "";
      const activeKey = activeKeyRaw ? (decryptKey(activeKeyRaw) || activeKeyRaw) : "";
      
      try {
        const res = await fetch("/api/admin/models", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId: provider.providerId,
            apiKey: activeKey,
            accountId: provider.providerId === "cloudflare" ? provider.accountId : undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success && Array.isArray(data.models) && data.models.length > 0) {
          fetchedModels = data.models;
        } else {
          errorMessage = data.error || (res.status === 200 ? "لم يعثر المزود على نماذج محادثة جديدة" : `تعذر جلب النماذج (رمز ${res.status})`);
        }
      } catch (e: any) {
        errorMessage = `فشل الاتصال: ${e?.message || "خطأ في الشبكة"}`;
      }

      if (!fetchedModels || fetchedModels.length === 0) {
        showNotification(errorMessage || "لم يتم العثور على نماذج نشطة، يرجى التحقق من صحة مفتاح الـ API.", "error");
        return;
      }

      // Replace completely with fetched models
      const newModelsList = Array.from(new Set([...fetchedModels]));

      // Verify if default agent model is still valid
      const isDefaultValid = provider.defaultAgentModel && newModelsList.includes(provider.defaultAgentModel);
      
      onUpdateProvider({
        ...provider,
        models: newModelsList,
        activeModels: [...newModelsList],
        defaultAgentModel: isDefaultValid ? provider.defaultAgentModel : newModelsList[0],
      });

      showNotification(`تم جلب وتحديث ${newModelsList.length} نموذج حي ومباشر من حسابك لدى ${pDef?.name || provider.providerId} بنجاح 🟢`, "success");
    } catch (e) {
      showNotification("تعذر اتصال المزود، يرجى المحاولة لاحقاً", "error");
    } finally {
      setFetchingModels(false);
    }
  };

  // Select Default Model for Souf Agent
  const handleSetAgentModel = (modelName: string) => {
    onUpdateProvider({
      ...provider,
      defaultAgentModel: modelName,
    });
    showNotification(`تم اختيار ${modelName} كنموذج افتراضي لوكيل Souf Agent ⭐`);
  };

  // Ping Test Key
  const handlePingKey = async (idx: number, keyObj: ApiKeyItem) => {
    setTestingKeyIdx(idx);
    const res = await onTestKey(provider.providerId, keyObj.key, provider.accountId);
    
    const updatedKeys = [...provider.keys];
    updatedKeys[idx] = {
      ...updatedKeys[idx],
      status: res.status,
      latencyMs: res.latencyMs,
      lastUsed: "الآن",
      reqCount: updatedKeys[idx].reqCount + 1,
    };

    onUpdateProvider({
      ...provider,
      keys: updatedKeys,
    });

    setTestingKeyIdx(null);
  };

  // Remove Key
  const handleRemoveKey = (idx: number) => {
    const updatedKeys = provider.keys.filter((_, i) => i !== idx);
    onUpdateProvider({
      ...provider,
      keys: updatedKeys,
    });
    showNotification("تم حذف المفتاح بنجاح");
  };

  // Add New Key (supports single key or multi-key batch separated by commas/newlines)
  const handleAddNewKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyInput.trim()) return;

    const parts = newKeyInput
      .split(/[\r\n,;]+/)
      .map((k) => k.replace(/^["']|["']$/g, "").trim())
      .filter((k) => (provider.providerId === "ollama" ? k.length > 0 : k.length >= 8) && !k.includes("demo"));

    if (parts.length === 0) {
      showNotification("يرجى إدخال مفتاح واحد صالح على الأقل");
      return;
    }

    const newKeyObjects: ApiKeyItem[] = [];
    let validCount = 0;

    for (const rawKey of parts) {
      if (provider.keys.some((k) => k.key === rawKey)) continue;

      const formattedKey =
        provider.providerId === "cloudflare" &&
        provider.accountId &&
        !/^[a-f0-9]{16,64}[:|]/i.test(rawKey)
          ? `${provider.accountId}:${rawKey}`
          : rawKey;
      const syntaxCheck = validateKeySyntax(provider.providerId, formattedKey);
      const short = rawKey.length > 12 
        ? `${rawKey.slice(0, 4)}••••[${rawKey.slice(-4)}]` 
        : rawKey;

      newKeyObjects.push({
        key: formattedKey,
        shortName: short,
        reqCount: 0,
        lastUsed: "حديثاً",
        status: syntaxCheck.valid ? "active" : "failed",
        latencyMs: 85,
      });

      if (syntaxCheck.valid) validCount++;
    }

    if (newKeyObjects.length === 0) {
      showNotification("المفاتيح المدخلة موجودة مسبقاً في المجمّع");
      return;
    }

    onUpdateProvider({
      ...provider,
      keys: [...provider.keys, ...newKeyObjects],
    });

    setNewKeyInput("");
    setShowKeyForm(false);
    showNotification(`تمت إضافة ${newKeyObjects.length} مفتاح إلى مجمّع التوزيع التناوبي (Round-Robin Pool) بنجاح 🎉`);
  };

  return (
    <div className="glass-card p-5 rounded-2xl border border-[#1e2e2e] hover:border-[#00d4aa]/40 transition-all space-y-4 relative overflow-hidden bg-[#0a0f0f]/80">
      {/* Toast Notification Popup */}
      {toast && (
        <div
          className={`absolute top-2 left-2 right-2 text-xs font-bold px-3.5 py-2 rounded-xl shadow-2xl z-20 animate-fade-in flex items-center justify-between gap-2 border ${
            toast.type === "error"
              ? "bg-[#ef4444] text-white border-[#f87171]"
              : toast.type === "info"
              ? "bg-[#0284c7] text-white border-[#38bdf8]"
              : "bg-[#00d4aa] text-[#0a0f0f] border-[#00ffc2]"
          }`}
        >
          <span className="truncate">{toast.msg}</span>
          {toast.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-white shrink-0" />
          ) : toast.type === "info" ? (
            <Info className="w-4 h-4 text-white shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[#0a0f0f] shrink-0" />
          )}
        </div>
      )}

      {/* Header: Provider Name + Priority Rank + Move Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1e2e2e] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00d4aa]/20 to-[#0ea5e9]/20 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa] font-extrabold text-xs shadow-inner">
            #{provider.priority}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-[#e8f5f5]">{provider.name}</h3>
              <span className="text-[10px] bg-[#111a1a] text-[#00ff88] px-2 py-0.5 rounded-full border border-[#1e2e2e] font-mono">
                أولوية {provider.priority}
              </span>
            </div>
            <p className="text-[10px] text-[#4a7070] mt-0.5">
              عدد المفاتيح: {provider.keys.length} | الموديل الأنشط: {provider.defaultAgentModel || provider.models[0] || "تلقائي"}
            </p>
          </div>
        </div>

        {/* Priority Controls & Delete Provider */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            onClick={() => onMovePriority(provider.id, "up")}
            className="p-1.5 rounded-lg bg-[#111a1a] hover:bg-[#1e2e2e] text-[#4a7070] hover:text-[#00d4aa] transition-colors"
            title="رفع الأولوية (أعلى)"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => onMovePriority(provider.id, "down")}
            className="p-1.5 rounded-lg bg-[#111a1a] hover:bg-[#1e2e2e] text-[#4a7070] hover:text-[#00d4aa] transition-colors"
            title="خفض الأولوية (أسفل)"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => onRemoveProvider(provider.id)}
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
            title="إزالة المزود"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Routing Mode Toggle */}
      <div className="flex items-center justify-between bg-[#111a1a] p-2 rounded-xl border border-[#1e2e2e] text-xs">
        <span className="text-[#4a7070] font-bold">نمط التوزيع والاستدعاء:</span>
        <div className="flex items-center gap-1 bg-[#0a0f0f] p-1 rounded-lg border border-[#1e2e2e]">
          <button
            type="button"
            onClick={() => handleToggleRoutingMode("priority")}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
              provider.routingMode === "priority"
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-sm"
                : "text-[#4a7070] hover:text-[#e8f5f5]"
            }`}
          >
            Priority (الأولوية)
          </button>
          <button
            type="button"
            onClick={() => handleToggleRoutingMode("round_robin")}
            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
              provider.routingMode === "round_robin"
                ? "bg-[#0ea5e9] text-[#0a0f0f] shadow-sm"
                : "text-[#4a7070] hover:text-[#e8f5f5]"
            }`}
          >
            Round Robin (التناوب)
          </button>
        </div>
      </div>

      {provider.providerId === "cloudflare" && (
        <div className="space-y-1.5">
          <label
            htmlFor={`cloudflare-account-${provider.id}`}
            className="block text-xs font-bold text-[#e8f5f5]"
          >
            Cloudflare Account ID
          </label>
          <input
            id={`cloudflare-account-${provider.id}`}
            value={provider.accountId || ""}
            onChange={(e) => onUpdateProvider({ ...provider, accountId: e.target.value.trim() })}
            placeholder="32-character Account ID"
            autoComplete="off"
            spellCheck={false}
            dir="ltr"
            className="w-full bg-[#0a0f0f] text-xs font-mono text-[#00d4aa] placeholder-[#4a7070] p-2.5 rounded-lg border border-[#1e2e2e] focus:border-[#00d4aa] outline-none"
          />
        </div>
      )}

      {/* Custom Model System Prompt */}
      <div className="space-y-1.5 bg-[#111a1a] p-3 rounded-xl border border-[#1e2e2e]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#e8f5f5] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00d4aa]" />
            السيستم برومبت الخاص بالنموذج (System Prompt):
          </span>
          <span className="text-[10px] text-[#4a7070]">
            أدخل اسم وتوجيهات النموذج المخصص هنا
          </span>
        </div>
        <textarea
          rows={3}
          value={provider.systemPrompt || ""}
          onChange={(e) => {
            onUpdateProvider({
              ...provider,
              systemPrompt: e.target.value,
            });
          }}
          placeholder="أدخل اسم النموذج وتوجيهات النظام المخصصة له هنا (مثال: أنت نموذج [اسم النموذج]. وظيفتك الإجابة بأسلوب محدد واتباع التعليمات التالية...)..."
          className="w-full bg-[#0a0f0f] text-xs font-sans text-[#e8f5f5] placeholder-[#4a7070] p-2.5 rounded-lg border border-[#1e2e2e] focus:border-[#00d4aa] outline-none leading-relaxed resize-y"
        />
      </div>

      {/* Available Models (Tags + Fetch Button + Select for Agent) */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between text-xs gap-2">
          <span className="font-bold text-[#e8f5f5] flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-[#00d4aa]" />
            النماذج المتاحة ({provider.models.length}):
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleFetchLatestModels}
              disabled={fetchingModels}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-[#00d4aa]/15 text-[#00d4aa] hover:bg-[#00d4aa] hover:text-[#0a0f0f] transition-all flex items-center gap-1 border border-[#00d4aa]/30 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${fetchingModels ? "animate-spin" : ""}`} />
              <span>{fetchingModels ? "جاري الاتصال بالمزود..." : "جلب أحدث نماذج الذكاء الاصطناعي ⚡"}</span>
            </button>

            <button
              type="button"
              onClick={handleDeselectAllModels}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/30 cursor-pointer"
              title="إزالة التحديد من جميع النماذج التي تم جلبها"
            >
              <span>إلغاء التحديد ⭕</span>
            </button>

            <button
              type="button"
              onClick={handleSelectAllModels}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500 hover:text-black transition-all border border-green-500/30 cursor-pointer"
              title="تحديد جميع النماذج لتعمل بالترتيب"
            >
              <span>تحديد الكل 🟢</span>
            </button>
          </div>
        </div>

        {/* Model Tags with Ordered Sequence Badges */}
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] min-h-[44px]">
          {provider.models.length === 0 ? (
            <span className="text-[10px] text-[#4a7070] italic">لا توجد نماذج مسجلة مسبقاً، انقر على &quot;جلب أحدث نماذج الذكاء الاصطناعي&quot; لجلب النماذج الحية عبر المفتاح</span>
          ) : (
            provider.models.map((mTag, idx) => {
              const isAgentDefault = provider.defaultAgentModel === mTag;
              const activeModelsList = provider.activeModels !== undefined ? provider.activeModels : [...provider.models];
              const orderIndex = activeModelsList.indexOf(mTag);
              const isModelActive = orderIndex !== -1;

              // Check live health status
              const modelKey = `${provider.providerId.toLowerCase()}:${mTag.toLowerCase()}`;
              const mHealth = healthData?.models?.[modelKey];
              const isQuarantined = mHealth?.quarantined;

              return (
                <div
                  key={idx}
                  className={`group text-[10px] px-2.5 py-1 rounded-lg border font-mono flex items-center gap-1.5 transition-all ${
                    isQuarantined
                      ? "bg-red-500/15 border-red-500/60 text-red-300 shadow-sm shadow-red-500/20"
                      : isAgentDefault
                      ? "bg-[#00d4aa]/20 border-[#00d4aa] text-[#00d4aa] font-bold"
                      : isModelActive
                        ? "bg-[#111a1a] border-[#00d4aa]/60 text-[#e8f5f5] shadow-sm shadow-[#00d4aa]/10"
                        : "bg-[#050808] border-[#131d1d] text-[#334c4c] opacity-50 hover:opacity-80"
                  }`}
                >
                  {/* Sequence Order Badge or Checkbox */}
                  <button
                    type="button"
                    onClick={() => {
                      let nextActive: string[];
                      if (isModelActive) {
                        // Remove from active sequence
                        nextActive = activeModelsList.filter(m => m !== mTag);
                      } else {
                        // Append to the end of sequence
                        nextActive = [...activeModelsList, mTag];
                      }
                      onUpdateProvider({
                        ...provider,
                        activeModels: nextActive,
                      });
                      
                      const newPos = nextActive.indexOf(mTag);
                      if (newPos !== -1) {
                        showNotification(`تم تحديد النموذج ${mTag} في المرتية رقم ${newPos + 1}`);
                      } else {
                        showNotification(`تم إلغاء تحديد النموذج ${mTag}`);
                      }
                    }}
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black cursor-pointer transition-all ${
                      isQuarantined
                        ? "bg-red-500 text-white"
                        : isModelActive
                        ? "bg-[#00d4aa] text-[#0a0f0f] shadow"
                        : "bg-[#111a1a] text-[#4a7070] border border-[#1e2e2e] group-hover:border-[#00d4aa]"
                    }`}
                    title={isModelActive ? `الترتيب الحالي: #${orderIndex + 1} (انقر للإلغاء)` : "انقر لتحديده في التسلسل"}
                  >
                    {isModelActive ? orderIndex + 1 : "+"}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetAgentModel(mTag)}
                    title="انقر لتحديده كالنموذج الافتراضي للوكيل"
                    className="flex items-center gap-1 cursor-pointer hover:underline"
                  >
                    {isAgentDefault && <Star className="w-3 h-3 fill-[#00d4aa] text-[#00d4aa]" />}
                    <span className={isQuarantined ? "text-red-300 font-semibold" : isModelActive ? "text-[#e8f5f5] font-semibold" : "text-[#4a7070]"}>
                      {mTag}
                    </span>
                  </button>

                  {/* Step Order Badge Tag */}
                  {isModelActive && !isQuarantined && (
                    <span className="text-[8px] bg-[#00d4aa]/15 text-[#00d4aa] px-1 py-0.2 rounded border border-[#00d4aa]/30 font-bold">
                      #{orderIndex + 1}
                    </span>
                  )}

                  {/* Quarantine Active Status Badge */}
                  {isQuarantined && (
                    <span className="text-[8px] bg-red-500/25 text-red-400 px-1.5 py-0.5 rounded border border-red-500/40 font-sans font-bold animate-pulse flex items-center gap-1" title={mHealth.lastError || "محظور لتكرار الفشل"}>
                      <span>⏳ محظور ({mHealth.remainingFormatted})</span>
                      {onUnbanModel && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUnbanModel(provider.providerId, mTag);
                            showNotification(`تم فك حظر النموذج ${mTag} 🔄`);
                          }}
                          className="hover:text-white bg-red-600/40 px-1 rounded text-[8px] cursor-pointer"
                          title="فك الحظر الفوري عن النموذج"
                        >
                          فك
                        </button>
                      )}
                    </span>
                  )}

                  {/* Failure Warning Badge before Quarantine */}
                  {!isQuarantined && mHealth && mHealth.consecutiveFailures > 0 && (
                    <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded border border-amber-500/40 font-sans" title="عدد الإخفاقات الحالية قبل الحظر">
                      ⚠️ {mHealth.consecutiveFailures}/3 إخفاق
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveModelTag(mTag)}
                    className="text-[#4a7070] hover:text-red-400 transition-colors ml-0.5"
                    title="حذف هذا النموذج"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* API Keys List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs pb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[#e8f5f5] flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-[#00d4aa]" />
              مجمّع مفاتيح API ({provider.keys.length}):
            </span>
            {provider.keys.length > 1 && (
              <span className="text-[9px] bg-[#00d4aa]/15 text-[#00d4aa] px-2 py-0.5 rounded-full border border-[#00d4aa]/30 font-medium">
                ⚡ توزيع تناوبي ذكي (Round-Robin)
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setNewKeyInput("");
              setShowKeyForm(!showKeyForm);
            }}
            className="text-[10px] font-bold text-[#00d4aa] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>إضافة مفتاح جديد</span>
          </button>
        </div>

        {/* Inline Add Key Form */}
        {showKeyForm && (
          <div className="space-y-1.5 p-2 bg-[#111a1a] rounded-xl border border-[#00d4aa]/40">
            <form onSubmit={handleAddNewKey} className="flex items-center gap-2">
              <input
                type="text"
                value={newKeyInput}
                onChange={(e) => setNewKeyInput(e.target.value)}
                placeholder="أدخل مفتاحاً واحداً أو عدة مفاتيح مفصولة بفواصل أو أسطر للتوزيع التناوبي..."
                className="flex-1 bg-[#0a0f0f] text-xs font-mono text-[#00d4aa] px-3 py-1.5 rounded-lg border border-[#1e2e2e] outline-none focus:border-[#00d4aa]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-[#00d4aa] text-[#0a0f0f] font-bold text-xs rounded-lg hover:scale-105 transition-all"
              >
                إضافة للمجمّع
              </button>
            </form>
            <div className="flex items-center gap-1.5 text-[10px] text-[#4a7070] px-1 font-sans">
              <Info className="w-3 h-3 text-[#00d4aa] shrink-0" />
              <span>
                {PROVIDER_KEY_FORMATS[provider.providerId]?.descriptionAr || "مجمّع المفاتيح الذكي"}: يمكنك لصق عدة مفاتيح معاً لتفعيل التناوب التلقائي وحماية المفاتيح من الحظر (Round-Robin).
              </span>
            </div>
          </div>
        )}

        {/* Keys Table / Items */}
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {provider.keys.length === 0 ? (
            <p className="text-[11px] text-[#4a7070] italic text-center py-3 bg-[#0a0f0f] rounded-xl border border-[#1e2e2e]">
              لا يوجد أي مفتاح API مسجل لهذا المزود
            </p>
          ) : (
            provider.keys.map((kObj, kIdx) => {
              const isTesting = testingKeyIdx === kIdx;
              const isPass = kObj.status === "active";
              const isSlow = kObj.status === "slow";

              // Check if key is quarantined
              const mask = kObj.key.length > 8 ? `${kObj.key.slice(0, 4)}...${kObj.key.slice(-4)}` : kObj.key;
              const keyHealth = healthData?.keys?.[`${provider.providerId.toLowerCase()}:${mask}`];
              const isKeyQuarantined = keyHealth?.quarantined;

              return (
                <div
                  key={kIdx}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl border text-xs gap-2 ${
                    isKeyQuarantined
                      ? "bg-red-500/10 border-red-500/50"
                      : "bg-[#0a0f0f] border-[#1e2e2e] hover:border-[#1e2e2e]/80"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Dot Indicator */}
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isKeyQuarantined
                          ? "bg-red-500 shadow-sm shadow-red-500/80 animate-pulse"
                          : isPass
                          ? "bg-green-400 shadow-sm shadow-green-400/50"
                          : isSlow
                          ? "bg-amber-400 shadow-sm shadow-amber-400/50"
                          : "bg-red-500 shadow-sm shadow-red-500/50"
                      }`}
                      title={isKeyQuarantined ? "🔴 محظور مؤقتاً" : isPass ? "🟢 نشط" : isSlow ? "🟡 بطيء" : "🔴 فشل"}
                    />

                    <span className="font-mono text-[#00d4aa] font-bold text-xs tracking-wide">
                      {kObj.shortName}
                    </span>

                    {/* Key Quarantine Warning / Badge */}
                    {isKeyQuarantined ? (
                      <span className="text-[9px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded border border-red-500/40 font-sans flex items-center gap-1 font-bold">
                        <span>⏳ فترة تهدئة ({keyHealth.remainingFormatted})</span>
                        {onUnbanKey && (
                          <button
                            type="button"
                            onClick={() => {
                              onUnbanKey(provider.providerId, kObj.key);
                              showNotification(`تم فك حظر المفتاح ${kObj.shortName} 🔄`);
                            }}
                            className="hover:text-white bg-red-600/50 px-1.5 py-0.2 rounded text-[8px] cursor-pointer"
                            title="فك الحظر عن المفتاح"
                          >
                            فك الحظر
                          </button>
                        )}
                      </span>
                    ) : (
                      <>
                        <span className="text-[10px] bg-[#111a1a] text-[#4a7070] px-1.5 py-0.5 rounded font-mono border border-[#1e2e2e]">
                          req:{kObj.reqCount}
                        </span>

                        <span className="text-[10px] text-[#4a7070]">
                          {kObj.lastUsed}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <span className="text-[10px] font-mono text-[#4a7070]">
                      {kObj.latencyMs ? `${kObj.latencyMs}ms` : ""}
                    </span>

                    <button
                      type="button"
                      onClick={() => handlePingKey(kIdx, kObj)}
                      disabled={isTesting}
                      className="px-2 py-1 bg-[#111a1a] hover:bg-[#00d4aa]/20 text-[#4a7070] hover:text-[#00d4aa] rounded-lg border border-[#1e2e2e] text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="فحص Ping المفتاح فوراً"
                    >
                      <Activity className={`w-3 h-3 ${isTesting ? "animate-spin text-[#00d4aa]" : ""}`} />
                      <span>{isTesting ? "فحص..." : "فحص"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveKey(kIdx)}
                      className="p-1 text-[#4a7070] hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                      title="حذف المفتاح"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
