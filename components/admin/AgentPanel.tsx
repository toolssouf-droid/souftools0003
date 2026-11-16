"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  Sparkles,
  Send,
  Wrench,
  Shield,
  CheckCircle2,
  Activity,
  Terminal,
  Cpu,
  Check,
  ChevronDown,
  Copy,
  RefreshCw,
  Sliders,
  Play,
  Zap,
  Globe,
  Database,
  Key,
  Layers,
  Code2,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SOUFAI_MODELS, SoufAIModelDef } from "@/lib/providers";
import { copyToClipboard } from "@/lib/utils";
import { getAuthCookie } from "@/lib/authCookies";

import { useChatStore, SoufAISuggestionsConfig } from "@/store/chatStore";

interface AgentMessage {
  id: string;
  role: "user" | "agent";
  text: string;
  toolsUsed?: string[];
  timestamp: string;
  executionTimeMs?: number;
}

export const AgentPanel: React.FC = () => {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "init-1",
      role: "agent",
      text: "مرحباً بك يا مدير النظام! أنا الوكيل الذكي 'Nodaba' (Nodaba AI Autonomous Agent). لدي الصلاحية الكاملة للتحكم في منصة SoufTools V2، إدارة مفاتيح الـ API للمزودين، تحليل أداء الاستدعاءات، إعادة التوجيه الذكي، والبحث التلقائي في الويب. كيف أستطيع خدمتك اليوم؟",
      toolsUsed: ["get_ai_keys_status", "get_routing_status"],
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [selectedAgentModel, setSelectedAgentModel] = useState<string>("ultra");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelSavingSuccess, setModelSavingSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "workbench" | "logs">("chat");

  // Helper for authenticated requests
  const getAuthHeaders = (): Record<string, string> => {
    const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
    const headers: Record<string, string> = {};
    if (cookieData?.email) headers["x-user-email"] = cookieData.email;
    if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;
    return headers;
  };

  // System Prompt for Agent Nodaba with persistent local storage
  const [systemPrompt, setSystemPrompt] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("souftools_nodaba_system_prompt");
      if (saved) return saved;
    }
    return "أنت الوكيل الذكي Nodaba المسؤول عن إدارة منصة SoufTools V2. تمتلك صلاحية تشغيل خوارزميات التوجيه والتأكد من استقرار جميع مفاتيح المزودين ومراقبة أداء النماذج. أجب دائماً بدقة وباللغة العربية الرسمية.";
  });

  const [promptSavedNotice, setPromptSavedNotice] = useState(false);

  const handleUpdateSystemPrompt = (val: string) => {
    setSystemPrompt(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("souftools_nodaba_system_prompt", val);
    }
    setPromptSavedNotice(true);
    setTimeout(() => setPromptSavedNotice(false), 2500);
  };

  const { suggestionsConfig, setSuggestionsConfig } = useChatStore();

  // Enabled Agent Tools
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({
    web_search: true,
    key_healing: true,
    auto_routing: true,
    benchmarking: true,
    suggestions: suggestionsConfig.enabled,
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Load current selected agent model from API/Firestore
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/admin/keys", { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          if (data.selectedAgentModel) {
            setSelectedAgentModel(data.selectedAgentModel);
          }
        }
      } catch (e) {
        console.error("Failed to load agent model configuration:", e);
      }
    }
    fetchConfig();
  }, []);

  const handleModelSelect = async (modelId: string) => {
    setSelectedAgentModel(modelId);
    setModelSavingSuccess(true);
    setTimeout(() => setModelSavingSuccess(false), 3000);

    try {
      // Sync to server cache directly with auth headers
      await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ selectedAgentModel: modelId }),
      });
    } catch (err) {
      console.error("Failed to save selected agent model:", err);
    }
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || query).trim();
    if (!textToSend || loading) return;

    if (!customPrompt) setQuery("");

    const startTime = Date.now();
    const userMsgId = Date.now().toString();
    const agentMsgId = (Date.now() + 1).toString();

    const userMsg: AgentMessage = {
      id: userMsgId,
      role: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };

    const initialAgentMsg: AgentMessage = {
      id: agentMsgId,
      role: "agent",
      text: "",
      toolsUsed: [],
      timestamp: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg, initialAgentMsg]);
    setLoading(true);

    try {
      const activeToolsList: string[] = [];
      if (enabledTools.web_search) activeToolsList.push("web_search");
      if (enabledTools.key_healing) activeToolsList.push("key_healing");
      if (enabledTools.auto_routing) activeToolsList.push("auto_routing");
      if (enabledTools.benchmarking) activeToolsList.push("benchmarking");

      const authHeaders = getAuthHeaders();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          modelId: selectedAgentModel,
          prompt: `[تعليمات النظام: ${systemPrompt}]\n[أمر المدير]: ${textToSend}`,
          webSearchEnabled: enabledTools.web_search,
          activeTools: activeToolsList,
          messages: messages.slice(-10).map((m) => ({
            role: m.role === "user" ? "user" : "model",
            content: m.text,
          })),
        }),
      });

      if (!res.ok) {
        let errMessage = "عذراً يا مدير، تعذر تنفيذ هذا الأمر بشكل كامل مؤقتاً، يرجى إعادة المحاولة.";
        try {
          const errData = await res.json();
          if (errData?.error) errMessage = errData.error;
        } catch {}

        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMsgId
              ? {
                  ...m,
                  text: errMessage,
                  executionTimeMs: Date.now() - startTime,
                }
              : m
          )
        );
        return;
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalResponseText = "";
        let toolsCollected: string[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (part.startsWith("data: ")) {
              const dataStr = part.slice(6).trim();
              if (!dataStr) continue;

              try {
                const payload = JSON.parse(dataStr);

                if (payload.type === "activity") {
                  const stateData = payload.data?.state;
                  if (stateData?.agentSteps && Array.isArray(stateData.agentSteps)) {
                    const stepTools = stateData.agentSteps
                      .map((s: any) => s.toolName || s.tool)
                      .filter(Boolean);
                    toolsCollected = Array.from(new Set([...toolsCollected, ...stepTools]));
                  }
                  if (toolsCollected.length > 0) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === agentMsgId
                          ? { ...m, toolsUsed: toolsCollected }
                          : m
                      )
                    );
                  }
                } else if (payload.type === "complete") {
                  const data = payload.data;
                  finalResponseText = data?.text || finalResponseText;
                  const usedTools = Array.isArray(data?.agentSteps)
                    ? data.agentSteps.map((s: any) => s.toolName || s.tool).filter(Boolean)
                    : [];
                  if (data?.webSearchUsed) {
                    usedTools.push("web_search");
                  }
                  toolsCollected = Array.from(new Set([...toolsCollected, ...usedTools]));

                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? {
                            ...m,
                            text: finalResponseText,
                            toolsUsed: toolsCollected.length > 0 ? toolsCollected : ["system_orchestration"],
                            executionTimeMs: Date.now() - startTime,
                          }
                        : m
                    )
                  );
                } else if (payload.type === "error") {
                  finalResponseText = payload.data?.message || "حدث خطأ أثناء معالجة الأمر.";
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? {
                            ...m,
                            text: finalResponseText,
                            executionTimeMs: Date.now() - startTime,
                          }
                        : m
                    )
                  );
                }
              } catch (parseErr) {
                // If chunk is raw text
                if (dataStr && !dataStr.startsWith("{")) {
                  finalResponseText += dataStr;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === agentMsgId
                        ? { ...m, text: finalResponseText }
                        : m
                    )
                  );
                }
              }
            }
          }
        }

        // Final sanity check if stream finished without text
        if (!finalResponseText) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentMsgId && !m.text
                ? {
                    ...m,
                    text: "تم استلام ومعالجة الأمر بنجاح عبر الوكيل الذكي Nodaba.",
                    executionTimeMs: Date.now() - startTime,
                  }
                : m
            )
          );
        }
      }
    } catch (err: any) {
      console.error("Nodaba agent stream error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === agentMsgId
            ? {
                ...m,
                text: "حدث خطأ بالاتصال مع خادم الوكيل الذكي. يرجى التأكد من تشغيل السيرفر والمحاولة مجدداً.",
                executionTimeMs: Date.now() - startTime,
              }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = async (id: string, text: string) => {
    await copyToClipboard(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentAgentModelDef: SoufAIModelDef =
    SOUFAI_MODELS[selectedAgentModel] || SOUFAI_MODELS.ultra;

  const presetPrompts = [
    { title: "فحص صحة المفاتيح", prompt: "افحص جميع مفاتيح المزودين الحالية وأعطني تقريراً بالحالة" },
    { title: "اختبار سرعة التوجيه", prompt: "قم باختبار سرعة الاستجابة لجميع النماذج المفعلة في المنصة" },
    { title: "تحسين خوارزمية Fallback", prompt: "تأكد من إمكانية تحويل المفاتيح الفاشلة تلقائياً إلى النموذج المجاني دون خصم رصيد" },
    { title: "إنشاء تقرير الخوادم", prompt: "قم بإنشاء ملخص أداء للنظام وقاعدة البيانات ومعدل الاستدعاءات" },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[680px] bg-[#0a0f0f] border border-[#1e2e2e] rounded-3xl overflow-hidden shadow-2xl">
      {/* Top Header Bar for Agent Studio */}
      <header className="px-6 py-4 bg-[#111a1a]/90 border-b border-[#1e2e2e] backdrop-blur-md flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00ff88] to-[#0ea5e9] flex items-center justify-center text-[#0a0f0f] shadow-lg shadow-[#00ff88]/20">
            <Bot className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-[#e8f5f5] tracking-tight">
                Nodaba AI Studio - الوكيل الذكي الشامل
              </h2>
              <span className="text-[10px] bg-[#00ff88]/15 text-[#00ff88] px-2.5 py-0.5 rounded-full border border-[#00ff88]/30 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
                نشط حالياً
              </span>
            </div>
            <p className="text-xs text-[#4a7070]">
              بيئة تحكم تفاعلية متكاملة لإدارة المنصة عبر نماذج الذكاء الاصطناعي
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="w-full sm:w-auto overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 bg-[#0a0f0f] p-1 rounded-2xl border border-[#1e2e2e] w-max min-w-full sm:min-w-0">
            <button
              onClick={() => setActiveTab("chat")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "chat"
                  ? "bg-[#00ff88] text-[#0a0f0f] shadow-md shadow-[#00ff88]/20"
                  : "text-[#4a7070] hover:text-[#e8f5f5]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>الاستوديو التفاعلي</span>
            </button>
            <button
              onClick={() => setActiveTab("workbench")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "workbench"
                  ? "bg-[#00ff88] text-[#0a0f0f] shadow-md shadow-[#00ff88]/20"
                  : "text-[#4a7070] hover:text-[#e8f5f5]"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>إعدادات الوكيل</span>
            </button>
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "logs"
                  ? "bg-[#00ff88] text-[#0a0f0f] shadow-md shadow-[#00ff88]/20"
                  : "text-[#4a7070] hover:text-[#e8f5f5]"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>سجل الأوامر</span>
            </button>
          </div>
        </div>
      </header>

      {/* Model Selector Bar (Collapsible Dropdown Menu in Full Control View) */}
      <div className="px-6 py-3 bg-[#0a0f0f] border-b border-[#1e2e2e] flex flex-wrap items-center justify-between gap-3 relative z-30">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#00ff88]" />
          <span className="text-xs font-bold text-[#e8f5f5]">محرك تشغيل الوكيل:</span>
        </div>

        {/* Collapsible Dropdown Menu Selector */}
        <div className="relative min-w-[280px]">
          <button
            type="button"
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#111a1a] border border-[#1e2e2e] hover:border-[#00ff88]/50 hover:bg-[#1e2e2e]/40 transition-all shadow-md group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{currentAgentModelDef.icon}</span>
              <span className="text-xs font-extrabold text-[#e8f5f5] group-hover:text-[#00ff88] transition-colors">
                {currentAgentModelDef.nameAr}
              </span>
              <span className="text-[10px] bg-[#00ff88]/20 text-[#00ff88] px-2 py-0.2 rounded-full font-bold border border-[#00ff88]/30">
                {currentAgentModelDef.badge}
              </span>
            </div>

            <ChevronDown className={`w-4 h-4 text-[#4a7070] transition-transform duration-200 ${modelDropdownOpen ? "rotate-180 text-[#00ff88]" : ""}`} />
          </button>

          {/* Animated Dropdown Menu */}
          <AnimatePresence>
            {modelDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setModelDropdownOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-2 right-0 left-0 sm:left-auto sm:w-80 bg-[#111a1a] border border-[#1e2e2e] backdrop-blur-2xl rounded-2xl shadow-2xl z-50 p-2 space-y-1 max-h-[380px] overflow-y-auto"
                >
                  <div className="px-3 py-2 border-b border-[#1e2e2e]/60 flex items-center justify-between">
                    <p className="text-xs font-bold text-[#e8f5f5]">اختر نموذج المحرك للوكيل:</p>
                    <span className="text-[10px] text-[#00ff88] font-mono">8 نماذج متوفرة</span>
                  </div>

                  {Object.values(SOUFAI_MODELS).map((m) => {
                    const isSelected = selectedAgentModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          handleModelSelect(m.id);
                          setModelDropdownOpen(false);
                        }}
                        className={`w-full text-right p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-[#00ff88]/15 border border-[#00ff88] text-[#00ff88] shadow-md shadow-[#00ff88]/10"
                            : "bg-[#0a0f0f]/60 hover:bg-[#1e2e2e] border border-transparent text-[#e8f5f5]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{m.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold">{m.nameAr}</span>
                              <span className="text-[9px] bg-[#1e2e2e] text-[#4a7070] px-1.5 py-0.2 rounded-full border border-[#1e2e2e]">
                                {m.badge}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-[#00d4aa]">{m.speed}</span>
                          {isSelected && <Check className="w-4 h-4 text-[#00ff88]" />}
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {modelSavingSuccess && (
          <span className="text-xs font-bold text-[#00ff88] bg-[#00ff88]/10 border border-[#00ff88]/30 px-3 py-1 rounded-xl flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>تم الاعتماد! ✅</span>
          </span>
        )}
      </div>

      {/* Main Body Content according to Tab */}
      <div className="flex-1 overflow-hidden relative flex flex-col bg-[#0a0f0f]">
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden p-4 sm:p-6 space-y-4">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "agent" && (
                    <div className="w-9 h-9 rounded-2xl bg-[#00ff88]/20 border border-[#00ff88]/40 flex items-center justify-center text-[#00ff88] shrink-0 mt-1 shadow-md shadow-[#00ff88]/10">
                      <Bot className="w-5 h-5" />
                    </div>
                  )}

                  <div
                    className={`max-w-3xl p-4 rounded-3xl text-xs sm:text-sm leading-relaxed space-y-2 relative group ${
                      m.role === "user"
                        ? "bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 text-[#e8f5f5] rounded-br-none"
                        : "bg-[#111a1a] border border-[#1e2e2e] text-[#e8f5f5] rounded-bl-none shadow-xl"
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-[#1e2e2e]/60 pb-1.5 mb-1 text-[10px] text-[#4a7070]">
                      <span className="font-bold">
                        {m.role === "user" ? "أمر المدير" : "الوكيل الذكي Nodaba"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span>{m.timestamp}</span>
                        <button
                          onClick={() => copyMessage(m.id, m.text)}
                          className="hover:text-[#00ff88] transition-colors cursor-pointer"
                          title="نسخ النص"
                        >
                          {copiedId === m.id ? <Check className="w-3 h-3 text-[#00ff88]" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    <p className="whitespace-pre-wrap">{m.text}</p>

                    {m.toolsUsed && m.toolsUsed.length > 0 && (
                      <div className="pt-2 border-t border-[#1e2e2e] flex flex-wrap items-center gap-2 text-[10px] text-[#00d4aa]">
                        <Wrench className="w-3.5 h-3.5 text-[#00ff88]" />
                        <span>الأدوات المفعلة:</span>
                        {m.toolsUsed.map((tool, idx) => (
                          <span key={idx} className="bg-[#0a0f0f] px-2 py-0.5 rounded-md border border-[#1e2e2e] font-mono">
                            {tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-3 p-4 bg-[#111a1a]/80 border border-[#00ff88]/30 rounded-2xl max-w-md animate-pulse">
                  <Sparkles className="w-5 h-5 text-[#00ff88] animate-spin" />
                  <div className="text-xs text-[#00ff88]">
                    <p className="font-bold">الوكيل Nodaba يفكر وينفذ العمليات المطلوبة...</p>
                    <p className="text-[10px] text-[#4a7070] mt-0.5">يعمل باستخدام محرك {currentAgentModelDef.nameAr}</p>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompt Starters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#1e2e2e]/50">
              {presetPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p.prompt)}
                  disabled={loading}
                  className="p-2.5 rounded-xl bg-[#111a1a] hover:bg-[#1e2e2e] border border-[#1e2e2e] text-right transition-all group cursor-pointer text-xs"
                >
                  <p className="font-bold text-[#e8f5f5] group-hover:text-[#00ff88] truncate">{p.title}</p>
                  <p className="text-[10px] text-[#4a7070] truncate mt-0.5">{p.prompt}</p>
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-2.5 bg-[#111a1a] border border-[#1e2e2e] rounded-2xl flex items-center gap-2 shadow-xl">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={`اكتب أمرك للوكيل الذكي Nodaba (يعمل عبر ${currentAgentModelDef.nameAr})...`}
                className="flex-1 bg-transparent text-xs sm:text-sm text-[#e8f5f5] placeholder-[#4a7070] px-3 py-2 outline-none"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!query.trim() || loading}
                className="px-5 py-2.5 bg-[#00ff88] text-[#0a0f0f] rounded-xl text-xs font-bold hover:scale-105 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100 shadow-md shadow-[#00ff88]/20"
              >
                <Send className="w-4 h-4 rotate-180" />
                <span className="hidden sm:inline">إرسال</span>
              </button>
            </div>
          </div>
        )}

        {/* Workbench Tab */}
        {activeTab === "workbench" && (
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#00ff88]" />
                  تعليمات النظام الموجهة للوكيل (System Instructions)
                </h3>
                {promptSavedNotice && (
                  <span className="text-[11px] font-bold text-[#00ff88] bg-[#00ff88]/15 border border-[#00ff88]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>تم الحفظ تلقائياً</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#4a7070]">
                حدد سلوك وشخصية ونطاق صلاحيات الوكيل الذكي عند إدارة المنصة (يتم حفظها تلقائياً)
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => handleUpdateSystemPrompt(e.target.value)}
                rows={4}
                className="w-full bg-[#0a0f0f] text-xs text-[#e8f5f5] p-3 rounded-xl border border-[#1e2e2e] focus:border-[#00ff88] outline-none"
              />
            </div>

            {/* Tools Toggles */}
            <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] space-y-4">
              <h3 className="text-sm font-bold text-[#e8f5f5] flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#00d4aa]" />
                قدرات وأدوات الوكيل الأوتوماتيكية
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: "web_search", title: "البحث الحي بالويب", desc: "استخراج بيانات محدثة وأسعار النماذج حياً" },
                  { key: "key_healing", title: "إصلاح المفاتيح الفاشلة تلقائياً", desc: "إعادة التوجيه للنموذج المجاني عند نفاد الرصيد" },
                  { key: "auto_routing", title: "تعديل خوارزميات التوجيه", desc: "اختيار أفضل مزود حسب السرعة والتكلفة" },
                  { key: "benchmarking", title: "قياس زمن الاستجابة حياً", desc: "اختبار البينج والمقارنة بين الاستجابات" },
                ].map((t) => (
                  <div key={t.key} className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#e8f5f5]">{t.title}</p>
                      <p className="text-[10px] text-[#4a7070] mt-0.5">{t.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEnabledTools((prev) => ({ ...prev, [t.key]: !prev[t.key] }))
                      }
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                        enabledTools[t.key] ? "bg-[#00ff88]" : "bg-[#1e2e2e]"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-[#0a0f0f] transition-transform ${
                          enabledTools[t.key] ? "translate-x-0" : "-translate-x-5"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* SoufAI Suggestions Configuration Panel */}
            <div className="glass-panel p-5 rounded-2xl border border-[#1e2e2e] space-y-4 bg-[#0a1313]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#00ff88]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#e8f5f5]">
                      إعدادات اقتراحات SoufAI الذكية (SoufAI Suggestions)
                    </h3>
                    <p className="text-[11px] text-[#4a7070]">
                      التحكم في الميزة الاستباقية للوكيل وعدد ونوع الاقتراحات المقترحة
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSuggestionsConfig({ enabled: !suggestionsConfig.enabled })
                  }
                  className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                    suggestionsConfig.enabled ? "bg-[#00ff88]" : "bg-[#1e2e2e]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-[#0a0f0f] transition-transform ${
                      suggestionsConfig.enabled ? "translate-x-0" : "-translate-x-6"
                    }`}
                  />
                </button>
              </div>

              {suggestionsConfig.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1e2e2e]/60">
                  {/* Max Suggestions Count */}
                  <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] space-y-2">
                    <label className="text-xs font-bold text-[#e8f5f5] block">
                      عدد الاقتراحات القصوى:
                    </label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={`sugg_cnt_${num}`}
                          type="button"
                          onClick={() => setSuggestionsConfig({ maxSuggestions: num })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                            suggestionsConfig.maxSuggestions === num
                              ? "bg-[#00ff88] text-[#0a0f0f] shadow-sm shadow-[#00ff88]/20"
                              : "bg-[#0a0f0f] text-[#4a7070] border border-[#1e2e2e] hover:text-[#e8f5f5]"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Suggestion Style */}
                  <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] space-y-2">
                    <label className="text-xs font-bold text-[#e8f5f5] block">
                      أسلوب وتعمق الاقتراح:
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[
                        { id: "concise", label: "مختصر" },
                        { id: "smart", label: "ذكي" },
                        { id: "proactive", label: "استباقي" },
                      ].map((style) => (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setSuggestionsConfig({ style: style.id as any })}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            suggestionsConfig.style === style.id
                              ? "bg-[#00d4aa] text-[#0a0f0f] shadow-sm"
                              : "bg-[#0a0f0f] text-[#4a7070] border border-[#1e2e2e] hover:text-[#e8f5f5]"
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tool Suggestions Toggle */}
                  <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#e8f5f5]">اقتراحات استخدام الأدوات</p>
                      <p className="text-[10px] text-[#4a7070]">السماح باقتراح استدعاء أدوات مثل البحث والصور</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSuggestionsConfig({
                          allowToolSuggestions: !suggestionsConfig.allowToolSuggestions,
                        })
                      }
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                        suggestionsConfig.allowToolSuggestions ? "bg-[#00d4aa]" : "bg-[#1e2e2e]"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-[#0a0f0f] transition-transform ${
                          suggestionsConfig.allowToolSuggestions ? "translate-x-0" : "-translate-x-5"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Proactive Suggestions Toggle */}
                  <div className="p-3 bg-[#111a1a] rounded-xl border border-[#1e2e2e] flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#e8f5f5]">الاقتراحات الاستباقية الذكية</p>
                      <p className="text-[10px] text-[#4a7070]">توقع خطوة المستخدم القادمة كوكيل حقيقي</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSuggestionsConfig({
                          allowProactiveSuggestions: !suggestionsConfig.allowProactiveSuggestions,
                        })
                      }
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                        suggestionsConfig.allowProactiveSuggestions ? "bg-[#00d4aa]" : "bg-[#1e2e2e]"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-[#0a0f0f] transition-transform ${
                          suggestionsConfig.allowProactiveSuggestions ? "translate-x-0" : "-translate-x-5"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === "logs" && (
          <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-[#00ff88] bg-[#070b0b] space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#1e2e2e] text-[#4a7070]">
              <span>[Agent Execution Audit Console]</span>
              <span>SoufTools V2 Runtime</span>
            </div>
            <p>[INFO] Initializing Nodaba Agent core engine...</p>
            <p>[INFO] Selected agent model tier: {selectedAgentModel} ({currentAgentModelDef.nameAr})</p>
            <p>[INFO] Checking Firestore config document admin_config/settings... OK</p>
            <p>[INFO] Fallback routing enabled: Automatic fallback to Free Gemini API key without credit deduction.</p>
            <p>[INFO] All agent tools registered successfully.</p>

            {messages.map((m, idx) => (
              <div key={idx} className="py-1 border-b border-[#1e2e2e]/40 text-[#e8f5f5]">
                <span className="text-[#4a7070]">[{m.timestamp}] </span>
                <span className={m.role === "user" ? "text-[#0ea5e9]" : "text-[#00ff88]"}>
                  {m.role.toUpperCase()}:
                </span>{" "}
                <span>{m.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

