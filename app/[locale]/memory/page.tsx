"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Brain,
  Plus,
  Trash2,
  Search,
  Sparkles,
  ShieldCheck,
  FolderGit2,
  Check,
  Edit2,
  Power,
  RefreshCw,
  Cpu,
  Layers,
  ArrowRight,
  User,
  Sliders,
  BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { SoufAIMemory, MemorySettings, MemoryType } from "@/lib/memory/types";
import { auth } from "@/lib/firebase";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { AppNavigationHeader } from "@/components/ui/AppNavigationHeader";
import { isRtlLocale } from "@/lib/i18n";

export default function MemoryPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const isRtl = isRtlLocale(locale);

  const [memories, setMemories] = useState<SoufAIMemory[]>([]);
  const [settings, setSettings] = useState<MemorySettings>({
    memoryEnabled: true,
    autoSuggest: true,
    autoExtract: true,
    maxContextItems: 6,
  });

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [user, setUser] = useState<any>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMemory, setEditingMemory] = useState<SoufAIMemory | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Form state
  const [formType, setFormType] = useState<MemoryType>("project");
  const [formContent, setFormContent] = useState("");
  const [formProjectName, setFormProjectName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      const effectiveId = currentUser?.uid || "default_user";
      fetchData(effectiveId);
    });
    return () => unsub();
  }, []);

  const fetchData = async (userId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/memory?userId=${encodeURIComponent(userId)}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories || []);
        if (data.settings) setSettings(data.settings);
      }
    } catch (err) {
      console.error("Error fetching memories:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGlobalMemory = async () => {
    const effectiveId = user?.uid || "default_user";
    const newStatus = !settings.memoryEnabled;
    const updated = { ...settings, memoryEnabled: newStatus };
    setSettings(updated);
    await fetch("/api/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: effectiveId, settings: updated }),
    });
  };

  const handleToggleAutoSuggest = async () => {
    const effectiveId = user?.uid || "default_user";
    const newStatus = !settings.autoSuggest;
    const updated = { ...settings, autoSuggest: newStatus };
    setSettings(updated);
    await fetch("/api/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: effectiveId, settings: updated }),
    });
  };

  const handleToggleMemoryItem = async (mem: SoufAIMemory) => {
    const effectiveId = user?.uid || "default_user";
    const newEnabled = !mem.enabled;
    setMemories((prev) =>
      prev.map((m) => (m.id === mem.id ? { ...m, enabled: newEnabled } : m))
    );
    await fetch("/api/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: effectiveId,
        memoryId: mem.id,
        updates: { enabled: newEnabled },
      }),
    });
  };

  const handleDeleteMemoryItem = async (memoryId: string) => {
    const effectiveId = user?.uid || "default_user";
    setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    await fetch(
      `/api/memory?userId=${encodeURIComponent(effectiveId)}&memoryId=${encodeURIComponent(
        memoryId
      )}`,
      { method: "DELETE" }
    );
  };

  const handleClearAll = async () => {
    const effectiveId = user?.uid || "default_user";
    setMemories([]);
    setShowClearConfirm(false);
    await fetch(`/api/memory?userId=${encodeURIComponent(effectiveId)}&clearAll=true`, {
      method: "DELETE",
    });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;
    const effectiveId = user?.uid || "default_user";
    setSaving(true);

    const projectId = formProjectName.trim()
      ? formProjectName.trim().toLowerCase().replace(/\s+/g, "_")
      : undefined;

    try {
      if (editingMemory) {
        const updates = {
          type: formType,
          content: formContent.trim(),
          projectName: formProjectName.trim() || undefined,
          projectId,
        };
        setMemories((prev) =>
          prev.map((m) => (m.id === editingMemory.id ? { ...m, ...updates } : m))
        );
        await fetch("/api/memory", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: effectiveId,
            memoryId: editingMemory.id,
            updates,
          }),
        });
      } else {
        const res = await fetch("/api/memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: effectiveId,
            memory: {
              type: formType,
              content: formContent.trim(),
              projectName: formProjectName.trim() || undefined,
              projectId,
              importance: 0.9,
              confidence: 1.0,
              source: "user",
              enabled: true,
            },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.memory) {
            setMemories((prev) => [data.memory, ...prev]);
          }
        }
      }

      setShowAddModal(false);
      setEditingMemory(null);
      setFormContent("");
      setFormProjectName("");
    } catch (err) {
      console.error("Save memory error:", err);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (mem: SoufAIMemory) => {
    setEditingMemory(mem);
    setFormType(mem.type);
    setFormContent(mem.content);
    setFormProjectName(mem.projectName || "");
    setShowAddModal(true);
  };

  // Filtered Memories
  const filteredMemories = memories.filter((mem) => {
    const matchesTab = activeTab === "all" || mem.type === activeTab;
    const matchesSearch =
      !searchQuery.trim() ||
      mem.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (mem.projectName && mem.projectName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  // Unique projects list
  const projectsList = Array.from(
    new Set(memories.filter((m) => m.projectName).map((m) => m.projectName))
  );

  return (
    <div className="min-h-screen bg-[#0b1212] text-[#e8f5f5] font-sans flex flex-col justify-between">
      <AppNavigationHeader
        locale={locale}
        title={isRtl ? "ذاكرة SoufAI الذكية الممتدة" : "SoufAI Long-Term Memory"}
        subtitle={isRtl ? "مدير الذاكرة طويلة الأمد وتفضيلات المشاريع" : "Project contexts, facts, and persistent preferences"}
        icon={<Brain className="w-4 h-4 text-[#a855f7]" />}
        backHref={`/${locale}/chat`}
        backLabel={isRtl ? "العودة للدردشة" : "Back to Chat"}
        activeKey="memory"
      />

      <div className="max-w-6xl mx-auto w-full p-4 sm:p-8 space-y-8 flex-1">
        {/* Header Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#111a1a]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3 tracking-tight">
              <Brain className="w-8 h-8 text-[#a855f7] animate-pulse" />
              <span>{isRtl ? "مستودع الذاكرة والسياق الدائم" : "Context & Memory Vault"}</span>
            </h1>
            <p className="text-sm text-[#8899a6] mt-1 max-w-2xl">
              {isRtl
                ? "مدير الذاكرة طويلة الأمد. يسترجع الذكاء الاصطناعي تفضيلاتك وسياق مشاريعك تلقائياً لمنحك إجابات فائقة الدقة."
                : "Manage long-term AI memory. SoufAI retains your project contexts, coding preferences, and facts seamlessly."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher locale={locale} />

            <button
              onClick={() => {
                setEditingMemory(null);
                setFormType("project");
                setFormContent("");
                setFormProjectName("");
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#a855f7] to-[#7e22ce] text-white font-semibold text-sm hover:opacity-90 transition-all shadow-lg shadow-[#a855f7]/20 flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isRtl ? "إضافة معلومة للذاكرة" : "Add Memory Item"}</span>
            </button>

            {memories.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="p-2.5 rounded-xl bg-[#111a1a] border border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                title={isRtl ? "مسح كل الذكريات" : "Clear All Memories"}
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            )}
          </div>
        </div>

        {/* Global Controls & Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Global Memory Switch */}
          <div className="p-5 rounded-2xl bg-[#0f1717] border border-[#111a1a] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8899a6]">
                {isRtl ? "حالة الذاكرة" : "Memory Status"}
              </span>
              <button
                onClick={handleToggleGlobalMemory}
                className={`p-2 rounded-xl transition-colors ${
                  settings.memoryEnabled
                    ? "bg-[#10b981]/20 text-[#10b981]"
                    : "bg-[#ef4444]/20 text-[#ef4444]"
                }`}
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4">
              <div className="text-xl font-bold flex items-center gap-2">
                {settings.memoryEnabled ? (
                  <span className="text-[#10b981] flex items-center gap-1.5">
                    <Check className="w-5 h-5" />
                    {isRtl ? "نشطة ومفعّلة" : "Active & Enabled"}
                  </span>
                ) : (
                  <span className="text-[#ef4444] flex items-center gap-1.5">
                    {isRtl ? "معطّلة مؤقتاً" : "Disabled"}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8899a6] mt-1">
                {isRtl ? "دمج الذكريات المخصصة تلقائياً مع النماذج" : "Inject user facts into model prompts"}
              </p>
            </div>
          </div>

          {/* Total Memories Stats */}
          <div className="p-5 rounded-2xl bg-[#0f1717] border border-[#111a1a]">
            <div className="flex items-center justify-between text-xs text-[#8899a6]">
              <span>{isRtl ? "إجمالي العناصر" : "Total Memories"}</span>
              <Brain className="w-4 h-4 text-[#a855f7]" />
            </div>
            <div className="mt-3 text-2xl font-black text-[#e8f5f5]">
              {memories.length}{" "}
              <span className="text-xs font-normal text-[#8899a6]">
                {isRtl ? "عنصر محفوظ" : "items"}
              </span>
            </div>
            <p className="text-[11px] text-[#00f2fe] mt-2 font-mono">
              {memories.filter((m) => m.enabled).length} {isRtl ? "عنصر فعّال للاسترجاع" : "active items"}
            </p>
          </div>

          {/* Active Projects Count */}
          <div className="p-5 rounded-2xl bg-[#0f1717] border border-[#111a1a]">
            <div className="flex items-center justify-between text-xs text-[#8899a6]">
              <span>{isRtl ? "المشاريع المسجلة" : "Tagged Projects"}</span>
              <FolderGit2 className="w-4 h-4 text-[#00f2fe]" />
            </div>
            <div className="mt-3 text-2xl font-black text-[#e8f5f5]">
              {projectsList.length}{" "}
              <span className="text-xs font-normal text-[#8899a6]">
                {isRtl ? "مشروع" : "projects"}
              </span>
            </div>
            <p className="text-[11px] text-[#8899a6] mt-2">
              {isRtl ? "تخصيص الذاكرة حسب سياق المشروع" : "Project-level isolation"}
            </p>
          </div>

          {/* Auto Discovery Toggle */}
          <div className="p-5 rounded-2xl bg-[#0f1717] border border-[#111a1a] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8899a6]">
                {isRtl ? "الاكتشاف التلقائي" : "Auto Discovery"}
              </span>
              <button
                onClick={handleToggleAutoSuggest}
                className={`p-2 rounded-xl transition-colors ${
                  settings.autoSuggest
                    ? "bg-[#00f2fe]/20 text-[#00f2fe]"
                    : "bg-[#111a1a] text-[#8899a6]"
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2">
              <div className="text-sm font-bold">
                {settings.autoSuggest ? (
                  <span className="text-[#00f2fe]">{isRtl ? "اقتراح تلقائي مفعل" : "Auto Suggestions ON"}</span>
                ) : (
                  <span className="text-[#8899a6]">{isRtl ? "يدوي فقط" : "Manual Only"}</span>
                )}
              </div>
              <p className="text-[11px] text-[#8899a6] mt-1">
                {isRtl ? "اكتشاف المعرفة والتقنيات من الحوار" : "Detect facts from conversations"}
              </p>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Tabs */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className={`w-4 h-4 absolute top-3.5 text-[#8899a6] ${isRtl ? "right-3.5" : "left-3.5"}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? "بحث في الذكريات والتقنيات..." : "Search memories..."}
              className={`w-full bg-[#0f1717] border border-[#111a1a] focus:border-[#a855f7] rounded-xl py-2.5 text-sm text-[#e8f5f5] placeholder-[#4a7070] outline-none transition-colors ${
                isRtl ? "pr-10 pl-4" : "pl-10 pr-4"
              }`}
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
            {[
              { id: "all", label: isRtl ? "الكل" : "All", icon: Layers },
              { id: "project", label: isRtl ? "المشاريع" : "Projects", icon: FolderGit2 },
              { id: "user", label: isRtl ? "المستخدم" : "User Info", icon: User },
              { id: "preference", label: isRtl ? "التفضيلات" : "Preferences", icon: Sliders },
              { id: "knowledge", label: isRtl ? "المعرفة" : "Knowledge", icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all ${
                    isActive
                      ? "bg-[#a855f7] text-white shadow-md shadow-[#a855f7]/20"
                      : "bg-[#0f1717] text-[#8899a6] hover:text-[#e8f5f5] hover:bg-[#111a1a]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Section: Memory Cards Grid */}
        {loading ? (
          <div className="p-12 text-center text-[#8899a6] flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#a855f7]" />
            <span>{isRtl ? "جاري تحميل ذاكرة SoufAI..." : "Loading memories..."}</span>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-[#0f1717] border border-[#111a1a] flex flex-col items-center justify-center gap-3">
            <Brain className="w-12 h-12 text-[#111a1a]" />
            <h3 className="text-lg font-bold text-[#e8f5f5]">
              {isRtl ? "لا توجد عناصر محفوظة" : "No Memory Items Found"}
            </h3>
            <p className="text-xs text-[#8899a6] max-w-md">
              {isRtl
                ? "يمكنك إضافة أول معلومة يدويًا أو السير في المحادثات وسيتذكر SoufAI الحقائق تلقائياً."
                : "Add your first memory manually or continue chatting to let SoufAI retain facts automatically."}
            </p>
            <button
              onClick={() => {
                setEditingMemory(null);
                setShowAddModal(true);
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-[#a855f7]/20 text-[#c084fc] hover:bg-[#a855f7]/30 text-xs font-semibold transition-colors"
            >
              {isRtl ? "إضافة معلومة الآن" : "Add Memory Now"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {filteredMemories.map((mem) => (
                <motion.div
                  key={mem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-5 rounded-2xl bg-[#0f1717] border transition-all flex flex-col justify-between gap-4 ${
                    mem.enabled
                      ? "border-[#111a1a] hover:border-[#a855f7]/40 shadow-sm"
                      : "border-[#111a1a]/50 opacity-60 bg-[#0b1212]"
                  }`}
                >
                  <div className="space-y-2">
                    {/* Top Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                            mem.type === "project"
                              ? "bg-[#00f2fe]/10 text-[#00f2fe] border-[#00f2fe]/30"
                              : mem.type === "preference"
                              ? "bg-[#eab308]/10 text-[#eab308] border-[#eab308]/30"
                              : mem.type === "user"
                              ? "bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30"
                              : "bg-[#a855f7]/10 text-[#c084fc] border-[#a855f7]/30"
                          }`}
                        >
                          {mem.type === "project"
                            ? isRtl
                              ? "مشروع/تقنية"
                              : "Project"
                            : mem.type === "preference"
                            ? isRtl
                              ? "تفضيل"
                              : "Preference"
                            : mem.type === "user"
                            ? isRtl
                              ? "مستخدم"
                              : "User"
                            : isRtl
                            ? "معرفة"
                            : "Knowledge"}
                        </span>

                        {mem.projectName && (
                          <span className="text-[10px] font-mono font-medium text-[#8899a6] bg-[#111a1a] px-2 py-0.5 rounded-lg border border-[#1e2e2e]">
                            {mem.projectName}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleMemoryItem(mem)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors ${
                            mem.enabled
                              ? "bg-[#10b981]/20 text-[#10b981]"
                              : "bg-[#8899a6]/20 text-[#8899a6]"
                          }`}
                        >
                          {mem.enabled ? (isRtl ? "مُفعّل" : "Active") : isRtl ? "مُعطّل" : "Disabled"}
                        </button>
                      </div>
                    </div>

                    {/* Content Text */}
                    <p className="text-sm text-[#e8f5f5] font-medium leading-relaxed">
                      &ldquo;{mem.content}&rdquo;
                    </p>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between text-xs text-[#8899a6] pt-3 border-t border-[#111a1a]">
                    <div className="flex items-center gap-1 font-mono text-[10px]">
                      <span>{new Date(mem.updatedAt).toLocaleDateString(isRtl ? "ar-EG" : "en-US")}</span>
                      {mem.source === "auto" && (
                        <span className="text-[#a855f7] flex items-center gap-0.5">
                          <Sparkles className="w-3 h-3" />
                          {isRtl ? "اكتشاف تلقائي" : "Auto"}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(mem)}
                        className="p-1.5 rounded-lg hover:bg-[#111a1a] text-[#8899a6] hover:text-[#e8f5f5] transition-colors"
                        title={isRtl ? "تعديل" : "Edit"}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMemoryItem(mem.id)}
                        className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-[#8899a6] hover:text-[#ef4444] transition-colors"
                        title={isRtl ? "حذف" : "Delete"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add / Edit Memory Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg p-6 rounded-2xl bg-[#0f1717] border border-[#a855f7]/40 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold flex items-center gap-2 text-[#e8f5f5]">
                  <Brain className="w-5 h-5 text-[#a855f7]" />
                  <span>
                    {editingMemory
                      ? isRtl
                        ? "تعديل معلومة بالذاكرة"
                        : "Edit Memory Item"
                      : isRtl
                      ? "إضافة معلومة جديدة للذاكرة"
                      : "Add New Memory Item"}
                  </span>
                </h3>
              </div>

              <form onSubmit={handleSaveForm} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#8899a6] mb-1">
                    {isRtl ? "نوع المعلومة" : "Memory Category"}
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as MemoryType)}
                    className="w-full bg-[#0b1212] border border-[#111a1a] rounded-xl p-2.5 text-sm text-[#e8f5f5] outline-none focus:border-[#a855f7]"
                  >
                    <option value="project">{isRtl ? "مشروع أو تقنية (Project/Tech)" : "Project/Tech"}</option>
                    <option value="preference">{isRtl ? "تفضيل شخصي (Preference)" : "Preference"}</option>
                    <option value="user">{isRtl ? "معلومات المستخدم (User Info)" : "User Info"}</option>
                    <option value="knowledge">{isRtl ? "معرفة طويلة الأمد (Knowledge)" : "Knowledge"}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8899a6] mb-1">
                    {isRtl ? "اسم المشروع (اختياري)" : "Project Name (Optional)"}
                  </label>
                  <input
                    type="text"
                    value={formProjectName}
                    onChange={(e) => setFormProjectName(e.target.value)}
                    placeholder={isRtl ? "مثال: SoufTools, E-commerce App" : "e.g. SoufTools, Mobile App"}
                    className="w-full bg-[#0b1212] border border-[#111a1a] rounded-xl p-2.5 text-sm text-[#e8f5f5] outline-none focus:border-[#a855f7]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#8899a6] mb-1">
                    {isRtl ? "محتوى المعلومة المراد حفظها" : "Memory Content"}
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder={
                      isRtl
                        ? "مثال: هذا المشروع يستخدم Next.js 15 مع Tailwind CSS للواجهات وتمرير كل استدعاءات الذكاء الاصطناعي عبر API الخادم."
                        : "e.g. Always write full code solutions without skipping imports."
                    }
                    className="w-full bg-[#0b1212] border border-[#111a1a] rounded-xl p-2.5 text-sm text-[#e8f5f5] outline-none focus:border-[#a855f7] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8899a6] hover:text-[#e8f5f5] transition-colors"
                  >
                    {isRtl ? "إلغاء" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !formContent.trim()}
                    className="px-5 py-2.5 rounded-xl bg-[#a855f7] hover:bg-[#9333ea] text-white font-semibold text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    {saving
                      ? isRtl
                        ? "جاري الحفظ..."
                        : "Saving..."
                      : isRtl
                      ? "حفظ بالذاكرة"
                      : "Save to Memory"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear All Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-2xl bg-[#0f1717] border border-[#ef4444]/40 shadow-2xl space-y-4"
            >
              <h3 className="text-lg font-bold text-[#ef4444] flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                <span>{isRtl ? "مسح جميع عناصر الذاكرة؟" : "Clear All Memories?"}</span>
              </h3>
              <p className="text-xs text-[#8899a6]">
                {isRtl
                  ? "هل أنت متأكد من مسح جميع المعلومات المحفوظة بالذاكرة؟ هذا الإجراء سيقطع جميع سياقات الذكاء الاصطناعي المسجلة مسبقاً."
                  : "Are you sure you want to delete all saved memories? This action cannot be undone."}
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8899a6] hover:text-[#e8f5f5]"
                >
                  {isRtl ? "إلغاء" : "Cancel"}
                </button>
                <button
                  onClick={handleClearAll}
                  className="px-4 py-2 rounded-xl bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold text-xs transition-colors"
                >
                  {isRtl ? "نعم، إزالة الكل" : "Yes, Delete All"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
