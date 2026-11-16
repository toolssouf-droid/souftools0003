/**
 * SoufBehavior Engine - Core Engine & Pattern Discovery
 * Local-First Personalization, Smart Aggregation, and Cost-Optimized Firestore Sync
 */

import {
  BehaviorEvent,
  BehaviorEventType,
  BehaviorPrivacyMode,
  UserBehaviorProfile,
  BehaviorContextForAI,
  SmartSuggestion,
  QuickIntentItem,
  SmartLaunchSuggestion,
  GreetingInfo,
  PreferredEntryMode,
} from "./types";
import { localBehaviorStore } from "./localStore";
import {
  saveBehaviorProfileToCloud,
  getBehaviorProfileFromCloud,
  deleteBehaviorProfileFromCloud,
} from "@/lib/backendServices";
import { auth } from "@/lib/firebase";

const PROFILE_VERSION = 1;
const SYNC_EVENTS_THRESHOLD = 200;
const SYNC_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days (72 hours)

const DEFAULT_PROFILE: UserBehaviorProfile = {
  version: PROFILE_VERSION,
  profileUpdatedAt: Date.now(),
  privacyMode: "personalized",
  sessions: 0,
  completedTasks: 0,
  failedTasks: 0,
  favoriteTools: ["webSearch", "coding"],
  recentTools: ["webSearch"],
  preferredModes: ["agent", "deep_thinking"],
  commonIntents: ["research", "coding"],
  launchChoices: [],
  onboardingCompleted: false,
  returningUser: false,
  preferredEntry: "launch",
  lastActiveSession: null,
  tools: {
    webSearch: 0,
    coding: 0,
    imageGeneration: 0,
    imageEditing: 0,
    files: 0,
    translation: 0,
    calculator: 0,
    agentMode: 0,
    dataAnalytics: 0,
  },
  usagePatterns: {
    frequentTools: [],
    frequentWorkflows: [],
    completionRate: 1.0,
  },
  preferences: {
    preferredInterfaceMode: "dark",
    frequentlyUsedTools: [],
  },
  lastSyncAt: 0,
  unsyncedCount: 0,
};

class SoufBehaviorEngineService {
  private currentProfile: UserBehaviorProfile | null = null;
  private isInitializing = false;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Array<(profile: UserBehaviorProfile) => void> = [];

  /**
   * Normalize and backfill any missing fields on loaded profiles
   */
  private normalizeProfile(raw: Partial<UserBehaviorProfile>): UserBehaviorProfile {
    return {
      version: raw.version || PROFILE_VERSION,
      profileUpdatedAt: raw.profileUpdatedAt || Date.now(),
      privacyMode: raw.privacyMode || "personalized",
      sessions: typeof raw.sessions === "number" ? raw.sessions : 0,
      completedTasks: typeof raw.completedTasks === "number" ? raw.completedTasks : 0,
      failedTasks: typeof raw.failedTasks === "number" ? raw.failedTasks : 0,
      favoriteTools: Array.isArray(raw.favoriteTools) ? raw.favoriteTools : ["webSearch", "coding"],
      recentTools: Array.isArray(raw.recentTools) ? raw.recentTools : ["webSearch"],
      preferredModes: Array.isArray(raw.preferredModes) ? raw.preferredModes : ["agent"],
      commonIntents: Array.isArray(raw.commonIntents) ? raw.commonIntents : ["research"],
      launchChoices: Array.isArray(raw.launchChoices) ? raw.launchChoices : [],
      onboardingCompleted: typeof raw.onboardingCompleted === "boolean" ? raw.onboardingCompleted : (raw.sessions || 0) > 0,
      returningUser: typeof raw.returningUser === "boolean" ? raw.returningUser : (raw.sessions || 0) > 1,
      preferredEntry: raw.preferredEntry || "launch",
      lastActiveSession: raw.lastActiveSession || null,
      tools: {
        webSearch: raw.tools?.webSearch || 0,
        coding: raw.tools?.coding || 0,
        imageGeneration: raw.tools?.imageGeneration || 0,
        imageEditing: raw.tools?.imageEditing || 0,
        files: raw.tools?.files || 0,
        translation: raw.tools?.translation || 0,
        calculator: raw.tools?.calculator || 0,
        agentMode: raw.tools?.agentMode || 0,
        dataAnalytics: raw.tools?.dataAnalytics || 0,
        ...(raw.tools || {}),
      },
      usagePatterns: {
        frequentTools: Array.isArray(raw.usagePatterns?.frequentTools)
          ? raw.usagePatterns!.frequentTools
          : [],
        frequentWorkflows: Array.isArray(raw.usagePatterns?.frequentWorkflows)
          ? raw.usagePatterns!.frequentWorkflows
          : [],
        completionRate:
          typeof raw.usagePatterns?.completionRate === "number"
            ? raw.usagePatterns!.completionRate
            : 1.0,
      },
      preferences: {
        preferredInterfaceMode: raw.preferences?.preferredInterfaceMode || "dark",
        frequentlyUsedTools: Array.isArray(raw.preferences?.frequentlyUsedTools)
          ? raw.preferences!.frequentlyUsedTools
          : [],
      },
      lastSyncAt: raw.lastSyncAt || 0,
      unsyncedCount: raw.unsyncedCount || 0,
    };
  }

  /**
   * Initialize SoufBehavior Engine on app load
   */
  async initialize(userId?: string): Promise<UserBehaviorProfile> {
    if (this.currentProfile && !this.isInitializing) return this.currentProfile;
    this.isInitializing = true;

    try {
      // 1. Load local profile from IndexedDB / Storage
      const rawLocal = await localBehaviorStore.getProfile();

      let profile: UserBehaviorProfile;
      if (!rawLocal) {
        profile = { ...DEFAULT_PROFILE, profileUpdatedAt: Date.now() };
        await localBehaviorStore.saveProfile(profile);
      } else {
        profile = this.normalizeProfile(rawLocal);
      }

      this.currentProfile = profile;

      // 2. Aggregate any pending un-aggregated local raw events
      await this.aggregateLocalEvents();

      // 3. Smart Sync check if logged in
      const effectiveUserId = userId || auth.currentUser?.uid;
      if (effectiveUserId && profile.privacyMode !== "off") {
        if (profile.lastSyncAt === 0) {
          const remoteProfile = await getBehaviorProfileFromCloud(effectiveUserId);
          if (remoteProfile) {
            const merged = this.mergeProfiles(profile, this.normalizeProfile(remoteProfile));
            this.currentProfile = merged;
            await localBehaviorStore.saveProfile(merged);
          }
        }
      }

      this.isInitializing = false;
      this.notifyListeners();
      return this.currentProfile;
    } catch (err) {
      console.warn("SoufBehavior Engine initialization warning:", err);
      this.currentProfile = this.currentProfile || DEFAULT_PROFILE;
      this.isInitializing = false;
      return this.currentProfile;
    }
  }

  /**
   * Subscribe to behavior profile changes
   */
  subscribe(listener: (profile: UserBehaviorProfile) => void): () => void {
    this.listeners.push(listener);
    if (this.currentProfile) listener(this.currentProfile);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    if (this.currentProfile) {
      const copy = { ...this.currentProfile };
      this.listeners.forEach((l) => l(copy));
    }
  }

  /**
   * Non-blocking Event Collector
   */
  logEvent(
    type: BehaviorEventType,
    metadata?: { toolName?: string; status?: "success" | "failed"; [key: string]: any }
  ): void {
    setTimeout(async () => {
      try {
        if (!this.currentProfile) {
          await this.initialize();
        }

        const profile = this.currentProfile;
        if (!profile || profile.privacyMode === "off") {
          return;
        }

        // Sanitize metadata to exclude prompts, keys, sensitive user data
        const cleanMetadata: Record<string, any> = {};
        if (metadata?.toolName) cleanMetadata.toolName = metadata.toolName;
        if (metadata?.status) cleanMetadata.status = metadata.status;
        if (metadata?.workflowType) cleanMetadata.workflowType = metadata.workflowType;

        const event: BehaviorEvent = {
          id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type,
          timestamp: Date.now(),
          toolName: metadata?.toolName,
          status: metadata?.status,
          metadata: cleanMetadata,
        };

        // Save raw event locally
        await localBehaviorStore.saveEvent(event);

        // Increment unsynced count & aggregate
        profile.unsyncedCount = (profile.unsyncedCount || 0) + 1;
        await this.aggregateLocalEvents();

        // Check Smart Sync conditions
        this.checkSmartSync();
      } catch (err) {
        console.warn("SoufBehavior: logEvent execution notice", err);
      }
    }, 0);
  }

  /**
   * Local Aggregation: Turns raw events into compact profile counters & pattern arrays
   */
  private async aggregateLocalEvents(): Promise<void> {
    const rawEvents = await localBehaviorStore.getEvents();
    if (!rawEvents || rawEvents.length === 0 || !this.currentProfile) return;

    const profile = { ...this.currentProfile };
    let highestTimestamp = 0;

    for (const ev of rawEvents) {
      if (ev.timestamp > highestTimestamp) highestTimestamp = ev.timestamp;

      if (ev.type === "session_started") {
        profile.sessions += 1;
        if (profile.sessions > 1) {
          profile.returningUser = true;
        }
      }

      if (ev.type === "tool_completed" || ev.type === "code_task_completed") {
        profile.completedTasks += 1;
      }
      if (ev.type === "tool_failed") profile.failedTasks += 1;

      const toolKey = this.mapEventToToolKey(ev);
      if (toolKey) {
        profile.tools[toolKey] = (profile.tools[toolKey] || 0) + 1;
        // Track recent tools (deduped, max 5)
        profile.recentTools = [toolKey, ...profile.recentTools.filter((t) => t !== toolKey)].slice(0, 5);
      }
    }

    // Recalculate completion rate
    const totalFinished = profile.completedTasks + profile.failedTasks;
    if (totalFinished > 0) {
      profile.usagePatterns.completionRate = parseFloat(
        (profile.completedTasks / totalFinished).toFixed(2)
      );
    }

    // Pattern Discovery: frequent tools & workflows
    this.detectPatterns(profile, rawEvents);

    profile.profileUpdatedAt = Date.now();
    this.currentProfile = profile;

    // Save updated aggregated profile locally
    await localBehaviorStore.saveProfile(profile);

    // Prune processed raw events to enforce bounded storage
    if (highestTimestamp > 0) {
      await localBehaviorStore.pruneEventsUpTo(highestTimestamp);
    }

    this.notifyListeners();
  }

  /**
   * Map event types & toolNames to canonical profile tool keys
   */
  private mapEventToToolKey(ev: BehaviorEvent): string | null {
    if (ev.type === "search_started" || ev.type === "search_completed") return "webSearch";
    if (ev.type === "code_task_started" || ev.type === "code_task_completed") return "coding";
    if (ev.type === "image_generated") return "imageGeneration";
    if (ev.type === "image_edited") return "imageEditing";
    if (ev.type === "file_uploaded") return "files";

    if (ev.toolName) {
      const name = ev.toolName.toLowerCase();
      if (name.includes("search") || name.includes("web")) return "webSearch";
      if (name.includes("code") || name.includes("program")) return "coding";
      if (name.includes("image_gen") || name.includes("draw")) return "imageGeneration";
      if (name.includes("image_edit")) return "imageEditing";
      if (name.includes("file") || name.includes("upload")) return "files";
      if (name.includes("translate")) return "translation";
      if (name.includes("calc")) return "calculator";
      if (name.includes("agent")) return "agentMode";
      if (name.includes("data")) return "dataAnalytics";
      return name;
    }
    return null;
  }

  /**
   * Pattern Discovery Engine: Identifies top tools and frequent workflows
   */
  private detectPatterns(profile: UserBehaviorProfile, rawEvents: BehaviorEvent[]) {
    // 1. Identify Top Tools
    const toolEntries = Object.entries(profile.tools);
    toolEntries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
    const topTools = toolEntries.filter(([, count]) => (count || 0) > 0).map(([name]) => name);

    profile.usagePatterns.frequentTools = topTools.slice(0, 4);
    profile.preferences.frequentlyUsedTools = topTools.slice(0, 5);
    profile.favoriteTools = topTools.length > 0 ? topTools.slice(0, 3) : ["webSearch", "coding"];

    // 2. Identify Frequent Workflows
    const sequences: string[] = [];
    let currentSeq: string[] = [];

    for (const ev of rawEvents) {
      const key = this.mapEventToToolKey(ev);
      if (key) {
        if (!currentSeq.includes(key)) {
          currentSeq.push(key);
        }
        if (currentSeq.length >= 2) {
          sequences.push(currentSeq.join("_to_"));
          if (currentSeq.length >= 3) {
            currentSeq = [key];
          }
        }
      }
    }

    if (sequences.length > 0) {
      const counts: Record<string, number> = {};
      sequences.forEach((seq) => {
        counts[seq] = (counts[seq] || 0) + 1;
      });
      const sortedSeqs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      profile.usagePatterns.frequentWorkflows = sortedSeqs.slice(0, 2).map(([seq]) => seq);
    }
  }

  /**
   * Smart Sync Check
   */
  private checkSmartSync(force = false) {
    if (!this.currentProfile || this.currentProfile.privacyMode === "off") return;

    const userId = auth.currentUser?.uid;
    if (!userId || userId.startsWith("guest_")) return;

    const profile = this.currentProfile;
    const now = Date.now();
    const timeSinceLastSync = now - (profile.lastSyncAt || 0);

    const condition1 = (profile.unsyncedCount || 0) >= SYNC_EVENTS_THRESHOLD;
    const condition2 = timeSinceLastSync >= SYNC_INTERVAL_MS;
    const condition3 = force;

    if (condition1 || condition2 || condition3) {
      if (this.syncDebounceTimer) clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = setTimeout(() => {
        this.syncToFirestore(userId);
      }, 2000);
    }
  }

  /**
   * Firestore Sync: Write single aggregated profile document
   */
  async syncToFirestore(userId?: string): Promise<boolean> {
    const uid = userId || auth.currentUser?.uid;
    if (!uid || !this.currentProfile || uid.startsWith("guest_")) return false;

    if (this.currentProfile.privacyMode === "off") return false;

    try {
      const profileToSync: UserBehaviorProfile = {
        ...this.currentProfile,
        lastSyncAt: Date.now(),
        unsyncedCount: 0,
      };

      const success = await saveBehaviorProfileToCloud(uid, profileToSync);
      if (success) {
        this.currentProfile.lastSyncAt = profileToSync.lastSyncAt;
        this.currentProfile.unsyncedCount = 0;
        await localBehaviorStore.saveProfile(this.currentProfile);
        this.notifyListeners();
        return true;
      }
      return false;
    } catch (err) {
      console.warn("SoufBehavior: Sync to Cloud notice", err);
      return false;
    }
  }

  /**
   * Multi-device merge logic
   */
  private mergeProfiles(
    localProf: UserBehaviorProfile,
    remoteProf: UserBehaviorProfile
  ): UserBehaviorProfile {
    const merged: UserBehaviorProfile = {
      version: Math.max(localProf.version, remoteProf.version || 1),
      profileUpdatedAt: Math.max(localProf.profileUpdatedAt, remoteProf.profileUpdatedAt || 0),
      privacyMode: localProf.privacyMode || remoteProf.privacyMode || "personalized",
      sessions: Math.max(localProf.sessions, remoteProf.sessions || 0),
      completedTasks: Math.max(localProf.completedTasks, remoteProf.completedTasks || 0),
      failedTasks: Math.max(localProf.failedTasks, remoteProf.failedTasks || 0),
      favoriteTools: Array.from(new Set([...(localProf.favoriteTools || []), ...(remoteProf.favoriteTools || [])])),
      recentTools: Array.from(new Set([...(localProf.recentTools || []), ...(remoteProf.recentTools || [])])).slice(0, 5),
      preferredModes: Array.from(new Set([...(localProf.preferredModes || []), ...(remoteProf.preferredModes || [])])),
      commonIntents: Array.from(new Set([...(localProf.commonIntents || []), ...(remoteProf.commonIntents || [])])),
      launchChoices: Array.from(new Set([...(localProf.launchChoices || []), ...(remoteProf.launchChoices || [])])),
      onboardingCompleted: localProf.onboardingCompleted || remoteProf.onboardingCompleted || false,
      returningUser: localProf.returningUser || remoteProf.returningUser || (localProf.sessions > 1),
      preferredEntry: localProf.preferredEntry || remoteProf.preferredEntry || "launch",
      lastActiveSession: localProf.lastActiveSession || remoteProf.lastActiveSession || null,
      tools: { ...localProf.tools },
      usagePatterns: {
        frequentTools: localProf.usagePatterns?.frequentTools || remoteProf.usagePatterns?.frequentTools || [],
        frequentWorkflows: localProf.usagePatterns?.frequentWorkflows || remoteProf.usagePatterns?.frequentWorkflows || [],
        completionRate: localProf.usagePatterns?.completionRate || remoteProf.usagePatterns?.completionRate || 1.0,
      },
      preferences: {
        preferredInterfaceMode: localProf.preferences?.preferredInterfaceMode || remoteProf.preferences?.preferredInterfaceMode || "dark",
        frequentlyUsedTools: localProf.preferences?.frequentlyUsedTools || remoteProf.preferences?.frequentlyUsedTools || [],
      },
      lastSyncAt: Date.now(),
      unsyncedCount: 0,
    };

    if (remoteProf.tools) {
      Object.entries(remoteProf.tools).forEach(([key, val]) => {
        merged.tools[key] = Math.max(merged.tools[key] || 0, val || 0);
      });
    }

    return merged;
  }

  /**
   * Complete First-Time Personalization Onboarding
   */
  async completeOnboarding(choices: string[], preferredEntry: PreferredEntryMode = "launch"): Promise<void> {
    if (!this.currentProfile) await this.initialize();
    if (this.currentProfile) {
      this.currentProfile.onboardingCompleted = true;
      this.currentProfile.launchChoices = choices;
      this.currentProfile.preferredEntry = preferredEntry;
      this.currentProfile.favoriteTools = choices.length > 0 ? choices : this.currentProfile.favoriteTools;
      this.currentProfile.profileUpdatedAt = Date.now();

      await localBehaviorStore.saveProfile(this.currentProfile);
      this.logEvent("onboarding_completed", { choices, preferredEntry });
      this.notifyListeners();
      this.checkSmartSync(true);
    }
  }

  /**
   * Reset Onboarding so user can re-select preferences
   */
  async resetOnboarding(): Promise<void> {
    if (!this.currentProfile) await this.initialize();
    if (this.currentProfile) {
      this.currentProfile.onboardingCompleted = false;
      this.currentProfile.launchChoices = [];
      this.currentProfile.profileUpdatedAt = Date.now();
      await localBehaviorStore.saveProfile(this.currentProfile);
      this.notifyListeners();
    }
  }

  /**
   * Set Preferred Entry Point (Launch Screen vs Direct Chat)
   */
  async setPreferredEntry(entry: PreferredEntryMode): Promise<void> {
    if (!this.currentProfile) await this.initialize();
    if (this.currentProfile) {
      this.currentProfile.preferredEntry = entry;
      this.currentProfile.profileUpdatedAt = Date.now();
      await localBehaviorStore.saveProfile(this.currentProfile);
      this.notifyListeners();
      this.checkSmartSync(true);
    }
  }

  /**
   * Update Last Active Session Reference for "Continue Where You Left Off"
   */
  async recordLastActiveSession(session: { id: string; title: string; updatedAt: number; modelId: string }): Promise<void> {
    if (!this.currentProfile) await this.initialize();
    if (this.currentProfile && this.currentProfile.privacyMode !== "off") {
      this.currentProfile.lastActiveSession = session;
      this.currentProfile.profileUpdatedAt = Date.now();
      await localBehaviorStore.saveProfile(this.currentProfile);
      this.notifyListeners();
    }
  }

  /**
   * Get Context-Aware Dynamic Greeting & Subtitle
   */
  getGreeting(localeOrIsRtl: boolean | string, userEmail?: string | null): GreetingInfo {
    const isRtl = typeof localeOrIsRtl === "boolean" ? localeOrIsRtl : (localeOrIsRtl === "ar" || localeOrIsRtl === "ur");
    const locale = typeof localeOrIsRtl === "string" ? localeOrIsRtl : (isRtl ? "ar" : "en");
    const profile = this.currentProfile || DEFAULT_PROFILE;
    const hour = new Date().getHours();

    let timeOfDay: "morning" | "afternoon" | "evening" | "night" = "morning";
    if (hour >= 5 && hour < 12) timeOfDay = "morning";
    else if (hour >= 12 && hour < 17) timeOfDay = "afternoon";
    else if (hour >= 17 && hour < 22) timeOfDay = "evening";
    else timeOfDay = "night";

    const isReturning = profile.returningUser || profile.sessions > 1;
    const topTool = profile.usagePatterns.frequentTools[0] || profile.launchChoices[0] || "";

    const userDisplayName = userEmail ? userEmail.split("@")[0] : null;

    let title = "";
    let subtitle = "";

    const greetingsMap: Record<string, { welcome: string; welcomeSub: string; morning: string; afternoon: string; evening: string; night: string; whatGoal: string }> = {
      ar: {
        welcome: "مرحبًا بك في SoufTools",
        welcomeSub: "مساحة إطلاق الذكاء الاصطناعي الفائقة — حدد ما تريد إنجازه وسيتولى SoufAI الباقي.",
        morning: "صباح الخير 👋",
        afternoon: "طاب مساؤك 👋",
        evening: "مساء الخير 👋",
        night: "أهلاً بك 👋",
        whatGoal: "ماذا تريد أن تنجز اليوم في منصة SoufTools؟",
      },
      en: {
        welcome: "Welcome to SoufTools",
        welcomeSub: "Next-gen AI launchpad — state your goal and let SoufAI orchestrate the execution.",
        morning: "Good morning 👋",
        afternoon: "Good afternoon 👋",
        evening: "Good evening 👋",
        night: "Welcome back 👋",
        whatGoal: "What would you like to accomplish today in SoufTools?",
      },
      fr: {
        welcome: "Bienvenue sur SoufTools",
        welcomeSub: "Espace de travail IA nouvelle génération — exprimez votre objectif et laissez SoufAI s'occuper du reste.",
        morning: "Bonjour 👋",
        afternoon: "Bon après-midi 👋",
        evening: "Bonsoir 👋",
        night: "Bon retour 👋",
        whatGoal: "Que souhaitez-vous accomplir aujourd'hui sur SoufTools ?",
      },
      es: {
        welcome: "Bienvenido a SoufTools",
        welcomeSub: "Plataforma de IA de última generación: indica tu objetivo y SoufAI se encargará del resto.",
        morning: "Buenos días 👋",
        afternoon: "Buenas tardes 👋",
        evening: "Buenas noches 👋",
        night: "Bienvenido de nuevo 👋",
        whatGoal: "¿Qué te gustaría lograr hoy en SoufTools?",
      },
      de: {
        welcome: "Willkommen bei SoufTools",
        welcomeSub: "KI-Arbeitsbereich der nächsten Generation – nennen Sie Ihr Ziel und SoufAI übernimmt.",
        morning: "Guten Morgen 👋",
        afternoon: "Guten Tag 👋",
        evening: "Guten Abend 👋",
        night: "Willkommen zurück 👋",
        whatGoal: "Was möchten Sie heute in SoufTools erreichen?",
      },
      "zh-CN": {
        welcome: "欢迎来到 SoufTools",
        welcomeSub: "下一代 AI 启动台 —— 说明您的目标，让 SoufAI 为您编排执行。",
        morning: "早上好 👋",
        afternoon: "下午好 👋",
        evening: "晚上好 👋",
        night: "欢迎回来 👋",
        whatGoal: "今天想在 SoufTools 完成什么任务？",
      },
      ru: {
        welcome: "Добро пожаловать в SoufTools",
        welcomeSub: "ИИ-платформа нового поколения — опишите задачу, и SoufAI реализует её.",
        morning: "Доброе утро 👋",
        afternoon: "Добрый день 👋",
        evening: "Добрый вечер 👋",
        night: "С возвращением 👋",
        whatGoal: "Какую задачу вы хотите решить сегодня в SoufTools?",
      },
      pt: {
        welcome: "Bem-vindo ao SoufTools",
        welcomeSub: "Plataforma de IA de última geração — declare seu objetivo e deixe o SoufAI agir.",
        morning: "Bom dia 👋",
        afternoon: "Boa tarde 👋",
        evening: "Boa noite 👋",
        night: "Bem-vindo de volta 👋",
        whatGoal: "O que você gostaria de realizar hoje no SoufTools?",
      },
      id: {
        welcome: "Selamat datang di SoufTools",
        welcomeSub: "Launchpad AI generasi berikutnya — tentukan tujuan Anda dan biarkan SoufAI menjalankannya.",
        morning: "Selamat pagi 👋",
        afternoon: "Selamat siang 👋",
        evening: "Selamat malam 👋",
        night: "Selamat datang kembali 👋",
        whatGoal: "Apa yang ingin Anda capai hari ini di SoufTools?",
      },
      hi: {
        welcome: "SoufTools में आपका स्वागत है",
        welcomeSub: "अगली पीढ़ी का एआई वर्कस्पेस — अपना लक्ष्य बताएं और SoufAI इसे पूरा करेगा।",
        morning: "शुभ प्रभात 👋",
        afternoon: "शुभ दोपहर 👋",
        evening: "शुभ संध्या 👋",
        night: "वापसी पर स्वागत है 👋",
        whatGoal: "आज आप SoufTools में क्या हासिल करना चाहते हैं?",
      },
      bn: {
        welcome: "SoufTools-এ স্বাগতম",
        welcomeSub: "পরবর্তী প্রজন্মের এআই ওয়ার্কস্পেস — আপনার লক্ষ্য বলুন এবং বাকিটা SoufAI পরিচালনা করবে।",
        morning: "শুভ সকাল 👋",
        afternoon: "শুভ দুপুর 👋",
        evening: "শুভ সন্ধ্যা 👋",
        night: "আবার স্বাগতম 👋",
        whatGoal: "আজ আপনি SoufTools-এ কী অর্জন করতে চান?",
      },
      ur: {
        welcome: "SoufTools میں خوش آمدید",
        welcomeSub: "اگلی نسل کا اے آئی ورک اسپیس — اپنا مقصد بیان کریں اور باقی کام SoufAI سنبھالے گا۔",
        morning: "صبح بخیر 👋",
        afternoon: "دوپہر بخیر 👋",
        evening: "شام بخیر 👋",
        night: "واپسی پر خوش آمدید 👋",
        whatGoal: "آج آپ SoufTools میں کیا کرنا چاہتے ہیں؟",
      },
    };

    const g = greetingsMap[locale] || (isRtl ? greetingsMap["ar"] : greetingsMap["en"]);

    if (!isReturning || !profile.onboardingCompleted) {
      title = g.welcome;
      subtitle = g.welcomeSub;
    } else {
      const timeGreetings = {
        morning: g.morning,
        afternoon: g.afternoon,
        evening: g.evening,
        night: g.night,
      };
      title = userDisplayName ? `${timeGreetings[timeOfDay]} ${userDisplayName}` : timeGreetings[timeOfDay];
      subtitle = g.whatGoal;
    }

    return {
      title,
      subtitle,
      timeOfDay,
      isReturning,
      topContextSnippet: topTool || undefined,
    };
  }

  /**
   * Get Dynamic, Personalized Quick Intent Cards (Re-ordered according to behavior)
   */
  getPersonalizedQuickIntents(localeOrIsRtl: boolean | string): QuickIntentItem[] {
    const isRtl = typeof localeOrIsRtl === "boolean" ? localeOrIsRtl : (localeOrIsRtl === "ar" || localeOrIsRtl === "ur");
    const locale = typeof localeOrIsRtl === "string" ? localeOrIsRtl : (isRtl ? "ar" : "en");
    const profile = this.currentProfile || DEFAULT_PROFILE;
    const frequent = profile.usagePatterns.frequentTools || [];
    const launchChoices = profile.launchChoices || [];

    const intentsByLocale: Record<string, Record<string, { title: string; desc: string; prompt: string; badge?: string }>> = {
      ar: {
        webSearch: { title: "البحث المعمق", desc: "بحث مباشر في الويب مع استخراج المصادر والتحليل", prompt: "ابحث عن أحدث المستجدات في: " },
        coding: { title: "بناء تطبيق وكود", desc: "كتابة الأكواد، إنشاء واجهات React، ومعاينة حية", prompt: "أنشئ لي تطبيقاً تفاعلياً لـ: ", badge: "معاينة حية" },
        agentMode: { title: "الوكيل الذكي", desc: "تنفيذ مهام متعددة الخطوات تلقائياً وبأعلى دقة", prompt: "قم بتنفيذ المهمة التالية خطوة بخطوة: ", badge: "ذاتي التفكير" },
        imageGeneration: { title: "إنشاء وتعديل الصور", desc: "توليد صور فائقة الجودة وتعديلها بالفرشاة والرؤية", prompt: "أنشئ لي صورة احترافية بتفاصيل دقيقة لـ: " },
        files: { title: "تحليل المستندات", desc: "فحص وتحليل ملفات PDF والتقارير والبيانات", prompt: "حلل هذا الملف واستخرج النقاط الرئيسية: " },
        dataAnalytics: { title: "تحليل البيانات", desc: "تحليل الجداول والرسوم البيانية والمعادلات المعقدة", prompt: "حلل البيانات التالية وقدم رؤى وتوصيات إحصائية: " },
      },
      en: {
        webSearch: { title: "Deep Web Research", desc: "Grounded live web search with citations & synthesis", prompt: "Search the latest updates on: " },
        coding: { title: "Build App & Code", desc: "Generate full-stack components with live sandboxed preview", prompt: "Build a responsive interactive app for: ", badge: "Live Preview" },
        agentMode: { title: "Autonomous Agent", desc: "Multi-step reasoning and automated execution runtime", prompt: "Execute the following multi-step goal: ", badge: "Auto-Pilot" },
        imageGeneration: { title: "Image Generation", desc: "Ultra-res image synthesis & visual inpainting studio", prompt: "Generate a high-detail artwork of: " },
        files: { title: "Document & File AI", desc: "Extract insights, summaries & tables from PDFs & files", prompt: "Analyze this document and extract key takeaways: " },
        dataAnalytics: { title: "Data Analytics", desc: "Parse CSVs, structured metrics & analytical charts", prompt: "Analyze these metrics and provide statistical insights: " },
      },
      fr: {
        webSearch: { title: "Recherche Web Approfondie", desc: "Recherche en direct avec citations et synthèse", prompt: "Recherchez les dernières nouveautés sur : " },
        coding: { title: "Développer une Application", desc: "Génération de code React avec prévisualisation", prompt: "Créez une application interactive pour : ", badge: "Aperçu en direct" },
        agentMode: { title: "Agent Autonome", desc: "Exécution automatisée de tâches multi-étapes", prompt: "Exécutez l'objectif suivant étape par étape : ", badge: "Pilote auto" },
        imageGeneration: { title: "Génération d'Images", desc: "Studio de création visuelle et retouche haute définition", prompt: "Générez une illustration détaillée de : " },
        files: { title: "Analyse de Documents", desc: "Extraction d'informations et résumés de fichiers PDF", prompt: "Analysez ce document et extrayez les points clés : " },
        dataAnalytics: { title: "Analyse de Données", desc: "Traitement de métriques et visualisations graphiques", prompt: "Analysez ces données et fournissez des recommandations : " },
      },
      es: {
        webSearch: { title: "Investigación Web", desc: "Búsqueda web en vivo con citas verificadas", prompt: "Busca las últimas novedades sobre: " },
        coding: { title: "Crear App y Código", desc: "Generación de componentes con vista previa interactiva", prompt: "Crea una app interactiva para: ", badge: "Vista previa" },
        agentMode: { title: "Agente Autónomo", desc: "Ejecución automatizada de tareas en varios pasos", prompt: "Ejecuta el siguiente objetivo paso a paso: ", badge: "Piloto automático" },
        imageGeneration: { title: "Generación de Imágenes", desc: "Creación y edición visual de alta resolución", prompt: "Genera una ilustración detallada de: " },
        files: { title: "Análisis de Documentos", desc: "Extracción y resumen de archivos PDF y datos", prompt: "Analiza este documento y extrae las conclusiones: " },
        dataAnalytics: { title: "Análisis de Datos", desc: "Procesamiento de tablas y métricas estadísticas", prompt: "Analiza estas métricas y ofrece recomendaciones: " },
      },
      de: {
        webSearch: { title: "Tiefe Websuche", desc: "Echtzeit-Websuche mit Quellenangaben und Zusammenfassung", prompt: "Suche nach den neuesten Updates zu: " },
        coding: { title: "App & Code erstellen", desc: "Generierung von Full-Stack-Code mit Live-Vorschau", prompt: "Erstelle eine interaktive Anwendung für: ", badge: "Live-Vorschau" },
        agentMode: { title: "Autonomer Agent", desc: "Mehrstufige zielgerichtete Aufgabenausführung", prompt: "Führe das folgende Ziel schrittweise aus: ", badge: "Autopilot" },
        imageGeneration: { title: "Bilderstellung", desc: "Hochauflösende Bildsynthese und Bearbeitung", prompt: "Generiere ein detailliertes Bild von: " },
        files: { title: "Dokumenten-Analyse", desc: "Erkenntnisse und Zusammenfassungen aus PDFs", prompt: "Analysiere dieses Dokument und fasse es zusammen: " },
        dataAnalytics: { title: "Datenanalyse", desc: "Auswertung von Metriken und statistischen Charts", prompt: "Analysiere diese Daten und gib Empfehlungen: " },
      },
      "zh-CN": {
        webSearch: { title: "深度网络搜索", desc: "带引用与智能总结的实时在线搜索", prompt: "搜索关于以下内容的最新动态： " },
        coding: { title: "构建应用与代码", desc: "全栈代码生成与沙盒实时预览", prompt: "为我构建一个交互式应用： ", badge: "实时预览" },
        agentMode: { title: "自主智能代理", desc: "多步骤复杂任务的自动化自主执行", prompt: "请逐步执行以下目标任务： ", badge: "自动驾驶" },
        imageGeneration: { title: "图像创作与编辑", desc: "超高分辨率图像合成与区域修饰", prompt: "为我生成一张高细节艺术图像： " },
        files: { title: "文档与文件分析", desc: "从 PDF 和报告中提取见解与核心摘要", prompt: "分析此文档并提取关键要点： " },
        dataAnalytics: { title: "数据分析与图表", desc: "解析结构化数据指标并提供洞察", prompt: "分析这些数据指标并给出统计建议： " },
      },
      ru: {
        webSearch: { title: "Глубокий веб-поиск", desc: "Живой поиск с цитатами и аналитическим синтезом", prompt: "Найди актуальную информацию о: " },
        coding: { title: "Создание кода и приложений", desc: "Генерация компонентов с интерактивным предпросмотром", prompt: "Создай интерактивное приложение для: ", badge: "Живой просмотр" },
        agentMode: { title: "Автономный агент", desc: "Многоэтапное автоматическое выполнение задач", prompt: "Выполни следующую задачу пошагово: ", badge: "Автопилот" },
        imageGeneration: { title: "Генерация изображений", desc: "Синтез графики высокого разрешения и ретушь", prompt: "Создай детальную иллюстрацию на тему: " },
        files: { title: "Анализ документов", desc: "Извлечение выводов и таблиц из PDF", prompt: "Проанализируй документ и выдели ключевые моменты: " },
        dataAnalytics: { title: "Аналитика данных", desc: "Обработка таблиц и аналитических графиков", prompt: "Проанализируй эти показатели и дай рекомендации: " },
      },
      pt: {
        webSearch: { title: "Pesquisa Web Profunda", desc: "Busca na web em tempo real com fontes e síntese", prompt: "Pesquise as atualizações mais recentes sobre: " },
        coding: { title: "Construir App e Código", desc: "Geração de código com prévia interativa em sandbox", prompt: "Crie um aplicativo interativo para: ", badge: "Prévia ao vivo" },
        agentMode: { title: "Agente Autônomo", desc: "Raciocínio em várias etapas e execução automática", prompt: "Execute o seguinte objetivo passo a passo: ", badge: "Piloto automático" },
        imageGeneration: { title: "Geração de Imagens", desc: "Estúdio de criação visual de alta resolução", prompt: "Gere uma arte detalhada de: " },
        files: { title: "Análise de Documentos", desc: "Resumo e extração de dados de PDFs e arquivos", prompt: "Analise este documento e extraia os pontos principais: " },
        dataAnalytics: { title: "Análise de Dados", desc: "Métricas estruturadas e gráficos analíticos", prompt: "Analise essas métricas e forneça recomendações: " },
      },
      id: {
        webSearch: { title: "Riset Web Mendalam", desc: "Pencarian langsung dengan kutipan dan sintesis", prompt: "Cari informasi terbaru tentang: " },
        coding: { title: "Buat Aplikasi & Kode", desc: "Pembuatan kode dengan pratinjau interaktif langsung", prompt: "Buat aplikasi interaktif untuk: ", badge: "Pratinjau langsung" },
        agentMode: { title: "Agen Otonom", desc: "Eksekusi otomatis langkah demi langkah", prompt: "Jalankan sasaran berikut langkah demi langkah: ", badge: "Autopilot" },
        imageGeneration: { title: "Generasi Gambar", desc: "Studio pembuatan visual resolusi tinggi", prompt: "Buat karya seni mendetail tentang: " },
        files: { title: "Analisis Dokumen", desc: "Ekstraksi wawasan dan ringkasan dari PDF", prompt: "Analisis dokumen ini dan ambil poin pentingnya: " },
        dataAnalytics: { title: "Analisis Data", desc: "Pemrosesan metrik dan grafik analitis", prompt: "Analisis metrik ini dan berikan wawasan: " },
      },
      hi: {
        webSearch: { title: "गहन वेब खोज", desc: "सत्यापित उद्धरणों के साथ लाइव खोज", prompt: "इसके बारे में नवीनतम अपडेट खोजें: " },
        coding: { title: "ऐप और कोड बनाएं", desc: "लाइव पूर्वावलोकन के साथ कोड जनरेशन", prompt: "इसके लिए एक इंटरैक्टिव ऐप बनाएं: ", badge: "लाइव पूर्वावलोकन" },
        agentMode: { title: "स्वायत्त एजेंट", desc: "बहु-चरणीय स्वचालित कार्य निष्पादन", prompt: "निम्नलिखित कार्य को चरणबद्ध पूरा करें: ", badge: "ऑटो-पायलट" },
        imageGeneration: { title: "छवि निर्माण", desc: "उच्च रिज़ॉल्यूशन दृश्य कला स्टूडियो", prompt: "एक विस्तृत कलाकृति उत्पन्न करें: " },
        files: { title: "दस्तावेज़ विश्लेषण", desc: "पीडीएफ़ से मुख्य अंतर्दृष्टि निकालें", prompt: "इस दस्तावेज़ का विश्लेषण करें: " },
        dataAnalytics: { title: "डेटा विश्लेषण", desc: "तालिकाओं और चार्ट का सांख्यिकीय विश्लेषण", prompt: "इन मैट्रिक्स का विश्लेषण करें: " },
      },
      bn: {
        webSearch: { title: "গভীর ওয়েব অনুসন্ধান", desc: "উদ্ধৃতি ও তথ্য সংশ্লেষণ সহ লাইভ অনুসন্ধান", prompt: "এর সর্বশেষ তথ্য অনুসন্ধান করুন: " },
        coding: { title: "অ্যাপ ও কোড তৈরি", desc: "লাইভ প্রিভিউ সহ কোড জেনারেশন", prompt: "এর জন্য একটি ইন্টারেক্টিভ অ্যাপ তৈরি করুন: ", badge: "লাইভ প্রিভিউ" },
        agentMode: { title: "স্বয়ংক্রিয় এজেন্ট", desc: "ধাপে ধাপে স্বয়ংক্রিয় কাজ সম্পাদন", prompt: "নিম্নলিখিত কাজটি ধাপে ধাপে সম্পন্ন করুন: ", badge: "অটোপাইলট" },
        imageGeneration: { title: "ছবি তৈরি", desc: "উচ্চ রেজোলিউশন শিল্পকলা স্টুডিও", prompt: "একটি বিশদ শিল্পকর্ম তৈরি করুন: " },
        files: { title: "নথি বিশ্লেষণ", desc: "পিডিএফ থেকে মূল তথ্য নিষ্কাশন", prompt: "এই নথিটি বিশ্লেষণ করুন: " },
        dataAnalytics: { title: "ডেটা বিশ্লেষণ", desc: "পরিসংখ্যানগত তথ্য বিশ্লেষণ", prompt: "এই ডেটা বিশ্লেষণ করুন: " },
      },
      ur: {
        webSearch: { title: "گہری ویب تحقیق", desc: "مستند حوالہ جات کے ساتھ لائیو تلاش", prompt: "اس کے بارے میں تازہ ترین معلومات تلاش کریں: " },
        coding: { title: "ایپ اور کوڈ بنائیں", desc: "لائیو پریویو کے ساتھ کوڈنگ", prompt: "اس کے لیے ایک انٹرایکٹو ایپ بنائیں: ", badge: "لائیو جائزہ" },
        agentMode: { title: "خود مختار ایجنٹ", desc: "کئی مراحل پر مشتمل کام خودکار مکمل کریں", prompt: "یہ کام مرحلہ وار انجام دیں: ", badge: "آٹو پائلٹ" },
        imageGeneration: { title: "تصویر بنائیں", desc: "اعلیٰ کوالٹی آرٹ ورک اسٹوڈیو", prompt: "ایک تفصیلی تصویر بنائیں: " },
        files: { title: "دستاویزات کا تجزیہ", desc: "پی ڈی ایف سے خلاصہ اور معلومات نکالیں", prompt: "اس دستاویز کا تجزیہ کریں: " },
        dataAnalytics: { title: "ڈیٹا کا تجزیہ", desc: "اعداد و شمار اور گراف کا تجزیہ", prompt: "اس ڈیٹا کا تجزیہ کریں: " },
      },
    };

    const locIntents = intentsByLocale[locale] || (isRtl ? intentsByLocale["ar"] : intentsByLocale["en"]);

    const baseIntents: QuickIntentItem[] = [
      {
        id: "intent_web_search",
        key: "webSearch",
        title: locIntents.webSearch.title,
        description: locIntents.webSearch.desc,
        icon: "Search",
        accentColor: "#00d4aa",
        defaultPrompt: locIntents.webSearch.prompt,
        activeTools: ["web_search"],
        modelId: "core",
        workflowType: "research",
      },
      {
        id: "intent_coding",
        key: "coding",
        title: locIntents.coding.title,
        description: locIntents.coding.desc,
        icon: "Code",
        accentColor: "#00ff88",
        badge: locIntents.coding.badge,
        defaultPrompt: locIntents.coding.prompt,
        activeTools: ["create_code", "agent_mode"],
        modelId: "coder",
        workflowType: "coding",
      },
      {
        id: "intent_agent",
        key: "agentMode",
        title: locIntents.agentMode.title,
        description: locIntents.agentMode.desc,
        icon: "Bot",
        accentColor: "#38bdf8",
        badge: locIntents.agentMode.badge,
        defaultPrompt: locIntents.agentMode.prompt,
        activeTools: ["agent_mode", "deep_thinking"],
        modelId: "pro",
        workflowType: "agent",
      },
      {
        id: "intent_image",
        key: "imageGeneration",
        title: locIntents.imageGeneration.title,
        description: locIntents.imageGeneration.desc,
        icon: "Palette",
        accentColor: "#f43f5e",
        defaultPrompt: locIntents.imageGeneration.prompt,
        activeTools: ["create_image"],
        modelId: "vision",
        workflowType: "image",
      },
      {
        id: "intent_files",
        key: "files",
        title: locIntents.files.title,
        description: locIntents.files.desc,
        icon: "FileText",
        accentColor: "#eab308",
        defaultPrompt: locIntents.files.prompt,
        activeTools: ["file_analysis"],
        modelId: "pro",
        workflowType: "file",
      },
      {
        id: "intent_data",
        key: "dataAnalytics",
        title: locIntents.dataAnalytics.title,
        description: locIntents.dataAnalytics.desc,
        icon: "BarChart3",
        accentColor: "#a855f7",
        defaultPrompt: locIntents.dataAnalytics.prompt,
        activeTools: ["deep_analysis", "deep_thinking"],
        modelId: "pro",
        workflowType: "data",
      },
    ];

    // Personalization sorting: Elevate user's top tools and initial onboarding choices
    return [...baseIntents].sort((a, b) => {
      const aScore = (frequent.indexOf(a.key) >= 0 ? 10 - frequent.indexOf(a.key) : 0) +
                     (launchChoices.includes(a.key) ? 5 : 0) +
                     ((profile.tools[a.key] || 0) > 0 ? 2 : 0);
      const bScore = (frequent.indexOf(b.key) >= 0 ? 10 - frequent.indexOf(b.key) : 0) +
                     (launchChoices.includes(b.key) ? 5 : 0) +
                     ((profile.tools[b.key] || 0) > 0 ? 2 : 0);
      return bScore - aScore;
    });
  }

  /**
   * Get Dynamic Suggestions customized to the user ("⭐ مقترح لك")
   */
  getPersonalizedSuggestions(localeOrIsRtl: boolean | string, recentSessions?: any[]): SmartLaunchSuggestion[] {
    const isRtl = typeof localeOrIsRtl === "boolean" ? localeOrIsRtl : (localeOrIsRtl === "ar" || localeOrIsRtl === "ur");
    const locale = typeof localeOrIsRtl === "string" ? localeOrIsRtl : (isRtl ? "ar" : "en");
    const profile = this.currentProfile || DEFAULT_PROFILE;
    const topTool = profile.usagePatterns.frequentTools[0] || profile.launchChoices[0] || "webSearch";
    const suggestions: SmartLaunchSuggestion[] = [];

    // If there's a recent unfinished task/session, add a resume suggestion
    if (recentSessions && recentSessions.length > 0) {
      const latest = recentSessions[0];
      const resumePrefix = isRtl ? "متابعة:" : "Resume:";
      const resumeSub = isRtl ? "متابعة من حيث توقفت في جلستك السابقة" : "Pick up right where you left off";
      const resumePrompt = isRtl ? `تابع العمل على: ${latest.title}` : `Continue working on: ${latest.title}`;

      suggestions.push({
        id: "sug_resume_latest",
        title: `${resumePrefix} ${latest.title}`,
        subtitle: resumeSub,
        icon: "RotateCcw",
        category: "resume",
        prompt: resumePrompt,
        activeTools: [],
        modelId: latest.modelId || "core",
        highlight: true,
      });
    }

    if (topTool === "coding" || profile.launchChoices.includes("coding")) {
      suggestions.push({
        id: "sug_coding_app",
        title: isRtl ? "بناء تطبيق ويب تفاعلي" : "Build Interactive Web App",
        subtitle: isRtl ? "إنشاء واجهة React مع معاينة فورية للكود" : "Generate React component with live sandbox",
        icon: "Code",
        category: "coding",
        prompt: isRtl ? "أنشئ لي واجهة تطبيق حديثة ومتجاوبة مع ميزات تفاعلية لـ " : "Build a modern interactive web app with Tailwind and React for ",
        activeTools: ["create_code", "agent_mode"],
        modelId: "coder",
      });
      suggestions.push({
        id: "sug_coding_fix",
        title: isRtl ? "فحص وإصلاح كود برمجي" : "Inspect & Refactor Code",
        subtitle: isRtl ? "تحليل الأخطاء واقتراح كود محسّن" : "Diagnose bugs and get optimized solutions",
        icon: "Sparkles",
        category: "coding",
        prompt: isRtl ? "افحص الكود التالي، حدد المشاكل واقترح حلاً محسناً: " : "Inspect the following code, diagnose bugs and provide an optimized fix: ",
        activeTools: ["create_code", "deep_thinking"],
        modelId: "coder",
      });
    }

    if (topTool === "webSearch" || profile.launchChoices.includes("webSearch") || suggestions.length < 3) {
      suggestions.push({
        id: "sug_web_deep",
        title: isRtl ? "بحث استقصائي معمق" : "Deep Web Investigation",
        subtitle: isRtl ? "تجميع ومقارنة مصادر الويب الموثوقة" : "Synthesize multiple authoritative sources",
        icon: "Search",
        category: "research",
        prompt: isRtl ? "ابحث وقدم تقريراً شاملاً ومقارناً مع المصادر حول: " : "Conduct a deep grounded search and synthesis on: ",
        activeTools: ["web_search", "deep_thinking"],
        modelId: "core",
      });
    }

    if (topTool === "imageGeneration" || profile.launchChoices.includes("imageGeneration") || suggestions.length < 3) {
      suggestions.push({
        id: "sug_image_creative",
        title: isRtl ? "توليد تصميم بصري فائق" : "Generate High-Def Artwork",
        subtitle: isRtl ? "إنشاء صورة واقعية مع إضاءة سينمائية" : "Create cinematic visual with prompt tuning",
        icon: "Palette",
        category: "image",
        prompt: isRtl ? "أنشئ لي صورة فائقة الجودة ذات طابع إبداعي وإضاءة سينمائية لـ: " : "Generate an ultra-realistic cinematic artwork of: ",
        activeTools: ["create_image"],
        modelId: "vision",
      });
    }

    if (topTool === "files" || profile.launchChoices.includes("files") || suggestions.length < 4) {
      suggestions.push({
        id: "sug_file_summary",
        title: isRtl ? "استخراج ملخص تنفيذي لملف" : "Executive File Summary",
        subtitle: isRtl ? "تحويل المستند إلى نقاط عمل محددة" : "Distill document into actionable highlights",
        icon: "FileText",
        category: "file",
        prompt: isRtl ? "حلل هذا المستند وقدم ملخصاً تنفيذياً بـ 5 نقاط رئيسية: " : "Summarize this document with 5 executive actionable insights: ",
        activeTools: ["file_analysis", "deep_thinking"],
        modelId: "pro",
      });
    }

    return suggestions.slice(0, 4);
  }

  /**
   * Get Context for SoufAI Persona / Prompt Injection
   */
  getPersonalizationContext(): BehaviorContextForAI | null {
    if (!this.currentProfile || this.currentProfile.privacyMode === "off") return null;

    const { usagePatterns, tools, preferredModes, launchChoices } = this.currentProfile;
    return {
      topTools: usagePatterns.frequentTools || [],
      commonWorkflow: usagePatterns.frequentWorkflows[0] || undefined,
      recentFeature: usagePatterns.frequentTools[0] || undefined,
      completionRate: usagePatterns.completionRate,
      preferredModes,
      launchChoices,
    };
  }

  /**
   * Generate Smart Suggestion for chat
   */
  getSmartSuggestion(): SmartSuggestion | null {
    if (!this.currentProfile || this.currentProfile.privacyMode !== "personalized") return null;

    const topTools = this.currentProfile.usagePatterns.frequentTools;

    if (topTools.includes("webSearch") && topTools.includes("coding")) {
      return {
        id: "sug_research_code",
        title: "اقتراح البحث والبرمجة",
        description: "هل ترغب في البحث في التوثيق وإنشاء شفرة برمجة متكاملة مباشرة؟",
        actionType: "prompt_insert",
        actionPayload: "قم بالبحث عن أحدث المكتبات واكتب نموذج كود متكامل لـ ",
        iconName: "Code",
      };
    }

    if (topTools.includes("webSearch")) {
      return {
        id: "sug_web_summary",
        title: "ملخص المصادر المتعددة",
        description: "أداة البحث هي الأكثر استخداماً لديك — هل ترغب بتلخيص مصادر ويب متعددة؟",
        actionType: "prompt_insert",
        actionPayload: "ابحث عن أحدث الأخبار والتقرير حول الموضوع واعرض لي تلخيصاً شاملاً مع المصادر",
        iconName: "Search",
      };
    }

    if (topTools.includes("imageGeneration")) {
      return {
        id: "sug_image_style",
        title: "توليد وتعديل الصور",
        description: "تريد إنشاء صورة عالية الدقة أو تعديلها مع معالجة الرؤية البصرية؟",
        actionType: "prompt_insert",
        actionPayload: "أنشئ لي صورة بدقة عالية تتضمن ",
        iconName: "Image",
      };
    }

    return null;
  }

  /**
   * Change Privacy Mode
   */
  async setPrivacyMode(mode: BehaviorPrivacyMode): Promise<void> {
    if (!this.currentProfile) await this.initialize();
    if (this.currentProfile) {
      this.currentProfile.privacyMode = mode;
      this.currentProfile.profileUpdatedAt = Date.now();
      await localBehaviorStore.saveProfile(this.currentProfile);

      if (mode === "off") {
        await localBehaviorStore.clearAllData();
      } else {
        this.checkSmartSync(true);
      }
      this.notifyListeners();
    }
  }

  /**
   * Clear all local events and local profile data
   */
  async clearLocalData(): Promise<void> {
    await localBehaviorStore.clearAllData();
    this.currentProfile = { ...DEFAULT_PROFILE, profileUpdatedAt: Date.now() };
    await localBehaviorStore.saveProfile(this.currentProfile);
    this.notifyListeners();
  }

  /**
   * Delete cloud profile from Cloud Backend and wipe local profile
   */
  async deleteCloudProfile(): Promise<boolean> {
    const userId = auth.currentUser?.uid;
    if (userId && !userId.startsWith("guest_")) {
      await deleteBehaviorProfileFromCloud(userId);
    }
    await this.clearLocalData();
    return true;
  }

  /**
   * Get Current Behavior Profile (Snapshot)
   */
  getProfile(): UserBehaviorProfile {
    return this.currentProfile || DEFAULT_PROFILE;
  }
}

export const SoufBehaviorEngine = new SoufBehaviorEngineService();
