/**
 * SoufAI Advanced Memory & User Profile Tools
 * Enables the autonomous agent to store, recall, update, and prune long-term user facts,
 * user name, active projects, coding preferences, and important research topics using
 * SoufTools Cloud Memory Engine (Turso).
 */

import { SoufToolsMemoryEngine } from "@/lib/memory/memoryEngine";
import { MemoryRepository } from "@/lib/db";
import { MemoryType, SoufAIMemory } from "@/lib/memory/types";
import { AgentTool, AgentToolExecutionContext, StructuredToolResult } from "./toolInterface";

export const saveUserMemoryTool: AgentTool = {
  name: "save_user_memory",
  description:
    "حفظ وتثبيت حقيقة أو تفضيل أو اسم المستخدم أو مشروع قيد العمل أو استعلام بحث مهم في الذاكرة السحابية طويلة الأمد (Turso) لاستخدامها دائماً والتعرف على المستخدم ومخاطبته باسمه",
  inputSchema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        description: "نوع المعلومة المراد حفظها",
        enum: [
          "USER_FACT",
          "PREFERENCE",
          "PROJECT_CONTEXT",
          "CONVERSATION_CONTEXT",
          "INSTRUCTION",
          "WORKFLOW_PREFERENCE",
          "TOOL_PREFERENCE",
          "PROFILE_INFORMATION",
          "user",
          "preference",
          "project",
          "search",
          "knowledge",
          "habit",
        ],
      },
      content: {
        type: "string",
        description: "المحتوى الدقيق للمعلومة أو التفضيل أو الحقيقة أو تلخيص البحث المهم",
      },
      userName: {
        type: "string",
        description: "اسم المستخدم إذا تم ذكره أو تحديثه (مثال: 'أحمد', 'سفيان')",
      },
      projectName: {
        type: "string",
        description: "اسم المشروع المرتبط بالمعلومة إن وجد",
      },
      importance: {
        type: "number",
        description: "مستوى الأهمية من 1 إلى 10 (الافتراضي 8)",
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "وسوم تصنيفية مفتاحية (مثل: ['frontend', 'react', 'name'])",
      },
    },
    required: ["type", "content"],
  },
  permissions: ["memory:write"],
  timeout: 5000,
  cost: 1,
  supportsParallel: true,
  execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
    const userId = context.userId || "default_user";
    const { type, content, userName, projectName, importance = 8, tags = [] } = args;

    if (!content || !content.trim()) {
      return {
        success: false,
        tool: "save_user_memory",
        data: null,
        error: { code: "INVALID_CONTENT", message: "محتوى الذاكرة غير محدد", retryable: false },
      };
    }

    try {
      const normalizedImportance = Math.min(1.0, Math.max(0.1, Number(importance) / 10));
      const result = await SoufToolsMemoryEngine.storeOrDeduplicateMemory(userId, {
        type: (type as MemoryType) || "USER_FACT",
        content: content.trim(),
        userName: userName?.trim(),
        projectName: projectName?.trim(),
        importance: normalizedImportance,
        confidence: 0.95,
        tags: Array.isArray(tags) ? tags : [],
        source: "agent",
      });

      const profile = await SoufToolsMemoryEngine.getUserProfileKnowledge(userId);

      return {
        success: true,
        tool: "save_user_memory",
        data: {
          savedMemory: result.memory,
          action: result.action,
          userName: profile.userName,
          activeProjectsCount: profile.activeProjects.length,
          totalMemories: profile.totalMemoriesCount,
        },
        contextNote: `[تم حفظ الذاكرة في السيرفر بنجاح (${result.action})]: تم ترسيخ "${result.memory.content}" في Turso.${
          profile.userName ? ` المستخدم المعتمد: "${profile.userName}".` : ""
        }`,
        error: null,
      };
    } catch (err: any) {
      return {
        success: false,
        tool: "save_user_memory",
        data: null,
        error: { code: "SAVE_ERROR", message: err?.message || "فشل حفظ الذاكرة في السيرفر", retryable: false },
      };
    }
  },
};

export const updateUserMemoryTool: AgentTool = {
  name: "update_user_memory",
  description: "تعديل أو تصحيح معلومة أو تفضيل أو حالة مشروع محفوظ مسبقاً في ذاكرة المستخدم على السيرفر",
  inputSchema: {
    type: "object",
    properties: {
      memoryId: {
        type: "string",
        description: "معرف الذاكرة إن كان معلوماً، أو اتركه فارغاً لتحديث بالبحث عن الموضوع",
      },
      topicOrOldContent: {
        type: "string",
        description: "الكلمة المفتاحية أو الموضوع السابق المراد تعديل معلومته",
      },
      newContent: {
        type: "string",
        description: "المحتوى الجديد المحدث للتفضيل أو المشروع أو الحقيقة",
      },
      type: {
        type: "string",
        description: "نوع المعلومة المحدثة",
      },
      importance: {
        type: "number",
        description: "مستوى الأهمية الجديد من 1 إلى 10",
      },
    },
    required: ["newContent"],
  },
  permissions: ["memory:write"],
  timeout: 5000,
  cost: 1,
  supportsParallel: false,
  execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
    const userId = context.userId || "default_user";
    const { memoryId, topicOrOldContent, newContent, type, importance } = args;

    try {
      const memories = await MemoryRepository.listByUser(userId, { status: "active" });
      let targetMem: SoufAIMemory | undefined;

      if (memoryId) {
        targetMem = memories.find((m: any) => m.id === memoryId) as any;
      } else if (topicOrOldContent) {
        const needle = topicOrOldContent.trim().toLowerCase();
        targetMem = memories.find(
          (m: any) =>
            m.content.toLowerCase().includes(needle) ||
            (m.projectName && m.projectName.toLowerCase().includes(needle))
        ) as any;
      }

      if (targetMem) {
        const updated = await MemoryRepository.updateMemory(userId, targetMem.id, {
          content: newContent,
          type: type || targetMem.type,
          importance: importance ? Math.min(1.0, Number(importance) / 10) : targetMem.importance,
        });

        return {
          success: true,
          tool: "update_user_memory",
          data: { updatedId: targetMem.id, newContent, updated },
          contextNote: `[تم تحديث الذاكرة في السيرفر بنجاح]: تم استبدال المعلومة السابقة بالمحتوى الجديد: "${newContent}".`,
          error: null,
        };
      } else {
        // Create new if not found
        const result = await SoufToolsMemoryEngine.storeOrDeduplicateMemory(userId, {
          type: (type as MemoryType) || "USER_FACT",
          content: newContent,
          importance: importance ? Math.min(1.0, Number(importance) / 10) : 0.8,
          source: "agent",
        });
        return {
          success: true,
          tool: "update_user_memory",
          data: { savedMemory: result.memory },
          contextNote: `[تم إنشاء ذاكرة جديدة]: لم يتم العثور على سابقة، فتم حفظها كمعلومة جديدة: "${newContent}".`,
          error: null,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        tool: "update_user_memory",
        data: null,
        error: { code: "UPDATE_ERROR", message: err?.message || "فشل تحديث الذاكرة", retryable: false },
      };
    }
  },
};

export const deleteUserMemoryTool: AgentTool = {
  name: "delete_user_memory",
  description: "حذف أو تنظيف معلومة أو تفضيل قديم أو غير مرغوب به من ذاكرة المستخدم في Turso",
  inputSchema: {
    type: "object",
    properties: {
      memoryId: {
        type: "string",
        description: "معرف الذاكرة إن وجد",
      },
      topicOrContent: {
        type: "string",
        description: "موضوع أو نص المعلومة المراد حذفها نهائياً",
      },
      reason: {
        type: "string",
        description: "سبب الحذف (مثال: طلب المستخدم، معلومة قديمة، إلغاء مشروع)",
      },
    },
  },
  permissions: ["memory:write"],
  timeout: 4000,
  cost: 1,
  supportsParallel: false,
  execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
    const userId = context.userId || "default_user";
    const { memoryId, topicOrContent, reason } = args;

    try {
      const memories = await MemoryRepository.listByUser(userId, { status: "active" });
      let deletedCount = 0;

      if (memoryId) {
        await MemoryRepository.deleteMemory(userId, memoryId);
        deletedCount = 1;
      } else if (topicOrContent) {
        const needle = topicOrContent.trim().toLowerCase();
        const matches = memories.filter(
          (m: any) =>
            m.content.toLowerCase().includes(needle) ||
            (m.projectName && m.projectName.toLowerCase().includes(needle))
        );
        for (const m of matches) {
          await MemoryRepository.deleteMemory(userId, m.id);
          deletedCount++;
        }
      }

      return {
        success: true,
        tool: "delete_user_memory",
        data: { deletedCount, reason },
        contextNote: `[تم تنظيف وحذف ${deletedCount} عناصر من الذاكرة]. السبب: ${reason || "تحديث وتطهير الذاكرة"}.`,
        error: null,
      };
    } catch (err: any) {
      return {
        success: false,
        tool: "delete_user_memory",
        data: null,
        error: { code: "DELETE_ERROR", message: err?.message || "فشل حذف الذاكرة", retryable: false },
      };
    }
  },
};

export const getUserProfileTool: AgentTool = {
  name: "get_user_profile",
  description:
    "استعراض الملف الشخصي الشامل للمستخدم: اسمه، تفضيلاته، مشاريعه الحالية، الأبحاث الهامة السابقة، ودرجة التعارف من Turso لتخصيص الحديث ومخاطبته باسمه",
  inputSchema: {
    type: "object",
    properties: {
      detailLevel: {
        type: "string",
        description: "مستوى التفصيل المطلوب",
        enum: ["full", "summary", "projects_only", "searches_only"],
      },
    },
  },
  permissions: ["memory:read"],
  timeout: 3000,
  cost: 1,
  supportsParallel: true,
  execute: async (args: any, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
    const userId = context.userId || "default_user";
    try {
      const profile = await SoufToolsMemoryEngine.getUserProfileKnowledge(userId);
      const allMemories = await MemoryRepository.listByUser(userId, { status: "active" });

      const projectsText = profile.activeProjects
        .map((p) => `* مشروع "${p.name}": ${p.description}`)
        .join("\n");

      const searchesText = profile.importantSearches
        .map((s) => `* بحث: "${s.query}" -> ${s.summary}`)
        .join("\n");

      const preferencesText = profile.keyPreferences.map((pref) => `* ${pref}`).join("\n");

      const profileSummary = `
[ملف المستخدم الشخصي الشامل - SoufTools Cloud Memory Engine]:
- الاسم: ${profile.userName || "غير مسجل صراحة بعد"}
- الدور الأساسي: ${profile.primaryRole || "مطور/مستخدم منصة SoufTools"}
- المشاريع النشطة (${profile.activeProjects.length}):
${projectsText || "لا توجد مشاريع مسجلة بعد"}
- التفضيلات المفتاحية (${profile.keyPreferences.length}):
${preferencesText || "تفضيلات افتراضية"}
- أبحاث واهتمامات سابقة مهمة (${profile.importantSearches.length}):
${searchesText || "لا توجد أبحاث مسجلة بعد"}
- إجمالي عناصر الذاكرة في السيرفر: ${profile.totalMemoriesCount}
- مستوى الألفة والتعارف: ${profile.familiarityScore}/10 (بيانات حقيقية على خادم Turso)
`;

      return {
        success: true,
        tool: "get_user_profile",
        data: { profile, rawMemoriesCount: allMemories.length },
        contextNote: profileSummary,
        error: null,
      };
    } catch (err: any) {
      return {
        success: false,
        tool: "get_user_profile",
        data: null,
        error: { code: "PROFILE_ERROR", message: err?.message || "فشل قراءة ملف المستخدم", retryable: false },
      };
    }
  },
};
