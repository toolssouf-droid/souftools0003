/**
 * SoufAI User Adaptive Learning & Habit Intelligence Engine
 * Autonomously learns user behaviors, active hours, task patterns, and scheduling habits
 * with zero-exposure local-first storage and PostgreSQL database persistence.
 */

import { UserLearningRepository } from "@/lib/db";

export interface LearnedInsight {
  patternType: "time_habit" | "topic_interest" | "tool_affinity" | "communication_style" | "scheduled_routine";
  category: string;
  key: string;
  value: string;
  confidence: number;
  insights?: Record<string, any>;
}

export class AdaptiveLearningEngine {
  /**
   * Learns from a user's incoming interaction or prompt (Web or Telegram)
   */
  public static async analyzeAndLearn(
    userId: string,
    messageText: string,
    source: "web" | "telegram" = "web",
    metadata?: Record<string, any>
  ): Promise<LearnedInsight[]> {
    if (!userId || !messageText || messageText.length < 3) return [];

    const insights: LearnedInsight[] = [];
    const now = new Date();
    const currentHour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday

    // 1. TIME HABIT LEARNING
    let timeHabit = "afternoon_active";
    if (currentHour >= 5 && currentHour < 12) {
      timeHabit = "morning_planner";
      insights.push({
        patternType: "time_habit",
        category: "peak_hours",
        key: "active_morning_period",
        value: "ينشط المستخدم في فترة الصباح الباكر (تخطيط المهام والعمل المكتبي).",
        confidence: 0.75,
        insights: { hour: currentHour, dayOfWeek, source },
      });
    } else if (currentHour >= 12 && currentHour < 18) {
      timeHabit = "afternoon_focused";
      insights.push({
        patternType: "time_habit",
        category: "peak_hours",
        key: "active_afternoon_period",
        value: "ينشط المستخدم في فترة الظهيرة والمساء (تنفيذ المهام والمشاريع).",
        confidence: 0.75,
        insights: { hour: currentHour, dayOfWeek, source },
      });
    } else if (currentHour >= 18 && currentHour < 24) {
      timeHabit = "evening_reviewer";
      insights.push({
        patternType: "time_habit",
        category: "peak_hours",
        key: "active_evening_period",
        value: "ينشط المستخدم في الفترة المسائية (المراجعة والتعلم والتلخيص).",
        confidence: 0.8,
        insights: { hour: currentHour, dayOfWeek, source },
      });
    } else {
      timeHabit = "night_owl";
      insights.push({
        patternType: "time_habit",
        category: "peak_hours",
        key: "active_night_period",
        value: "يعمل المستخدم في أوقات متأخرة ليلاً (البرمجة والتركيز الهادئ).",
        confidence: 0.85,
        insights: { hour: currentHour, dayOfWeek, source },
      });
    }

    // 2. TOPIC & DOMAIN AFFINITY
    const lowerText = messageText.toLowerCase();

    // Coding / Software Development
    if (
      /(كود|برمجة|javascript|typescript|python|react|nextjs|sql|دالة|خطأ|bug|api|خادم|server|docker|github)/i.test(
        lowerText
      )
    ) {
      insights.push({
        patternType: "topic_interest",
        category: "domain",
        key: "interest_software_engineering",
        value: "مهتم بالهندسة البرمجية وتطوير النظم والشيفرات البرمجية بدقة عالية.",
        confidence: 0.85,
      });
    }

    // Business / Productivity / Project Management
    if (
      /(مشروع|خطة|ميزانية|عملاء|تسويق|اجتماع|عقد|تقرير|مبيعات|أهداف|business|kpi|startup)/i.test(
        lowerText
      )
    ) {
      insights.push({
        patternType: "topic_interest",
        category: "domain",
        key: "interest_business_productivity",
        value: "مهتم بإدارة المشاريع والأعمال والإنتاجية والتخطيط الاستراتيجي.",
        confidence: 0.8,
      });
    }

    // Research & News
    if (
      /(بحث|أخبار|أحدث|دراسة|مقال|مصادر|تاريخ|علم|أبحاث|معلومات عن)/i.test(
        lowerText
      )
    ) {
      insights.push({
        patternType: "tool_affinity",
        category: "research",
        key: "affinity_web_research",
        value: "يفضل الاستقصاء والبحث العميق واستخراج المصادر الموثوقة.",
        confidence: 0.8,
      });
    }

    // Scheduling / Task Management
    if (
      /(ذكرني|جدول|موعد|غدا|الأسبوع القادم|كل يوم|تذكير|ساعة|صباحا|مساء|بعد|remind me|schedule)/i.test(
        lowerText
      )
    ) {
      insights.push({
        patternType: "scheduled_routine",
        category: "scheduling",
        key: "habit_proactive_scheduling",
        value: "يعتمد على الجدولة الدقيقة والتذكيرات الآلية لتنظيم وقته.",
        confidence: 0.9,
      });
    }

    // Communication Style Preference (Concise vs Detailed)
    if (/(باختصار|بدون إطالة|موجز|نقاط سريعة|بشكل مختصر)/i.test(lowerText)) {
      insights.push({
        patternType: "communication_style",
        category: "style",
        key: "preference_concise_answers",
        value: "يفضل الإجابات المركزة والمباشرة على شكل نقاط دون حشو.",
        confidence: 0.9,
      });
    } else if (/(بالتفصيل|اشرح لي بعمق|خطوة بخطوة|شرح مفصل|حلل لي)/i.test(lowerText)) {
      insights.push({
        patternType: "communication_style",
        category: "style",
        key: "preference_deep_analysis",
        value: "يفضل الشروحات المعمقة والتحليلات الشاملة خطوة بخطوة.",
        confidence: 0.9,
      });
    }

    // Persist discovered insights to Database
    for (const insight of insights) {
      try {
        await UserLearningRepository.recordPattern(userId, {
          patternType: insight.patternType,
          category: insight.category,
          key: insight.key,
          value: insight.value,
          confidence: insight.confidence,
          insights: insight.insights || metadata || {},
        });
      } catch (err) {
        console.warn("[AdaptiveLearningEngine] failed saving insight:", err);
      }
    }

    return insights;
  }

  /**
   * Generates intelligent, proactive suggestions based on learned user habits
   */
  public static async getProactiveSuggestions(userId: string): Promise<string[]> {
    const patterns = await UserLearningRepository.listPatternsByUser(userId, undefined, 10);
    const now = new Date();
    const hour = now.getHours();

    const suggestions: string[] = [];

    const hasInterestInCode = patterns.some((p: any) => p.key === "interest_software_engineering");
    const hasInterestInBusiness = patterns.some((p: any) => p.key === "interest_business_productivity");
    const hasSchedulingHabit = patterns.some((p: any) => p.key === "habit_proactive_scheduling");

    if (hour >= 7 && hour < 11) {
      suggestions.push("☀️ هل تود تلخيص أهم المهام والجدول المخطط لليوم؟");
      if (hasInterestInBusiness) {
        suggestions.push("📊 كتابة خطة عمل سريعة أو مراجعة أولويات اليوم.");
      }
    } else if (hour >= 20 || hour < 3) {
      if (hasInterestInCode) {
        suggestions.push("💻 هل تحتاج لمراجعة كود أو تصحيح دالة برمجية هادئة الآن؟");
      }
      suggestions.push("🌙 هل تود جدولة تذكير لأول مهمة ليوم غد؟");
    }

    if (hasSchedulingHabit && suggestions.length < 3) {
      suggestions.push("⏰ يمكنك القول: «ذكرني غداً الساعة 9 بإرسال التقرير» وسأتكفل بذلك.");
    }

    return suggestions;
  }
}
