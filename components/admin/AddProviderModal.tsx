"use client";

import React, { useState } from "react";
import { AI_PROVIDERS, SOUFAI_MODELS, AIProviderDef } from "@/lib/providers";
import { X, Plus, Layers, Key, Cpu, Zap, ShieldCheck, Check, Sparkles, Loader2 } from "lucide-react";
import { ModelLogo } from "@/components/ui/Logos";

interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProvider: (data: {
    providerId: string;
    soufModelId: string;
    keys: string[];
    models: string[];
    routingMode: "round_robin" | "priority";
    priority: number;
    systemPrompt?: string;
  }) => void;
}

export const AddProviderModal: React.FC<AddProviderModalProps> = ({
  isOpen,
  onClose,
  onAddProvider,
}) => {
  const [selectedProviderId, setSelectedProviderId] = useState(AI_PROVIDERS[0]?.id || "gemini");
  const [selectedSoufModel, setSelectedSoufModel] = useState("core");
  const [keysInput, setKeysInput] = useState("");
  const [modelsInput, setModelsInput] = useState("");
  const [systemPromptInput, setSystemPromptInput] = useState("");
  const [routingMode, setRoutingMode] = useState<"round_robin" | "priority">("priority");
  const [priorityNum, setPriorityNum] = useState(1);
  const [searchFilter, setSearchFilter] = useState("");
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  if (!isOpen) return null;

  const currentProviderDef = AI_PROVIDERS.find((p) => p.id === selectedProviderId);

  // Select provider without injecting hardcoded models
  const handleSelectProvider = (pId: string) => {
    setSelectedProviderId(pId);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const keys = keysInput
      .split("\n")
      .map((k) => k.trim())
      .filter(Boolean);

    const models = modelsInput
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    onAddProvider({
      providerId: selectedProviderId,
      soufModelId: selectedSoufModel,
      keys,
      models: models.length > 0 ? models : currentProviderDef?.models || [],
      routingMode,
      priority: priorityNum,
      systemPrompt: systemPromptInput.trim(),
    });

    // Reset
    setKeysInput("");
    setModelsInput("");
    setSystemPromptInput("");
    onClose();
  };

  const filteredProviders = AI_PROVIDERS.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.id.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-2xl bg-[#0d1414] border border-[#1e2e2e] rounded-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1e2e2e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00d4aa] to-[#0ea5e9] flex items-center justify-center text-[#0a0f0f] shadow-lg shadow-[#00d4aa]/20">
              <Plus className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#e8f5f5]">إضافة وتثبيت مزود جديد</h3>
              <p className="text-xs text-[#4a7070]">اختر من 40+ مزود للذكاء الاصطناعي وربطه بنماذج SoufAI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#4a7070] hover:text-[#e8f5f5] hover:bg-[#111a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Target SoufAI Model */}
          <div>
            <label className="block text-xs font-bold text-[#e8f5f5] mb-2 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00d4aa]" />
              ربط بنموذج SoufAI المخصص:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {Object.values(SOUFAI_MODELS).map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setSelectedSoufModel(m.id)}
                  className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between h-16 ${
                    selectedSoufModel === m.id
                      ? "border-[#00d4aa] bg-[#00d4aa]/10 text-[#00d4aa] shadow-md shadow-[#00d4aa]/10"
                      : "border-[#1e2e2e] bg-[#111a1a] text-[#4a7070] hover:border-[#4a7070]"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <ModelLogo modelId={m.id} size={20} />
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0a0f0f] border border-[#1e2e2e]">
                      {m.badge}
                    </span>
                  </div>
                  <span className="text-xs font-bold truncate">
                    {m.id === "classifier" ? "تصنيف الطلبات" : m.nameAr.replace("SoufAI ", "")}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Choose Provider from 40+ list */}
          <div>
            <label className="block text-xs font-bold text-[#e8f5f5] mb-2 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#0ea5e9]" />
              اختر المزود من قائمة 40+ مزود:
            </label>
            
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="ابحث في المزودين (Groq, Gemini, OpenRouter, Anthropic, DeepSeek...)..."
              className="w-full mb-2 bg-[#111a1a] text-xs text-[#e8f5f5] placeholder-[#4a7070] px-3 py-2 rounded-xl border border-[#1e2e2e] outline-none focus:border-[#00d4aa]"
            />

            <div className="max-h-36 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 p-1 border border-[#1e2e2e] rounded-xl bg-[#0a0f0f]">
              {filteredProviders.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => handleSelectProvider(p.id)}
                  className={`p-2 rounded-xl text-xs font-bold text-right flex items-center justify-between border transition-all ${
                    selectedProviderId === p.id
                      ? "border-[#00d4aa] bg-[#00d4aa]/15 text-[#00d4aa]"
                      : "border-transparent hover:bg-[#111a1a] text-[#e8f5f5]"
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  {selectedProviderId === p.id && <Check className="w-3.5 h-3.5 text-[#00d4aa]" />}
                </button>
              ))}
            </div>
          </div>

          {/* 3. API Keys (1 per line) */}
          <div>
            <label className="block text-xs font-bold text-[#e8f5f5] mb-2 flex items-center gap-2">
              <Key className="w-4 h-4 text-[#00d4aa]" />
              مفاتيح API (أدخل كل مفتاح في سطر منفصل):
            </label>
            <textarea
              rows={3}
              value={keysInput}
              onChange={(e) => setKeysInput(e.target.value)}
              placeholder={`gsk_1928374829374982\ngsk_9918273645192837\nsk-or-v1-9876543210`}
              className="w-full bg-[#111a1a] text-xs font-mono text-[#00d4aa] placeholder-[#4a7070] p-3 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none leading-relaxed"
            />
          </div>

          {/* 3.5 Custom System Prompt */}
          <div>
            <label className="block text-xs font-bold text-[#e8f5f5] mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00d4aa]" />
              السيستم برومبت الخاص بالنموذج المخصص (اسم وتوجيهات النموذج):
            </label>
            <textarea
              rows={3}
              value={systemPromptInput}
              onChange={(e) => setSystemPromptInput(e.target.value)}
              placeholder="أدخل اسم النموذج المخصص وتوجيهاته هنا..."
              className="w-full bg-[#111a1a] text-xs font-sans text-[#e8f5f5] placeholder-[#4a7070] p-3 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none leading-relaxed"
            />
          </div>

          {/* 4. Model Names & Priority & Routing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#e8f5f5]">
                  أسماء النماذج المتاحة:
                </label>
                <button
                  type="button"
                  disabled={isFetchingModels}
                  onClick={async () => {
                    const firstKey = keysInput.split("\n")[0]?.trim();
                    if (!firstKey && selectedProviderId !== "ollama") {
                      alert("الرجاء إدخال مفتاح الـ API أولاً لجلب النماذج الحية من حسابك مباشرة.");
                      return;
                    }
                    setIsFetchingModels(true);
                    try {
                      const res = await fetch("/api/admin/models", {
                        method: "POST",
                        credentials: "include",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ providerId: selectedProviderId, apiKey: firstKey || "" }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && data.success && Array.isArray(data.models) && data.models.length > 0) {
                        setModelsInput(data.models.join(", "));
                      } else {
                        alert(data.error || "تعذر جلب النماذج الحية من المزود. تأكد من صحة المفتاح.");
                      }
                    } catch (e: any) {
                      alert(`فشل الاتصال بالمزود: ${e?.message || "خطأ في الشبكة"}`);
                    } finally {
                      setIsFetchingModels(false);
                    }
                  }}
                  className="text-[10px] font-bold text-[#00d4aa] hover:underline flex items-center gap-1 cursor-pointer bg-[#00d4aa]/10 px-2 py-0.5 rounded-lg border border-[#00d4aa]/30 disabled:opacity-50"
                >
                  {isFetchingModels ? (
                    <Loader2 className="w-3 h-3 animate-spin text-[#00d4aa]" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  <span>{isFetchingModels ? "جارٍ جلب النماذج الحية..." : "جلب أحدث نماذج الذكاء الاصطناعي ⚡"}</span>
                </button>
              </div>
              <input
                type="text"
                value={modelsInput}
                onChange={(e) => setModelsInput(e.target.value)}
                placeholder="اضغط على جلب أحدث نماذج الذكاء الاصطناعي..."
                className="w-full bg-[#111a1a] text-xs text-[#e8f5f5] placeholder-[#4a7070] p-2.5 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#e8f5f5] mb-2">
                نمط التدوير والتوزيع:
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRoutingMode("priority")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                    routingMode === "priority"
                      ? "bg-[#00d4aa] text-[#0a0f0f] border-[#00d4aa]"
                      : "bg-[#111a1a] text-[#4a7070] border-[#1e2e2e]"
                  }`}
                >
                  Priority (حسب الأولوية)
                </button>
                <button
                  type="button"
                  onClick={() => setRoutingMode("round_robin")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${
                    routingMode === "round_robin"
                      ? "bg-[#0ea5e9] text-[#0a0f0f] border-[#0ea5e9]"
                      : "bg-[#111a1a] text-[#4a7070] border-[#1e2e2e]"
                  }`}
                >
                  Round Robin (بالتناوب)
                </button>
              </div>
            </div>
          </div>

          {/* Priority Level */}
          <div>
            <label className="block text-xs font-bold text-[#e8f5f5] mb-2">
              درجة الأولوية (Priority Rank):
            </label>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 4, 5].map((pNum) => (
                <button
                  type="button"
                  key={pNum}
                  onClick={() => setPriorityNum(pNum)}
                  className={`w-10 h-10 rounded-xl text-xs font-bold transition-all border flex items-center justify-center ${
                    priorityNum === pNum
                      ? "bg-[#00d4aa] text-[#0a0f0f] border-[#00d4aa] shadow-md shadow-[#00d4aa]/20"
                      : "bg-[#111a1a] text-[#4a7070] border-[#1e2e2e]"
                  }`}
                >
                  #{pNum}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-3 border-t border-[#1e2e2e] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#4a7070] hover:text-[#e8f5f5] transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#0a0f0f] hover:scale-105 active:scale-95 shadow-lg shadow-[#00d4aa]/25 transition-all flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>إضافة وتثبيت المزود</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
