"use client";

import React, { useState, useEffect } from "react";
import { SOUFAI_MODELS, AI_PROVIDERS, SoufAIModelDef } from "@/lib/providers";
import { AddProviderModal } from "./AddProviderModal";
import { ProviderDetailCard, ProviderDetail, ApiKeyItem } from "./ProviderDetailCard";
import { BehaviorAnalyticsPanel } from "./BehaviorAnalyticsPanel";
import { StatsPanel } from "./StatsPanel";
import { WhatsAppGatewayPanel } from "./WhatsAppGatewayPanel";
import { TelegramGatewayPanel } from "./TelegramGatewayPanel";
import { AuthSettingsPanel } from "./AuthSettingsPanel";
import { encryptKey, decryptKey } from "@/lib/encryption";
import { getAuthCookie } from "@/lib/authCookies";
import {
  Key,
  Plus,
  ShieldCheck,
  RefreshCw,
  Cpu,
  Layers,
  Activity,
  AlertTriangle,
  Users,
  Search,
  Sparkles,
  Zap,
  CheckCircle2,
  Lock,
  MessageSquare,
  Send,
  Mail,
  Shield,
  ScanEye,
  Eye,
  EyeOff
} from "lucide-react";

export const KeysManager: React.FC = () => {
  const [activeAdminTab, setActiveAdminTab] = useState<"keys" | "auth_mail" | "behavior" | "stats" | "whatsapp" | "telegram">("keys");
  const [selectedModelId, setSelectedModelId] = useState<string>("core");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [healthData, setHealthData] = useState<any>(null);

  // Store mapping of providers per model tier
  const [modelProviders, setModelProviders] = useState<Record<string, ProviderDetail[]>>({});
  
  // Active model tiers selected by user (enabled by default)
  const [activeModelTiers, setActiveModelTiers] = useState<string[]>([
    "spark", "core", "pro", "ultra"
  ]);

  // Hidden Classifier Model State (Role: classifier - 100% hidden from regular users)
  const [classifierConfig, setClassifierConfig] = useState<{
    providerId: string;
    model: string;
    apiKey: string;
    status: "active" | "disabled";
  }>({
    providerId: "gemini",
    model: "gemini-3.1-flash-lite",
    apiKey: "",
    status: "active",
  });
  const [testingClassifier, setTestingClassifier] = useState(false);
  const [classifierTestResult, setClassifierTestResult] = useState<{
    success: boolean;
    message: string;
    classification?: string;
    latencyMs?: number;
  } | null>(null);

  // Dedicated Vision / Multimodal Model State (Role: vision - 100% hidden from regular users)
  const [visionConfig, setVisionConfig] = useState<{
    providerId: string;
    model: string;
    apiKey: string;
    status: "active" | "disabled";
    customEndpoint?: string;
  }>({
    providerId: "gemini",
    model: "gemini-3.7-flash",
    apiKey: "",
    status: "active",
    customEndpoint: "",
  });
  const [showVisionKey, setShowVisionKey] = useState(false);
  const [testingVision, setTestingVision] = useState(false);
  const [visionTestResult, setVisionTestResult] = useState<{
    success: boolean;
    message: string;
    description?: string;
    latencyMs?: number;
  } | null>(null);

  // Real-time synchronization and persistence of active model tiers
  const handleUpdateActiveTiers = (nextTiers: string[]) => {
    setActiveModelTiers(nextTiers);
    setHasUnsavedChanges(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("souftools_active_tiers_changed", { detail: nextTiers }));
    }
    const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cookieData?.email) headers["x-user-email"] = cookieData.email;
    if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

    // Background auto-sync to server memory, disk and storage
    fetch("/api/admin/keys", {
      method: "POST",
      headers,
      body: JSON.stringify({ activeModelTiers: nextTiers }),
    }).catch(() => null);
  };

  const fetchHealth = async () => {
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = {};
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/keys/health", { headers });
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (err) {
      console.warn("Health fetch error:", err);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleUnbanModel = async (providerId: string, model: string) => {
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/keys/health", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "unban_model", providerId, model }),
      });
      if (res.ok) {
        const data = await res.json();
        setHealthData(data.summary);
      }
    } catch (err) {
      console.error("Unban model error:", err);
    }
  };

  const handleUnbanKey = async (providerId: string, key: string) => {
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/keys/health", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "unban_key", providerId, key }),
      });
      if (res.ok) {
        const data = await res.json();
        setHealthData(data.summary);
      }
    } catch (err) {
      console.error("Unban key error:", err);
    }
  };

  const handleUnbanAll = async () => {
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/keys/health", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "unban_all" }),
      });
      if (res.ok) {
        const data = await res.json();
        setHealthData(data.summary);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Unban all error:", err);
    }
  };

  const [cacheFlushed, setCacheFlushed] = useState(false);

  const handleFlushCache = async () => {
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/keys/health", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ action: "flush_cache" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.summary) setHealthData(data.summary);
        setCacheFlushed(true);
        setTimeout(() => setCacheFlushed(false), 3000);
      }
    } catch (err) {
      console.error("Flush cache error:", err);
    }
  };

  // Load backend keys on mount
  useEffect(() => {
    async function loadData() {
      try {
        let loaded = false;

        // Purge any legacy keys previously stored in browser/phone localStorage
        if (typeof window !== "undefined") {
          try {
            localStorage.removeItem("souftools_model_providers");
            localStorage.removeItem("souftools_active_tiers");
          } catch {}
        }

        // 1. Load configuration strictly from the server platform
        try {
          const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
          const headers: Record<string, string> = {};
          if (cookieData?.email) headers["x-user-email"] = cookieData.email;
          if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

          const res = await fetch("/api/admin/keys", { 
            headers,
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            if (data.modelProviders && Object.keys(data.modelProviders).length > 0) {
              setModelProviders(data.modelProviders);
              loaded = true;
            }
            if (Array.isArray(data.activeModelTiers) && data.activeModelTiers.length > 0) {
              setActiveModelTiers(data.activeModelTiers);
            }
            if (data.classifierModelConfig) {
              setClassifierConfig(data.classifierModelConfig);
            }
            if (data.visionModelConfig) {
              setVisionConfig({
                providerId: data.visionModelConfig.providerId || "gemini",
                model: data.visionModelConfig.model || "gemini-3.7-flash",
                apiKey: data.visionModelConfig.apiKey || "",
                status: data.visionModelConfig.status || "active",
                customEndpoint: data.visionModelConfig.customEndpoint || "",
              });
            }
          }
        } catch (apiErr) {
          console.warn("API load error:", apiErr);
        }

        // 2. Direct client backend read fallback if server API route returned empty
        if (!loaded) {
          try {
            const { getAdminConfigFromCloud } = await import("@/lib/backendServices");
            const { decryptKey } = await import("@/lib/encryption");
            const fsConfig = await getAdminConfigFromCloud();
            if (fsConfig && fsConfig.modelProviders && Object.keys(fsConfig.modelProviders).length > 0) {
              const decryptedProviders = JSON.parse(JSON.stringify(fsConfig.modelProviders));
              Object.keys(decryptedProviders).forEach((mId) => {
                decryptedProviders[mId] = (decryptedProviders[mId] || []).map((p: any) => ({
                  ...p,
                  keys: (p.keys || []).map((kObj: any) => {
                    const rawKeyStr = typeof kObj === "string" ? kObj : (kObj?.key || "");
                    const decryptedVal = decryptKey(rawKeyStr);
                    if (typeof kObj === "string") {
                      return {
                        key: decryptedVal,
                        shortName: decryptedVal.length > 12 ? `${decryptedVal.slice(0, 4)}****[${decryptedVal.slice(-4)}]` : decryptedVal,
                        reqCount: 0,
                        lastUsed: "حديثاً",
                        status: "active",
                        latencyMs: 80,
                      };
                    }
                    return {
                      ...kObj,
                      key: decryptedVal,
                    };
                  }),
                }));
              });
              setModelProviders(decryptedProviders);
              loaded = true;
            }
            if (fsConfig && Array.isArray(fsConfig.activeModelTiers) && fsConfig.activeModelTiers.length > 0) {
              setActiveModelTiers(fsConfig.activeModelTiers);
            }
          } catch (fsErr) {
            console.warn("Backend load error:", fsErr);
          }
        }
      } catch (e) {
        console.error("Failed to load keys structure:", e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Save all configurations strictly to the server
  const handleSaveAll = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      // Extract all raw keys for providers
      const extractedKeysMap: Record<string, string[]> = {};
      Object.keys(modelProviders || {}).forEach((mId) => {
        const provs = modelProviders[mId] || [];
        provs.forEach((p) => {
          if (p.providerId && Array.isArray(p.keys)) {
            if (!extractedKeysMap[p.providerId]) extractedKeysMap[p.providerId] = [];
            p.keys.forEach((kObj) => {
              const rawStr = typeof kObj === "string" ? kObj : (kObj?.key || "");
              if (rawStr && !extractedKeysMap[p.providerId].includes(rawStr)) {
                extractedKeysMap[p.providerId].push(rawStr);
              }
            });
          }
        });
      });

      // 1. Sync directly to server API route for secure server disk and DB persistence
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ 
          modelProviders, 
          keys: extractedKeysMap,
          activeModelTiers,
          classifierModelConfig: classifierConfig,
          visionModelConfig: visionConfig,
        }),
      });

      if (res && res.ok) {
        setSaveSuccess(true);
        setHasUnsavedChanges(false);
        setTimeout(() => setSaveSuccess(false), 5000);
      } else {
        let errMsg = "فشل حفظ التغييرات في السيرفر";
        if (res) {
          try {
            const errJson = await res.json();
            if (errJson.message || errJson.error) {
              errMsg = errJson.message || errJson.error;
            }
          } catch {}
        }
        setSaveError(errMsg);
      }
    } catch (e: any) {
      console.error("Save error:", e);
      let errorMsg = e.message || String(e);
      if (errorMsg.includes("permission") || errorMsg.includes("Missing or insufficient permissions")) {
        errorMsg = "صلاحيات غير كافية: يرجى التأكد من تسجيل الدخول كمسؤول.";
      }
      setSaveError(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // Test Dedicated Vision Model ping & multimodal latency
  const handleTestVision = async () => {
    if (!visionConfig.providerId || !visionConfig.model || !visionConfig.apiKey) {
      setVisionTestResult({
        success: false,
        message: "يرجى تحديد المزود والنموذج وإدخال المفتاح أولاً قبل الاختبار.",
      });
      return;
    }

    setTestingVision(true);
    setVisionTestResult(null);

    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/vision-model/test", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          providerId: visionConfig.providerId,
          model: visionConfig.model,
          apiKey: visionConfig.apiKey,
          customEndpoint: visionConfig.customEndpoint,
          testPrompt: "ما هذا المرفق البسيط؟ أجب بكلمة واحدة باللغة العربية.",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setVisionTestResult({
          success: true,
          description: data.description,
          latencyMs: data.latencyMs,
          message: data.message || `تم اختبار وتحليل الرؤية بنجاح في ${data.latencyMs}ms عبر [${visionConfig.providerId} / ${visionConfig.model}]! ⚡`,
        });
      } else {
        setVisionTestResult({
          success: false,
          message: data.error || "فشل اختبار نموذج تحليل الصور والرؤية",
        });
      }
    } catch (err: any) {
      setVisionTestResult({
        success: false,
        message: err.message || "حدث خطأ أثناء اختبار نموذج تحليل الصور",
      });
    } finally {
      setTestingVision(false);
    }
  };

  // Test Hidden Classifier Model ping & latency
  const handleTestClassifier = async () => {
    if (!classifierConfig.providerId || !classifierConfig.model || !classifierConfig.apiKey) {
      setClassifierTestResult({
        success: false,
        message: "يرجى تحديد المزود والنموذج وإدخال المفتاح أولاً قبل الاختبار.",
      });
      return;
    }

    setTestingClassifier(true);
    setClassifierTestResult(null);

    try {
      const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cookieData?.email) headers["x-user-email"] = cookieData.email;
      if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

      const res = await fetch("/api/admin/classifier/test", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          providerId: classifierConfig.providerId,
          model: classifierConfig.model,
          apiKey: classifierConfig.apiKey,
          testPrompt: "كم الساعة الآن في مدينة دبي؟",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setClassifierTestResult({
          success: true,
          classification: data.classification,
          latencyMs: data.latencyMs,
          message: data.message || `تم التصنيف بنجاح إلى [${data.classification}] في ${data.latencyMs}ms! ⚡`,
        });
      } else {
        setClassifierTestResult({
          success: false,
          message: data.error || "فشل اختبار نموذج التصنيف",
        });
      }
    } catch (err: any) {
      setClassifierTestResult({
        success: false,
        message: err.message || "حدث خطأ أثناء اختبار نموذج التصنيف",
      });
    } finally {
      setTestingClassifier(false);
    }
  };

  // Test single key API Ping
  const handleTestKey = async (providerId: string, keyVal: string, accountId?: string) => {
    const startTime = Date.now();
    try {
      const res = await fetch("/api/admin/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId, key: keyVal, accountId }),
      });
      const latencyMs = Date.now() - startTime;
      if (res.ok) {
        const data = await res.json();
        return { status: (latencyMs > 250 ? "slow" : "active") as "active" | "slow", latencyMs };
      }
      return { status: "failed" as const, latencyMs };
    } catch {
      return { status: "failed" as const, latencyMs: Date.now() - startTime };
    }
  };

  // Handle adding provider from Modal
  const handleAddProviderFromModal = (data: {
    providerId: string;
    accountId?: string;
    soufModelId: string;
    keys: string[];
    models: string[];
    routingMode: "round_robin" | "priority";
    priority: number;
    systemPrompt?: string;
  }) => {
    const pDef = AI_PROVIDERS.find((p) => p.id === data.providerId);
    const pName = pDef ? pDef.name : data.providerId;

    const formattedKeys: ApiKeyItem[] = data.keys.map((k, i) => ({
      key: k,
      shortName: k.length > 12 ? `${k.slice(0, 4)}****[${k.slice(-4)}]` : k,
      reqCount: 0,
      lastUsed: "حديثاً",
      status: "active",
      latencyMs: 80 + i * 10,
    }));

    const newProvider: ProviderDetail = {
      id: `${data.soufModelId}-${data.providerId}-${Date.now()}`,
      providerId: data.providerId,
      accountId: data.accountId,
      name: pName,
      priority: data.priority,
      routingMode: data.routingMode,
      models: data.models,
      defaultAgentModel: data.models[0] || "",
      systemPrompt: data.systemPrompt || "",
      keys: formattedKeys,
    };

    setModelProviders((prev) => {
      const currentList = prev[data.soufModelId] || [];
      return {
        ...prev,
        [data.soufModelId]: [...currentList, newProvider],
      };
    });

    setHasUnsavedChanges(true);
    // Switch to target model tab
    setSelectedModelId(data.soufModelId);
  };

  // Update a provider inside current selected model tier
  const handleUpdateProvider = (updated: ProviderDetail) => {
    setModelProviders((prev) => {
      const currentList = prev[selectedModelId] || [];
      const newList = currentList.map((p) => (p.id === updated.id ? updated : p));
      return {
        ...prev,
        [selectedModelId]: newList,
      };
    });
    setHasUnsavedChanges(true);
  };

  // Remove a provider from current tier
  const handleRemoveProvider = (id: string) => {
    setModelProviders((prev) => {
      const currentList = prev[selectedModelId] || [];
      return {
        ...prev,
        [selectedModelId]: currentList.filter((p) => p.id !== id),
      };
    });
    setHasUnsavedChanges(true);
  };

  // Move priority up or down
  const handleMovePriority = (id: string, direction: "up" | "down") => {
    setModelProviders((prev) => {
      const list = [...(prev[selectedModelId] || [])];
      const idx = list.findIndex((p) => p.id === id);
      if (idx === -1) return prev;

      if (direction === "up" && idx > 0) {
        const temp = list[idx - 1];
        list[idx - 1] = list[idx];
        list[idx] = temp;
      } else if (direction === "down" && idx < list.length - 1) {
        const temp = list[idx + 1];
        list[idx + 1] = list[idx];
        list[idx] = temp;
      }

      // Re-assign priorities
      const updatedList = list.map((p, i) => ({ ...p, priority: i + 1 }));

      return {
        ...prev,
        [selectedModelId]: updatedList,
      };
    });
    setHasUnsavedChanges(true);
  };

  // Calculate Global Top Stats
  const calculateStats = () => {
    let totalReqs = 0;
    let activeKeys = 0;
    let bannedKeys = 0;

    Object.values(modelProviders).forEach((list) => {
      list.forEach((p) => {
        p.keys.forEach((k) => {
          totalReqs += k.reqCount;
          if (k.status === "active" || k.status === "slow") activeKeys++;
          if (k.status === "failed") bannedKeys++;
        });
      });
    });

    return {
      todayRequests: totalReqs,
      activeKeysCount: activeKeys,
      bannedKeysCount: bannedKeys,
      activeSessions: Object.keys(modelProviders).reduce((acc, mId) => acc + (modelProviders[mId]?.length || 0), 0),
    };
  };

  const [bulkFetchingModels, setBulkFetchingModels] = useState(false);
  const [bulkFetchResult, setBulkFetchResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Fetch live models for all active providers across all tiers
  const handleFetchAllProvidersModels = async () => {
    setBulkFetchingModels(true);
    setBulkFetchResult(null);
    let totalFetchedCount = 0;
    let successfulProviders = 0;

    try {
      const updatedProvidersMap: Record<string, ProviderDetail[]> = JSON.parse(JSON.stringify(modelProviders));
      const tierKeys = Object.keys(updatedProvidersMap);
      const providerTargets = new Map<string, {
        providerId: string;
        accountId?: string;
        instances: ProviderDetail[];
        keys: string[];
      }>();

      for (const tierId of tierKeys) {
        for (const provider of updatedProvidersMap[tierId] || []) {
          const providerId = provider.providerId.trim().toLowerCase();
          if (!providerId) continue;

          const embeddedAccountId =
            providerId === "cloudflare"
              ? provider.keys
                  .map((key) => key.key.match(/^([a-f0-9]{16,64})[:|]/i)?.[1])
                  .find(Boolean)
              : undefined;
          const accountId = provider.accountId || embeddedAccountId;
          const targetId = providerId === "cloudflare" ? `${providerId}:${accountId || ""}` : providerId;
          let target = providerTargets.get(targetId);
          if (!target) {
            target = { providerId, accountId, instances: [], keys: [] };
            providerTargets.set(targetId, target);
          }
          target.instances.push(provider);

          const orderedKeys = [
            ...provider.keys.filter((key) => key.status === "active"),
            ...provider.keys,
          ];
          for (const key of orderedKeys) {
            const rawKey = key.key?.trim();
            const candidate = rawKey ? decryptKey(rawKey) || rawKey : "";
            if (candidate && !target.keys.includes(candidate)) target.keys.push(candidate);
          }
        }
      }

      const failures: string[] = [];
      for (const target of providerTargets.values()) {
        const providerId = target.providerId;
        let fetchedModels: string[] | null = null;
        let lastError = "لم يُرجع المزود قائمة نماذج صالحة.";

        for (const apiKey of target.keys.length ? target.keys : [""]) {
          try {
            const res = await fetch("/api/admin/models", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                providerId,
                apiKey,
                accountId: target.accountId,
              }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success && Array.isArray(data.models) && data.models.length > 0) {
              fetchedModels = Array.from(new Set(data.models.filter((model: unknown) =>
                typeof model === "string" && model.length > 0
              )));
              if (fetchedModels.length > 0) break;
            }
            lastError = data.error || `تعذر جلب النماذج (HTTP ${res.status}).`;
          } catch (error) {
            lastError = error instanceof Error ? error.message : "خطأ في الشبكة.";
          }
        }

        if (!fetchedModels?.length) {
          failures.push(`${providerId}: ${lastError}`);
          continue;
        }

        for (const provider of target.instances) {
          provider.models = fetchedModels;
          provider.activeModels = [...fetchedModels];
          if (!provider.defaultAgentModel || !fetchedModels.includes(provider.defaultAgentModel)) {
            provider.defaultAgentModel = fetchedModels[0];
          }
        }
        totalFetchedCount += fetchedModels.length;
        successfulProviders += 1;
      }

      const attemptedProviders = providerTargets.size;
      if (attemptedProviders === 0) {
        setBulkFetchResult({ success: false, message: "لا توجد مزودات مهيأة لجلب نماذجها." });
        return;
      }
      if (successfulProviders === 0) {
        setBulkFetchResult({
          success: false,
          message: `فشل جلب النماذج من جميع المزودين (${attemptedProviders}). ${failures.slice(0, 3).join(" | ")}`,
        });
        return;
      }

      setModelProviders(updatedProvidersMap);
      setHasUnsavedChanges(true);
      const failureSummary = failures.length
        ? ` وتعذر جلب ${failures.length} (${failures.slice(0, 3).join(" | ")})`
        : "";
      setBulkFetchResult({
        success: failures.length === 0,
        message: `تم جلب ${totalFetchedCount} نموذجاً من ${successfulProviders}/${attemptedProviders} مزود. لم تُحفظ التغييرات بعد.${failureSummary}`,
      });
      setTimeout(() => setBulkFetchResult(null), 6000);
    } catch (err: any) {
      setBulkFetchResult({
        success: false,
        message: `تعذر جلب النماذج: ${err?.message || "خطأ غير متوقع"}`,
      });
    } finally {
      setBulkFetchingModels(false);
    }
  };

  const stats = calculateStats();
  const currentModelDef: SoufAIModelDef = SOUFAI_MODELS[selectedModelId] || SOUFAI_MODELS.core;
  const currentProviders = modelProviders[selectedModelId] || [];

  const filteredProviders = currentProviders.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    p.models.some((m) => m.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* 0. Real-time Cloud Save Status Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-bold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4.5 h-4.5 text-green-400 shrink-0" />
          <span>تم الحفظ والمزامنة السحابية بنجاح! جميع التغييرات والمفاتيح تم تشفيرها وحفظها بأمان في قاعدة البيانات والقرص الدائم. ✅</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold flex flex-col gap-1.5 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4.5 h-4.5 text-red-400 shrink-0" />
            <span className="font-bold">فشل حفظ ومزامنة التغييرات ❌</span>
          </div>
          <p className="text-red-300/80 mr-6 text-[11px] leading-relaxed">
            {saveError}
          </p>
          <p className="text-red-400/60 mr-6 text-[10px]">
            ملاحظة: لحفظ التغييرات، يجب تسجيل الدخول ببريد إلكتروني مخول كمسؤول (souftoolsai@gmail.com) وتفعيل الاتصال بالخادم.
          </p>
        </div>
      )}

      {/* 1. Top Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#4a7070] uppercase font-bold block">طلبات اليوم</span>
            <span className="text-xl font-extrabold text-[#e8f5f5] font-mono">{stats.todayRequests.toLocaleString()}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 flex items-center justify-center text-[#00d4aa]">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#4a7070] uppercase font-bold block">المفاتيح النشطة</span>
            <span className="text-xl font-extrabold text-[#00ff88] font-mono">{stats.activeKeysCount} مفتاح</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/30 flex items-center justify-center text-green-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#4a7070] uppercase font-bold block">المفاتيح المحذورة</span>
            <span className="text-xl font-extrabold text-red-400 font-mono">{stats.bannedKeysCount} مفاتيح</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-[#4a7070] uppercase font-bold block">السيشنات النشطة</span>
            <span className="text-xl font-extrabold text-[#0ea5e9] font-mono">{stats.activeSessions} سيشن</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#0ea5e9]/15 border border-[#0ea5e9]/30 flex items-center justify-center text-[#0ea5e9]">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Admin Sub-System Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1e2e2e] pb-3 overflow-x-auto">
        {[
          { id: "keys", label: "إدارة المفاتيح والمزودين", icon: Key },
          { id: "auth_mail", label: "المصادقة وOAuth وإرسال البريد (Dual Mail Engine)", icon: Shield },
          { id: "behavior", label: "سلوك واستخدام المستخدمين (SoufBehavior)", icon: Activity },
          { id: "stats", label: "إحصائيات النظام العامة", icon: Sparkles },
          { id: "whatsapp", label: "ربط واتساب والوكيل الذكي (WhatsApp Gateway)", icon: MessageSquare },
          { id: "telegram", label: "ربط بوت تيليجرام (Telegram Bot Gateway)", icon: Send },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeAdminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveAdminTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isActive
                  ? "bg-[#00d4aa] text-[#0a0f0f] shadow-lg shadow-[#00d4aa]/20"
                  : "bg-[#111a1a] text-[#88b0b0] border border-[#1e2e2e] hover:border-[#00d4aa]/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeAdminTab === "auth_mail" && <AuthSettingsPanel />}
      {activeAdminTab === "behavior" && <BehaviorAnalyticsPanel />}
      {activeAdminTab === "stats" && <StatsPanel />}
      {activeAdminTab === "whatsapp" && <WhatsAppGatewayPanel />}
      {activeAdminTab === "telegram" && <TelegramGatewayPanel />}

      {activeAdminTab === "keys" && (
        <>
          {/* 2. Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl border border-[#1e2e2e]">
        <div>
          <h2 className="text-lg font-bold text-[#e8f5f5] flex items-center gap-2">
            <Key className="w-5 h-5 text-[#00d4aa]" />
            إدارة مفاتيح API ومزودي الذكاء الاصطناعي
          </h2>
          <p className="text-xs text-[#4a7070] mt-1">
            موزعة حسب نماذج SoufAI الثمانية مع دعم التبديل الفوري (Fallback)، ونظام الحظر والتهدئة التلقائي
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleFetchAllProvidersModels}
            disabled={bulkFetchingModels}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-[#00d4aa]/15 hover:bg-[#00d4aa] text-[#00d4aa] hover:text-[#0a0f0f] border border-[#00d4aa]/40 font-extrabold text-xs transition-all shadow-lg shadow-[#00d4aa]/10 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            title="جلب أحدث النماذج المباشرة لجميع المزودين النشطين عبر مفاتيحهم"
          >
            <RefreshCw className={`w-4 h-4 ${bulkFetchingModels ? "animate-spin" : ""}`} />
            <span>{bulkFetchingModels ? "جاري جلب النماذج الحية..." : "⚡ جلب أحدث نماذج الذكاء الاصطناعي"}</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#00d4aa] to-[#0ea5e9] text-[#0a0f0f] font-extrabold text-xs transition-all shadow-lg shadow-[#00d4aa]/20 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ إضافة مزود جديد</span>
          </button>

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
              saveSuccess
                ? "bg-green-500 text-black shadow-green-500/20 font-extrabold"
                : hasUnsavedChanges
                ? "bg-[#00d4aa] text-[#0a0f0f] shadow-[#00d4aa]/30 animate-pulse font-extrabold ring-2 ring-[#00d4aa]/50"
                : "bg-[#111a1a] hover:bg-[#1e2e2e] text-[#00d4aa] border border-[#00d4aa]/30"
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
            <span>
              {saving
                ? "جاري الحفظ المباشر..."
                : saveSuccess
                ? "تم الحفظ بنجاح ✅"
                : hasUnsavedChanges
                ? "حفظ التغييرات الجديدة ⚠️"
                : "حفظ التغييرات"}
            </span>
          </button>
        </div>
      </div>

      {bulkFetchResult && (
        <div className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
          bulkFetchResult.success
            ? "border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa]"
            : "border-red-500/30 bg-red-500/10 text-red-300"
        }`}>
          {bulkFetchResult.success
            ? <Sparkles className="w-4.5 h-4.5 shrink-0" />
            : <AlertTriangle className="w-4.5 h-4.5 shrink-0" />}
          <span>{bulkFetchResult.message}</span>
        </div>
      )}

      {/* 2.1 Progressive Quarantine & Circuit Breaker Live Alert Banner */}
      {healthData && (
        (() => {
          const quarantinedModels = Object.values(healthData.models || {}).filter((m: any) => m.quarantined);
          const quarantinedKeys = Object.values(healthData.keys || {}).filter((k: any) => k.quarantined);
          const totalQuarantined = quarantinedModels.length + quarantinedKeys.length;

          if (totalQuarantined === 0) return null;

          return (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#111a1a] to-red-950/30 border border-red-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg shadow-red-500/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 animate-pulse">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-red-300 flex items-center gap-2">
                    <span>نظام الحماية والتهدئة التلقائي نشط</span>
                    <span className="text-[10px] bg-red-500/30 text-white px-2 py-0.2 rounded-full font-mono">
                      {totalQuarantined} عناصر محظورة
                    </span>
                  </h4>
                  <p className="text-[11px] text-[#8ea8a8] mt-0.5">
                    {quarantinedModels.length > 0 && `يوجد ${quarantinedModels.length} نماذج في فترة تهدئة (3د ➔ 15د ➔ 1ساعة) لتكرار الإخفاق 3 مرات. `}
                    {quarantinedKeys.length > 0 && `يوجد ${quarantinedKeys.length} مفاتيح في فترة تهدئة بسبب انتهاء الرصيد.`}
                    {" يتم التخطي للنموذج/المزود التالي تلقائياً."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUnbanAll}
                className="px-3.5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-bold transition-all shadow-md shadow-red-500/20 flex items-center gap-1.5 cursor-pointer shrink-0"
                title="إلغاء حظر جميع النماذج والمفاتيح وإعادتها للخدمة فوراً"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>فك حظر الكل الآن 🔄</span>
              </button>
            </div>
          );
        })()
      )}

      {/* 2.2 In-Memory IP Protection & Response Cache Telemetry Banner (100% Free) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#00d4aa]/10 via-[#111a1a] to-[#0a0f0f] border border-[#00d4aa]/30 shadow-lg shadow-[#00d4aa]/5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 border-b border-[#1b2828]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00d4aa]/20 border border-[#00d4aa]/40 flex items-center justify-center text-[#00d4aa] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-[#e8f5f5]">منظومة حماية السيرفر والـ IP (مجانية 100%)</h4>
                <span className="text-[10px] bg-[#00d4aa]/20 text-[#00d4aa] border border-[#00d4aa]/40 px-2 py-0.5 rounded-full font-mono font-bold">
                  In-Memory Active 🟢
                </span>
              </div>
              <p className="text-[11px] text-[#8ea8a8] mt-0.5">
                حماية متكاملة من حظر الـ IP واستنزاف المفاتيح عبر كاش الردود الفوري، مباعدة الميلي ثانية العشوائية، وتدوير البصمات الترويسية دون أي تكلفة.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFlushCache}
              className="px-3 py-1.5 rounded-xl bg-[#1e2e2e] hover:bg-[#2a3e3e] text-[#e8f5f5] text-xs font-bold transition-all border border-[#2a3e3e] flex items-center gap-1.5 cursor-pointer shrink-0"
              title="تفريغ كاش الردود الفوري في الذاكرة"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cacheFlushed ? "text-green-400 animate-spin" : "text-[#00d4aa]"}`} />
              <span>{cacheFlushed ? "تم التفريغ! ⚡" : "تفريغ الكاش ⚡"}</span>
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div className="bg-[#0a0f0f]/80 p-2.5 rounded-xl border border-[#1b2828]">
            <div className="flex items-center justify-between text-[#8ea8a8] text-[10px] mb-1">
              <span>كاش الردود الفوري</span>
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
            </div>
            <div className="text-base font-extrabold text-[#e8f5f5] font-mono">
              {healthData?.cacheStats?.savedOutboundCalls ?? 0}
            </div>
            <div className="text-[9px] text-[#4a7070] mt-0.5">
              طلب تم توفيره (0ms) | نسبة النجاح: {healthData?.cacheStats?.hitRate ?? "0%"}
            </div>
          </div>

          <div className="bg-[#0a0f0f]/80 p-2.5 rounded-xl border border-[#1b2828]">
            <div className="flex items-center justify-between text-[#8ea8a8] text-[10px] mb-1">
              <span>تنعيم الطلبات (Jitter)</span>
              <Activity className="w-3.5 h-3.5 text-[#00d4aa]" />
            </div>
            <div className="text-base font-extrabold text-[#e8f5f5] font-mono">
              {healthData?.dispatcherStats?.totalDispatched ?? 0}
            </div>
            <div className="text-[9px] text-[#4a7070] mt-0.5">
              طلب موزّع | مباعدة عشوائية: ~{healthData?.dispatcherStats?.averageJitterMs ?? 75}ms
            </div>
          </div>

          <div className="bg-[#0a0f0f]/80 p-2.5 rounded-xl border border-[#1b2828]">
            <div className="flex items-center justify-between text-[#8ea8a8] text-[10px] mb-1">
              <span>مجمّع المفاتيح (Key Pool)</span>
              <Key className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-base font-extrabold text-[#e8f5f5] font-mono">
              {healthData?.poolStats?.totalTrackedKeys ?? 0}
            </div>
            <div className="text-[9px] text-[#4a7070] mt-0.5">
              مفتاح موزّع تناوبياً (Round-Robin)
            </div>
          </div>

          <div className="bg-[#0a0f0f]/80 p-2.5 rounded-xl border border-[#1b2828]">
            <div className="flex items-center justify-between text-[#8ea8a8] text-[10px] mb-1">
              <span>تدوير البصمات (Headers)</span>
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xs font-bold text-green-400 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>مفعّل وتلقائي</span>
            </div>
            <div className="text-[9px] text-[#4a7070] mt-1">
              تبديل User-Agents طبيعي لمنع البوتات
            </div>
          </div>
        </div>
      </div>

      {/* 2.3 Hidden Classifier Model Configuration Panel (Role: classifier - 100% Hidden from End-Users) */}
      <div className="glass-panel p-5 rounded-2xl border border-[#00d4aa]/40 bg-gradient-to-r from-[#00d4aa]/10 via-[#111a1a] to-[#0a0f0f] shadow-xl shadow-[#00d4aa]/5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#1b2828]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#00d4aa]/20 border border-[#00d4aa]/40 flex items-center justify-center text-[#00d4aa] shrink-0 shadow-lg shadow-[#00d4aa]/10">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-extrabold text-[#e8f5f5]">
                  نموذج التصنيف الداخلي الخفي (Hidden Classifier Model)
                </h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full font-bold">
                  دور خفي (classifier) — غير مرئي للمستخدمين
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                    classifierConfig.apiKey && classifierConfig.status === "active"
                      ? "bg-green-500/20 text-green-400 border border-green-500/40"
                      : "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                  }`}
                >
                  {classifierConfig.apiKey && classifierConfig.status === "active" ? "مفعل وجاهز 🟢" : "غير مهيأ (مطلوب) ⚠️"}
                </span>
              </div>
              <p className="text-xs text-[#8ea8a8] mt-1 leading-relaxed">
                يستقبل رسالة المستخدم قبل دخول حلقة الوكيل ويصنفها في ~100ms وبـ 10 توكنات فقط إلى (simple / tools / complex). يخفض استهلاك الـ API بنسبة 70%.
                <span className="text-yellow-400 font-bold block mt-0.5">
                  ⚠️ إذا لم يتم تعيين هذا النموذج، يرمي النظام خطأ صريحاً ولن يُعيّن أي نموذج افتراضي تلقائياً.
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTestClassifier}
              disabled={testingClassifier || !classifierConfig.apiKey}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                testingClassifier
                  ? "bg-[#1e2e2e] text-[#4a7070]"
                  : "bg-[#00d4aa]/20 hover:bg-[#00d4aa] text-[#00d4aa] hover:text-[#0a0f0f] border border-[#00d4aa]/40 hover:scale-105 active:scale-95"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingClassifier ? "animate-spin" : ""}`} />
              <span>{testingClassifier ? "جاري الاختبار..." : "اختبار نموذج التصنيف ⚡"}</span>
            </button>
          </div>
        </div>

        {/* Test Result Banner */}
        {classifierTestResult && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
              classifierTestResult.success
                ? "bg-green-500/15 border-green-500/30 text-green-300"
                : "bg-red-500/15 border-red-500/30 text-red-300"
            }`}
          >
            {classifierTestResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{classifierTestResult.message}</span>
          </div>
        )}

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* 1. Provider Picker */}
          <div>
            <label className="text-[11px] font-bold text-[#8ea8a8] block mb-1.5">
              1. مزود نموذج التصنيف (Provider)
            </label>
            <select
              value={classifierConfig.providerId}
              onChange={(e) => {
                const nextProv = e.target.value;
                let defaultSuggestedModel = "gemini-3.1-flash-lite";
                if (nextProv === "groq") defaultSuggestedModel = "llama-3.1-8b-instant";
                if (nextProv === "anthropic") defaultSuggestedModel = "claude-3-5-haiku-latest";
                if (nextProv === "openai") defaultSuggestedModel = "gpt-4o-mini";
                if (nextProv === "deepseek") defaultSuggestedModel = "deepseek-chat";
                if (nextProv === "mistral") defaultSuggestedModel = "mistral-large-latest";

                setClassifierConfig((prev) => ({
                  ...prev,
                  providerId: nextProv,
                  model: defaultSuggestedModel,
                }));
                setHasUnsavedChanges(true);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00d4aa]"
            >
              <option value="gemini">Google Gemini (الأسرع والأقل تكلفة)</option>
              <option value="groq">Groq (سرعة استدلال فائقة LPU)</option>
              <option value="anthropic">Anthropic (Claude Haiku فائق الذكاء)</option>
              <option value="openai">OpenAI (GPT-4o Mini)</option>
              <option value="deepseek">DeepSeek (DeepSeek Chat)</option>
              <option value="mistral">Mistral AI (Mistral Small / Large)</option>
              <option value="openrouter">OpenRouter (بوابة النماذج العالمية)</option>
              <option value="together">Together AI</option>
              <option value="cerebras">Cerebras</option>
              <option value="sambanova">SambaNova</option>
            </select>
          </div>

          {/* 2. Model Input with suggestions */}
          <div>
            <label className="text-[11px] font-bold text-[#8ea8a8] block mb-1.5">
              2. اسم النموذج (Model ID)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={classifierConfig.model}
                onChange={(e) => {
                  setClassifierConfig((prev) => ({ ...prev, model: e.target.value.trim() }));
                  setHasUnsavedChanges(true);
                }}
                placeholder="مثال: gemini-3.1-flash-lite أو llama-3.1-8b-instant"
                className="w-full px-3 py-2 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] text-xs text-[#e8f5f5] font-mono focus:outline-none focus:border-[#00d4aa]"
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {["gemini-3.1-flash-lite", "llama-3.1-8b-instant", "claude-3-5-haiku-latest", "gpt-4o-mini"].map((sugg) => (
                <button
                  key={sugg}
                  type="button"
                  onClick={() => {
                    let p = "gemini";
                    if (sugg.includes("llama")) p = "groq";
                    if (sugg.includes("claude")) p = "anthropic";
                    if (sugg.includes("gpt")) p = "openai";

                    setClassifierConfig((prev) => ({
                      ...prev,
                      providerId: p,
                      model: sugg,
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e2e2e] text-[#8ea8a8] hover:text-[#00d4aa] font-mono transition-all"
                >
                  {sugg}
                </button>
              ))}
            </div>
          </div>

          {/* 3. API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-[#8ea8a8]">
                3. مفتاح API الخاص بنموذج التصنيف
              </label>
              {/* Quick Key Picker if existing keys exist for this provider */}
              {(() => {
                const existingKeys: string[] = [];
                Object.values(modelProviders).forEach((provs) => {
                  provs.forEach((p) => {
                    if (p.providerId === classifierConfig.providerId && p.keys) {
                      p.keys.forEach((k) => {
                        if (k.key && !existingKeys.includes(k.key)) existingKeys.push(k.key);
                      });
                    }
                  });
                });
                if (existingKeys.length === 0) return null;
                return (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setClassifierConfig((prev) => ({ ...prev, apiKey: e.target.value }));
                        setHasUnsavedChanges(true);
                      }
                    }}
                    className="text-[9px] bg-[#1e2e2e] text-[#00d4aa] border border-[#2a3e3e] rounded px-1.5 py-0.5 cursor-pointer"
                  >
                    <option value="">استيراد مفتاح محفوظ...</option>
                    {existingKeys.map((k, idx) => (
                      <option key={idx} value={k}>
                        مفتاح #{idx + 1} ({k.slice(0, 4)}...{k.slice(-4)})
                      </option>
                    ))}
                  </select>
                );
              })()}
            </div>
            <input
              type="password"
              value={classifierConfig.apiKey}
              onChange={(e) => {
                setClassifierConfig((prev) => ({ ...prev, apiKey: e.target.value.trim() }));
                setHasUnsavedChanges(true);
              }}
              placeholder="الصق مفتاح API هنا..."
              className="w-full px-3 py-2 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] text-xs text-[#e8f5f5] font-mono focus:outline-none focus:border-[#00d4aa]"
            />
            <div className="flex items-center justify-between mt-1 text-[10px] text-[#4a7070]">
              <span>يتم التشفير والحفظ في PostgreSQL وقرص السيرفر.</span>
              <button
                type="button"
                onClick={() => {
                  setClassifierConfig((prev) => ({
                    ...prev,
                    status: prev.status === "active" ? "disabled" : "active",
                  }));
                  setHasUnsavedChanges(true);
                }}
                className={`text-[10px] font-bold ${
                  classifierConfig.status === "active" ? "text-green-400" : "text-red-400"
                }`}
              >
                {classifierConfig.status === "active" ? "الحالة: نشط 🟢" : "الحالة: معطل ⏸️"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2.4 Dedicated Vision & Multimodal Model Configuration Panel (Role: vision - 100% Hidden from End-Users) */}
      <div className="glass-panel p-5 rounded-2xl border border-[#00ff88]/30 bg-gradient-to-r from-[#00ff88]/10 via-[#111a1a] to-[#0a0f0f] shadow-xl shadow-[#00ff88]/5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#1b2828]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#00ff88]/20 border border-[#00ff88]/40 flex items-center justify-center text-[#00ff88] shrink-0 shadow-lg shadow-[#00ff88]/10">
              <ScanEye className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-extrabold text-[#e8f5f5]">
                  نموذج تحليل الرؤية والصور المخصص (Dedicated Vision Engine)
                </h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  دور خفي (vision) — غير مرئي للمستخدمين
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                    visionConfig.apiKey && visionConfig.status === "active"
                      ? "bg-green-500/20 text-green-400 border border-green-500/40"
                      : "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                  }`}
                >
                  {visionConfig.apiKey && visionConfig.status === "active" ? "مفعل وجاهز 🟢" : "غير مهيأ (مطلوب) ⚠️"}
                </span>
              </div>
              <p className="text-xs text-[#8ea8a8] mt-1 leading-relaxed">
                محرك خلفي مخصص حصرياً لمعالجة وتحليل وتدقيق الصور واستخراج التفاصيل البصرية (Multimodal Vision).
                <span className="text-yellow-400 font-bold block mt-0.5">
                  ⚠️ يعتمد النظام حصرياً على النموذج والمفتاح المحددين هنا لتحليل الصور، ولن يتم التراجع لأي نموذج افتراضي تلقائياً.
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleTestVision}
              disabled={testingVision || !visionConfig.apiKey}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                testingVision
                  ? "bg-[#1e2e2e] text-[#4a7070]"
                  : "bg-[#00ff88]/20 hover:bg-[#00ff88] text-[#00ff88] hover:text-[#0a0f0f] border border-[#00ff88]/40 hover:scale-105 active:scale-95"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingVision ? "animate-spin" : ""}`} />
              <span>{testingVision ? "جاري فحص النموذج..." : "اختبار نموذج الرؤية ⚡"}</span>
            </button>
          </div>
        </div>

        {/* Vision Test Result Banner */}
        {visionTestResult && (
          <div
            className={`mt-4 p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 animate-fade-in ${
              visionTestResult.success
                ? "bg-green-500/15 border-green-500/30 text-green-300"
                : "bg-red-500/15 border-red-500/30 text-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {visionTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{visionTestResult.message}</span>
            </div>
            {visionTestResult.description && (
              <span className="text-[10px] text-emerald-200/80 font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                المخرج: {visionTestResult.description}
              </span>
            )}
          </div>
        )}

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {/* 1. Provider Picker */}
          <div>
            <label className="text-[11px] font-bold text-[#8ea8a8] block mb-1.5">
              1. مزود نموذج الرؤية (Vision Provider)
            </label>
            <select
              value={visionConfig.providerId}
              onChange={(e) => {
                const nextProv = e.target.value;
                let defaultSuggestedModel = "gemini-3.7-flash";
                if (nextProv === "openai") defaultSuggestedModel = "gpt-4o";
                if (nextProv === "anthropic") defaultSuggestedModel = "claude-3-5-sonnet-20241022";
                if (nextProv === "openrouter") defaultSuggestedModel = "qwen-2.5-vl-72b-instruct";
                if (nextProv === "groq") defaultSuggestedModel = "llama-3.2-11b-vision-preview";
                if (nextProv === "mistral") defaultSuggestedModel = "pixtral-12b-2409";
                if (nextProv === "together") defaultSuggestedModel = "meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo";
                if (nextProv === "deepseek") defaultSuggestedModel = "deepseek-chat";

                setVisionConfig((prev) => ({
                  ...prev,
                  providerId: nextProv,
                  model: defaultSuggestedModel,
                }));
                setHasUnsavedChanges(true);
              }}
              className="w-full px-3 py-2 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] text-xs text-[#e8f5f5] focus:outline-none focus:border-[#00ff88]"
            >
              <option value="gemini">Google Gemini (دعم بصري أصلي متميز وواسع)</option>
              <option value="openai">OpenAI (GPT-4o Vision Engine)</option>
              <option value="anthropic">Anthropic (Claude 3.5 Sonnet Vision)</option>
              <option value="openrouter">OpenRouter (Qwen VL / Pixtral / Llama Vision)</option>
              <option value="groq">Groq (Llama 3.2 Vision LPU)</option>
              <option value="mistral">Mistral AI (Pixtral 12B Vision)</option>
              <option value="together">Together AI (Llama Vision Turbo)</option>
              <option value="deepseek">DeepSeek AI</option>
              <option value="custom">مزود مخصص (Custom HTTP Endpoint)</option>
            </select>
          </div>

          {/* 2. Model Input with suggestions */}
          <div>
            <label className="text-[11px] font-bold text-[#8ea8a8] block mb-1.5">
              2. اسم النموذج (Model ID)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={visionConfig.model}
                onChange={(e) => {
                  setVisionConfig((prev) => ({ ...prev, model: e.target.value.trim() }));
                  setHasUnsavedChanges(true);
                }}
                placeholder="مثال: gemini-3.7-flash أو gpt-4o"
                className="w-full px-3 py-2 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] text-xs text-[#e8f5f5] font-mono focus:outline-none focus:border-[#00ff88]"
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {["gemini-3.7-flash", "gemini-2.5-pro", "gpt-4o", "claude-3-5-sonnet-20241022", "qwen-2.5-vl-72b-instruct", "pixtral-12b-2409"].map((sugg) => (
                <button
                  key={sugg}
                  type="button"
                  onClick={() => {
                    let p = "gemini";
                    if (sugg.includes("gpt")) p = "openai";
                    if (sugg.includes("claude")) p = "anthropic";
                    if (sugg.includes("qwen")) p = "openrouter";
                    if (sugg.includes("pixtral")) p = "openrouter";

                    setVisionConfig((prev) => ({
                      ...prev,
                      providerId: p,
                      model: sugg,
                    }));
                    setHasUnsavedChanges(true);
                  }}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e2e2e] text-[#8ea8a8] hover:text-[#00ff88] font-mono transition-all"
                >
                  {sugg}
                </button>
              ))}
            </div>
          </div>

          {/* 3. API Key Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-[#8ea8a8]">
                3. مفتاح API الخاص بنموذج الرؤية
              </label>
              {/* Quick Key Picker if existing keys exist for this provider */}
              {(() => {
                const existingKeys: string[] = [];
                Object.values(modelProviders).forEach((provs) => {
                  provs.forEach((p) => {
                    if (p.providerId === visionConfig.providerId && p.keys) {
                      p.keys.forEach((k) => {
                        if (k.key && !existingKeys.includes(k.key)) existingKeys.push(k.key);
                      });
                    }
                  });
                });
                if (existingKeys.length === 0) return null;
                return (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setVisionConfig((prev) => ({ ...prev, apiKey: e.target.value }));
                        setHasUnsavedChanges(true);
                      }
                    }}
                    className="text-[9px] bg-[#1e2e2e] text-[#00ff88] border border-[#2a3e3e] rounded px-1.5 py-0.5 cursor-pointer"
                  >
                    <option value="">استيراد مفتاح محفوظ...</option>
                    {existingKeys.map((k, idx) => (
                      <option key={idx} value={k}>
                        مفتاح #{idx + 1} ({k.slice(0, 4)}...{k.slice(-4)})
                      </option>
                    ))}
                  </select>
                );
              })()}
            </div>
            <div className="relative">
              <input
                type={showVisionKey ? "text" : "password"}
                value={visionConfig.apiKey}
                onChange={(e) => {
                  setVisionConfig((prev) => ({ ...prev, apiKey: e.target.value.trim() }));
                  setHasUnsavedChanges(true);
                }}
                placeholder="الصق مفتاح API لنموذج الرؤية هنا..."
                className="w-full px-3 py-2 pe-8 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] text-xs text-[#e8f5f5] font-mono focus:outline-none focus:border-[#00ff88]"
              />
              <button
                type="button"
                onClick={() => setShowVisionKey(!showVisionKey)}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#4a7070] hover:text-[#00ff88] transition-colors"
                title={showVisionKey ? "إخفاء المفتاح" : "إظهار المفتاح"}
              >
                {showVisionKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] text-[#4a7070]">
              <span>يتم التشفير والحفظ الآمن في السيرفر.</span>
              <button
                type="button"
                onClick={() => {
                  setVisionConfig((prev) => ({
                    ...prev,
                    status: prev.status === "active" ? "disabled" : "active",
                  }));
                  setHasUnsavedChanges(true);
                }}
                className={`text-[10px] font-bold cursor-pointer ${
                  visionConfig.status === "active" ? "text-green-400" : "text-red-400"
                }`}
              >
                {visionConfig.status === "active" ? "الحالة: نشط 🟢" : "الحالة: معطل ⏸️"}
              </button>
            </div>
          </div>
        </div>

        {/* Optional Custom Endpoint input if custom provider is selected */}
        {visionConfig.providerId === "custom" && (
          <div className="mt-3 pt-3 border-t border-[#1e2e2e]">
            <label className="text-[11px] font-bold text-[#8ea8a8] block mb-1">
              عنوان نقطة النهاية المخصصة (Custom Endpoint URL)
            </label>
            <input
              type="text"
              value={visionConfig.customEndpoint || ""}
              onChange={(e) => {
                setVisionConfig((prev) => ({ ...prev, customEndpoint: e.target.value.trim() }));
                setHasUnsavedChanges(true);
              }}
              placeholder="https://your-custom-ai-proxy.com/v1/chat/completions"
              className="w-full px-3 py-2 rounded-xl bg-[#0a0f0f] border border-[#1e2e2e] text-xs text-[#e8f5f5] font-mono focus:outline-none focus:border-[#00ff88]"
            />
          </div>
        )}
      </div>

      {/* 3. Main Split View: Right Sidebar (SoufAI Models) + Left Content Area (Providers List) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Right Sidebar: SoufAI Models List */}
        <div className="lg:col-span-1 glass-panel p-3 rounded-2xl border border-[#1e2e2e] space-y-2.5">
          <div className="p-2 pb-2 border-b border-[#1e2e2e]">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#e8f5f5] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#00d4aa]" />
                نماذج SoufAI (8)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00d4aa]/15 text-[#00d4aa] border border-[#00d4aa]/30 font-bold">
                {activeModelTiers.length}/8 مفعّل
              </span>
            </div>
            <p className="text-[10px] text-[#4a7070] mt-1">اختر النموذج للتحكم في تشغيله ومزوديه والمفاتيح</p>

            {/* Quick Bulk Action Buttons */}
            <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-[#1b2828]">
              <button
                type="button"
                onClick={() => {
                  const allTiers = ["spark", "core", "pro", "ultra"];
                  handleUpdateActiveTiers(allTiers);
                }}
                className="flex-1 py-1.5 px-2 rounded-lg bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                title="تفعيل نماذج SoufAI الأربعة الأساسية"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>تفعيل الكل (4) 🟢</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const defaultTiers = ["spark", "core", "pro", "ultra"];
                  handleUpdateActiveTiers(defaultTiers);
                }}
                className="py-1.5 px-2 rounded-lg bg-[#111a1a] hover:bg-[#1e2e2e] border border-[#1e2e2e] text-[#88b0b0] text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                title="إعادة ضبط النماذج الافتراضية"
              >
                <RefreshCw className="w-3 h-3" />
                <span>الافتراضي</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {Object.values(SOUFAI_MODELS).map((m) => {
              const isActive = selectedModelId === m.id;
              const isTierEnabled = activeModelTiers.includes(m.id);
              const pCount = (modelProviders[m.id] || []).length;

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedModelId(m.id)}
                  className={`w-full p-3 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                    isActive
                      ? "bg-[#00d4aa]/15 border-[#00d4aa] text-[#00d4aa] shadow-md shadow-[#00d4aa]/10"
                      : "bg-[#111a1a] border-[#1e2e2e] text-[#4a7070] hover:text-[#e8f5f5] hover:border-[#4a7070]/50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        let nextTiers: string[];
                        if (activeModelTiers.includes(m.id)) {
                          nextTiers = activeModelTiers.filter((id) => id !== m.id);
                        } else {
                          nextTiers = [...activeModelTiers, m.id];
                        }
                        handleUpdateActiveTiers(nextTiers);
                      }}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 flex items-center ${
                        isTierEnabled ? "bg-[#00d4aa]" : "bg-[#1e2e2e]"
                      }`}
                      title={isTierEnabled ? "إيقاف تفعيل هذا النموذج" : "تفعيل هذا النموذج في واجهة المستخدم"}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-[#0a0f0f] transition-transform ${
                          isTierEnabled ? "translate-x-0" : "-translate-x-4"
                        }`}
                      />
                    </button>

                    <span className="text-base">{m.icon}</span>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-extrabold truncate ${isTierEnabled ? "text-[#e8f5f5]" : "text-[#4a7070] line-through decoration-red-500/50"}`}>
                          {m.nameAr.replace("SoufAI ", "")}
                        </span>
                      </div>
                      <span className={`text-[9px] font-bold block truncate ${isTierEnabled ? "text-green-400" : "text-red-400"}`}>
                        {isTierEnabled ? "مفعّل 🟢" : "معطّل 🔴"}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    isActive
                      ? "bg-[#00d4aa] text-[#0a0f0f] border-[#00d4aa] font-bold"
                      : "bg-[#0a0f0f] text-[#4a7070] border-[#1e2e2e]"
                  }`}>
                    {pCount} {pCount === 1 ? "مزود" : "مزودين"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Area: Selected Model Header & Attached Providers */}
        <div className="lg:col-span-3 space-y-4">
          {/* Selected Model Banner Info */}
          <div className="glass-panel p-4 rounded-2xl border border-[#1e2e2e] bg-gradient-to-r from-[#111a1a] to-[#0a0f0f] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#00d4aa]/15 border border-[#00d4aa]/30 flex items-center justify-center text-xl shadow-lg">
                {currentModelDef.icon}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-extrabold text-[#e8f5f5]">{currentModelDef.nameAr}</h3>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${
                    activeModelTiers.includes(currentModelDef.id)
                      ? "bg-green-500/20 text-green-400 border-green-500/40"
                      : "bg-red-500/20 text-red-400 border-red-500/40"
                  }`}>
                    {activeModelTiers.includes(currentModelDef.id) ? "مفعّل 🟢" : "معطّل 🔴"}
                  </span>
                </div>
                <p className="text-xs text-[#4a7070] mt-0.5">{currentModelDef.descriptionAr}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Toggle ON / OFF Button */}
              <button
                type="button"
                onClick={() => {
                  const isCurrentlyEnabled = activeModelTiers.includes(currentModelDef.id);
                  let nextTiers: string[];
                  if (isCurrentlyEnabled) {
                    nextTiers = activeModelTiers.filter((id) => id !== currentModelDef.id);
                  } else {
                    nextTiers = [...activeModelTiers, currentModelDef.id];
                  }
                  handleUpdateActiveTiers(nextTiers);
                }}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                  activeModelTiers.includes(currentModelDef.id)
                    ? "bg-green-500/15 border-green-500/50 text-green-400 hover:bg-green-500/25"
                    : "bg-red-500/15 border-red-500/50 text-red-400 hover:bg-red-500/25"
                }`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${activeModelTiers.includes(currentModelDef.id) ? "bg-green-400 animate-pulse" : "bg-red-500"}`} />
                <span>{activeModelTiers.includes(currentModelDef.id) ? "إيقاف النموذج 🔴" : "تشغيل النموذج 🟢"}</span>
              </button>

              <div className="text-left sm:text-right text-[11px] text-[#4a7070] font-mono">
                <div>السرعة: <span className="text-[#00d4aa]">{currentModelDef.speed}</span></div>
                <div>الجودة: <span className="text-[#0ea5e9]">{currentModelDef.quality}</span></div>
              </div>
            </div>
          </div>

          {/* Search Bar for Providers in current tier */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-[#4a7070]" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={`ابحث في مزودي ${currentModelDef.nameAr}...`}
              className="w-full bg-[#111a1a] text-xs text-[#e8f5f5] placeholder-[#4a7070] pr-10 pl-4 py-3 rounded-xl border border-[#1e2e2e] focus:border-[#00d4aa] outline-none transition-all"
            />
          </div>

          {/* Providers List or Empty State */}
          {loading ? (
            <div className="text-center py-12 text-xs text-[#00d4aa] flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري تحميل المزودين والمفاتيح...</span>
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="glass-panel p-8 rounded-2xl border border-[#1e2e2e] text-center space-y-4">
              <Cpu className="w-10 h-10 text-[#4a7070] mx-auto opacity-50" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#e8f5f5]">لا يوجد مزودون مربوطون بهذا النموذج بعد</h4>
                <p className="text-xs text-[#4a7070]">يمكنك إلحاق أي مزود من قائمة 40+ مزود وتحديد أولويته الآن</p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-[#00d4aa] text-[#0a0f0f] font-extrabold text-xs hover:scale-105 transition-all inline-flex items-center gap-2 shadow-lg shadow-[#00d4aa]/20 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>إضافة أول مزود لـ {currentModelDef.nameAr}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProviders.map((pDetail) => (
                <ProviderDetailCard
                  key={pDetail.id}
                  provider={pDetail}
                  onUpdateProvider={handleUpdateProvider}
                  onRemoveProvider={handleRemoveProvider}
                  onMovePriority={handleMovePriority}
                  onTestKey={handleTestKey}
                  healthData={healthData}
                  onUnbanModel={handleUnbanModel}
                  onUnbanKey={handleUnbanKey}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Provider Modal */}
      <AddProviderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddProvider={handleAddProviderFromModal}
      />
        </>
      )}
    </div>
  );
};
