import {
  getUserMemories,
  getMemorySettings,
  getUserProfileKnowledge,
} from "./memoryService";
import {
  retrieveRelevantMemories,
  analyzePromptForNewMemory,
} from "./memoryAnalyzer";
import { MemoryContextBuildResult } from "./types";

interface BuildMemoryContextParams {
  userId?: string;
  prompt: string;
  projectId?: string;
  projectName?: string;
}

/**
 * Builds the AI context injection block from user's long-term memory in Firestore
 */
export async function buildMemoryContext({
  userId,
  prompt,
  projectId,
  projectName,
}: BuildMemoryContextParams): Promise<MemoryContextBuildResult> {
  const settings = await getMemorySettings(userId);

  if (!settings.memoryEnabled) {
    return {
      retrievedMemories: [],
      contextBlock: "",
      candidateNewMemory: null,
    };
  }

  const allMemories = await getUserMemories(userId);
  const userProfile = await getUserProfileKnowledge(userId);
  const relevant = retrieveRelevantMemories(
    prompt,
    allMemories,
    settings.maxContextItems,
    projectId
  );

  let contextBlock = "";
  const parts: string[] = [];

  // 1. User Profile & Name Section
  const userFactMemories = allMemories.filter((m) => m.enabled && m.type === "user");
  if (
    userProfile.userName ||
    userProfile.activeProjects.length > 0 ||
    userProfile.keyPreferences.length > 0 ||
    userFactMemories.length > 0
  ) {
    const profileLines: string[] = [];
    if (userProfile.userName) {
      profileLines.push(`- 👤 اسم المستخدم المعتمد: "${userProfile.userName}"`);
      profileLines.push(`- 💬 توجيه المخاطبة: أنت تعرف المستخدم منذ مدة، خاطبه بودية واحترافية وناده باسمه ("يا ${userProfile.userName}") في سياق الحديث الطبيعي دون تكلف.`);
    }
    if (userProfile.primaryRole) {
      profileLines.push(`- 💼 الدور/المجال: ${userProfile.primaryRole}`);
    }
    for (const uFact of userFactMemories) {
      if (!profileLines.some((l) => l.includes(uFact.content))) {
        profileLines.push(`- 📌 حقيقة ومعلومة مثبتة عن المستخدم: ${uFact.content}`);
      }
    }
    if (userProfile.activeProjects.length > 0) {
      const projNames = userProfile.activeProjects.map((p) => p.name).join("، ");
      profileLines.push(`- 📂 المشاريع الحالية للمستخدم: ${projNames}`);
    }
    if (userProfile.keyPreferences.length > 0) {
      const prefs = userProfile.keyPreferences.slice(0, 6).join(" | ");
      profileLines.push(`- ⚙️ أبرز تفضيلات المستخدم: ${prefs}`);
    }
    if (userProfile.importantSearches.length > 0) {
      const recentSearch = userProfile.importantSearches[0];
      profileLines.push(`- 🔍 أحدث موضوع بحث مهم اهتم به: "${recentSearch.query}" (${recentSearch.summary.slice(0, 80)})`);
    }

    parts.push(`[الملف الشخصي وهوية المستخدم (SoufAI Long-Term Profile)]:\n${profileLines.join("\n")}`);
  }

  // 2. Specific Relevant Memories
  if (relevant.length > 0) {
    const memoryStrings = relevant.map((m) => {
      const projLabel = m.projectName ? `[مشروع: ${m.projectName}] ` : "";
      const typeLabel =
        m.type === "project"
          ? "مشروع/تقنية"
          : m.type === "preference"
          ? "تفضيل شخصي"
          : m.type === "user"
          ? "هوية وبيانات المستخدم"
          : m.type === "search"
          ? "بحث واستعلام مهم"
          : "معرفة طويلة الأمد";
      return `- (${typeLabel}) ${projLabel}${m.content}`;
    });

    parts.push(`[الذاكرة السياقية المسترجعة للطلب الحقيقي]:\n${memoryStrings.join("\n")}`);
  }

  if (parts.length > 0) {
    contextBlock = `
\n--- [SoufAI Long-Term Memory & User Profile System] ---
${parts.join("\n\n")}
تعليمات الذاكرة: استخدم هذه المعلومات المسبقة لتخصيص الإجابة تماماً، واستخدم أدوات الذاكرة (save_user_memory, update_user_memory) عند ورود أي تفضيل جديد أو معلومة جديدة.
--- [End Memory System] ---\n
`;
  }

  // Check for auto-suggest / new memory candidate
  let candidateNewMemory = null;
  if (settings.autoSuggest) {
    candidateNewMemory = analyzePromptForNewMemory(prompt, projectName);
  }

  return {
    retrievedMemories: relevant,
    userProfile,
    contextBlock,
    candidateNewMemory,
  };
}
