/**
 * SoufAI Behavioral AI Notification Engine
 * 
 * Powered by:
 * 1. BJ Fogg Behavioral Model (B = MAP: Motivation, Ability, Prompt)
 * 2. Zeigarnik Effect (Open loop & project closure prompts)
 * 3. Contextual Multi-Armed Bandit (CMAB) with Thompson Sampling for Timing & Framing
 * 4. Encyclopedic Cognitive Sparks Integration
 * 5. Multi-channel dispatch (In-App + Web Push + Telegram Gateway)
 */

import { ENCYCLOPEDIC_KNOWLEDGE_BASE, KnowledgeSpark } from "./encyclopediaKnowledge";
import { telegramManager } from "@/lib/telegram/telegramManager";
import { NotificationRepository } from "@/lib/db";
import { recordSyncEvent } from "@/lib/sync/syncEngine";

export type PsychologicalFraming =
  | "curiosity_spark"            // إثارة الفضول المعرفي
  | "momentum_preservation"      // الحفاظ على الزخم وسلسلة الإنجاز
  | "proactive_assistance"       // مساعدة استباقية ذكية
  | "cognitive_ease"             // تسهيل الخطوة القادمة بنقرة واحدة
  | "insight_reflection";        // تلخيص واستبصار الأداء

export type NotificationChannel = "in_app" | "browser_push" | "telegram" | "omnichannel";

export interface BehavioralEvaluationContext {
  userId: string;
  email?: string;
  telegramChatId?: string;
  activeConversationTopic?: string;
  recentToolsUsed?: string[];
  unreadEmailsCount?: number;
  openTasksCount?: number;
  lastActiveTimestamp?: number;
  userPreferredLanguage?: "ar" | "en";
}

export interface GeneratedBehavioralNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  framing: PsychologicalFraming;
  channel: NotificationChannel;
  foggScore: {
    motivation: number;
    ability: number;
    promptViability: number;
    overallScore: number;
  };
  spark?: KnowledgeSpark;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: number;
  status: "generated" | "dispatched" | "delivered" | "clicked" | "dismissed";
}

export interface BanditArmState {
  armId: string;
  framing: PsychologicalFraming;
  timeSlot: "morning" | "afternoon" | "evening" | "night";
  alpha: number; // Successes + 1 (for Beta distribution)
  beta: number;  // Failures + 1 (for Beta distribution)
  totalImpressions: number;
  totalEngagements: number;
}

class BehavioralNotificationEngine {
  private banditArms: Map<string, BanditArmState> = new Map();
  private userFatigueMap: Map<string, { lastSentAt: number; consecutiveIgnored: number }> = new Map();
  private historyLogs: GeneratedBehavioralNotification[] = [];

  constructor() {
    this.initializeBanditArms();
  }

  /**
   * Initialize Thompson Sampling Bandit arms across Framings and Time Slots
   */
  private initializeBanditArms() {
    const framings: PsychologicalFraming[] = [
      "curiosity_spark",
      "momentum_preservation",
      "proactive_assistance",
      "cognitive_ease",
      "insight_reflection",
    ];

    const timeSlots: Array<"morning" | "afternoon" | "evening" | "night"> = [
      "morning",
      "afternoon",
      "evening",
      "night",
    ];

    for (const framing of framings) {
      for (const slot of timeSlots) {
        const armId = `${framing}_${slot}`;
        this.banditArms.set(armId, {
          armId,
          framing,
          timeSlot: slot,
          alpha: 2, // Prior belief
          beta: 2,  // Prior belief
          totalImpressions: 0,
          totalEngagements: 0,
        });
      }
    }
  }

  /**
   * Determine current temporal slot
   */
  public getCurrentTimeSlot(): "morning" | "afternoon" | "evening" | "night" {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 23) return "evening";
    return "night";
  }

  /**
   * Thompson Sampling: Sample from Beta(alpha, beta) distribution
   */
  private sampleBeta(alpha: number, beta: number): number {
    // Standard Marsaglia and Tsang approximation for Gamma / Beta sampling
    const u1 = Math.random();
    const u2 = Math.random();
    // Simplified robust pseudo-beta draw for low computational overhead
    const val = (alpha / (alpha + beta)) + (Math.sqrt((alpha * beta) / (Math.pow(alpha + beta, 2) * (alpha + beta + 1))) * (u1 - 0.5) * 1.5);
    return Math.max(0.001, Math.min(0.999, val));
  }

  /**
   * Select optimal psychological framing using Contextual Multi-Armed Bandit
   */
  public selectOptimalFraming(timeSlot = this.getCurrentTimeSlot()): PsychologicalFraming {
    let bestArm: BanditArmState | null = null;
    let highestSample = -1;

    for (const arm of this.banditArms.values()) {
      if (arm.timeSlot === timeSlot) {
        const sample = this.sampleBeta(arm.alpha, arm.beta);
        if (sample > highestSample) {
          highestSample = sample;
          bestArm = arm;
        }
      }
    }

    return bestArm?.framing || "proactive_assistance";
  }

  /**
   * BJ Fogg Model ($B=MAP$) Evaluation
   * Evaluates if sending a notification right now will cross the action activation line.
   */
  public evaluateFoggThreshold(context: BehavioralEvaluationContext): {
    shouldPrompt: boolean;
    motivation: number;
    ability: number;
    promptViability: number;
    overallScore: number;
    reason: string;
  } {
    const timeSlot = this.getCurrentTimeSlot();

    // 1. Fatigue & Cooldown Check
    const fatigue = this.userFatigueMap.get(context.userId) || { lastSentAt: 0, consecutiveIgnored: 0 };
    const now = Date.now();
    const minCooldownHours = fatigue.consecutiveIgnored > 2 ? 12 : 3;
    const cooldownMs = minCooldownHours * 60 * 60 * 1000;

    if (now - fatigue.lastSentAt < cooldownMs && fatigue.consecutiveIgnored > 0) {
      return {
        shouldPrompt: false,
        motivation: 0.2,
        ability: 0.5,
        promptViability: 0.1,
        overallScore: 0.15,
        reason: "User in cooldown period to prevent notification fatigue (Anti-Fatigue Guard).",
      };
    }

    // 2. Compute Motivation (M) (0.0 to 1.0)
    let motivation = 0.5;
    if (context.unreadEmailsCount && context.unreadEmailsCount > 0) motivation += 0.25;
    if (context.openTasksCount && context.openTasksCount > 0) motivation += 0.2;
    if (context.activeConversationTopic) motivation += 0.15;
    motivation = Math.min(1.0, motivation);

    // 3. Compute Ability (A) (0.0 to 1.0 - Higher means easier to take action)
    let ability = 0.85; // SoufTools provides 1-click execution
    if (timeSlot === "night") ability = 0.35; // Late night = lower immediate ability to work
    if (timeSlot === "morning") ability = 0.90; // High energy focus window

    // 4. Compute Prompt Viability (P)
    const promptViability = timeSlot === "night" ? 0.2 : 0.88;

    // BJ Fogg Activation Threshold curve: M * A > threshold
    const overallScore = (motivation * 0.45) + (ability * 0.35) + (promptViability * 0.20);
    const activationLine = 0.55;

    const shouldPrompt = overallScore >= activationLine && timeSlot !== "night";

    return {
      shouldPrompt,
      motivation,
      ability,
      promptViability,
      overallScore: parseFloat(overallScore.toFixed(3)),
      reason: shouldPrompt
        ? "Fogg behavioral threshold passed. Optimal cognitive state for engagement."
        : "Below activation threshold or in quiet focus hours.",
    };
  }

  /**
   * Find most relevant encyclopedic knowledge spark based on user context
   */
  public matchKnowledgeSpark(context: BehavioralEvaluationContext): KnowledgeSpark {
    const topic = (context.activeConversationTopic || "").toLowerCase();
    const tools = (context.recentToolsUsed || []).join(" ").toLowerCase();
    const combined = `${topic} ${tools}`;

    for (const spark of ENCYCLOPEDIC_KNOWLEDGE_BASE) {
      const match = spark.triggerContexts.some((kw) => combined.includes(kw.toLowerCase()));
      if (match) return spark;
    }

    // Default to a random high-value spark
    const randomIndex = Math.floor(Math.random() * ENCYCLOPEDIC_KNOWLEDGE_BASE.length);
    return ENCYCLOPEDIC_KNOWLEDGE_BASE[randomIndex];
  }

  /**
   * Synthesize a contextual, psychologically tuned notification
   */
  public generateBehavioralPrompt(context: BehavioralEvaluationContext): GeneratedBehavioralNotification {
    const fogg = this.evaluateFoggThreshold(context);
    const framing = this.selectOptimalFraming();
    const spark = this.matchKnowledgeSpark(context);

    const notifId = `b-notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let title = "إشعار ذكي من SoufAI";
    let message = spark.summary;
    let actionLabel = "استكشاف وتطبيق";
    let actionUrl = "/ar/launch";

    switch (framing) {
      case "curiosity_spark":
        title = `💡 ومضة معرفية: ${spark.title}`;
        message = `${spark.summary}\n\n📌 ${spark.actionableTakeaway}`;
        actionLabel = "قراءة المزيد وتحليل الفكرة";
        actionUrl = "/ar/chat";
        break;

      case "momentum_preservation":
        title = "⚡ حافظ على زخم إنتاجيتك الذكي";
        message = context.openTasksCount && context.openTasksCount > 0
          ? `لديك ${context.openTasksCount} مهام قيد الإنجاز! إكمال خطوة واحدة الآن يستغل تأثير زايجارنيك لإغلاق الحلقة بكفاءة.`
          : `استمرارك اليومي في استخدام أدوات الذكاء الاصطناعي يعزز سرعة إنجازك. ما هي فكرتك القادمة؟`;
        actionLabel = "متابعة العمل الآن";
        actionUrl = "/ar/launch";
        break;

      case "proactive_assistance":
        if (context.unreadEmailsCount && context.unreadEmailsCount > 0) {
          title = `📧 لديك ${context.unreadEmailsCount} رسائل جديدة في بريدك`;
          message = "هل ترغب في أن يلخص لك SoufAI أهم الرسائل الواردة وصياغة ردود فورية مقترحة؟";
          actionLabel = "فحص وتلخيص البريد";
          actionUrl = "/ar/chat?prompt=افحص+البريد+الإلكتروني+ولخص+أهم+الرسائل";
        } else {
          title = "✨ اقتراح ذكي لمشروعك الحالي";
          message = `استناداً إلى اهتمامك الأخير: "${spark.title}"، يمكنك توليد حلول أو تحليل أعمق بضغطة زر.`;
          actionLabel = "تطبيق الفكرة مع الـ AI";
          actionUrl = "/ar/chat";
        }
        break;

      case "cognitive_ease":
        title = "🚀 خطوة واحدة بسيطة للإنجاز";
        message = `${spark.actionableTakeaway}\n\nجاهز للبدء؟ كل الأدوات مهيأة لمساعدتك فوراً.`;
        actionLabel = "بدء محادثة ذكية";
        actionUrl = "/ar/chat";
        break;

      case "insight_reflection":
        title = "🧠 استبصار معرفي وتطوير الأداء";
        message = `مبدأ اليوم في النظم: ${spark.title}.\n${spark.actionableTakeaway}`;
        actionLabel = "مناقشة الفكرة";
        actionUrl = "/ar/chat";
        break;
    }

    const notification: GeneratedBehavioralNotification = {
      id: notifId,
      userId: context.userId,
      title,
      message,
      framing,
      channel: "omnichannel",
      foggScore: {
        motivation: fogg.motivation,
        ability: fogg.ability,
        promptViability: fogg.promptViability,
        overallScore: fogg.overallScore,
      },
      spark,
      actionUrl,
      actionLabel,
      createdAt: Date.now(),
      status: "generated",
    };

    this.historyLogs.unshift(notification);
    if (this.historyLogs.length > 100) this.historyLogs.pop();

    return notification;
  }

  /**
   * Dispatch notification across In-App, DB, and Telegram Gateway
   */
  public async dispatchNotification(notification: GeneratedBehavioralNotification, context: BehavioralEvaluationContext) {
    try {
      // 1. Save to Turso Database for In-App Center
      await NotificationRepository.createNotification({
        id: notification.id,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: "info",
        metadata: {
          framing: notification.framing,
          foggScore: notification.foggScore,
          actionUrl: notification.actionUrl,
          actionLabel: notification.actionLabel,
          sparkId: notification.spark?.id,
        },
      }).catch((err) => console.warn("[Behavioral Engine DB Insert]", err));

      // 2. Record sync event for client realtime updates
      await recordSyncEvent({
        userId: notification.userId,
        entityType: "notification",
        entityId: notification.id,
        operation: "created",
        payload: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          actionUrl: notification.actionUrl,
        },
      }).catch(() => null);

      // 3. Dispatch to Telegram Gateway if Chat ID is known
      const tgChatId = context.telegramChatId || telegramManager.resolveChatIdFromKey(context.userId);
      if (tgChatId && /^\d+$/.test(tgChatId)) {
        const tgMessage = `🔔 **${notification.title}**\n\n${notification.message}\n\n🚀 [اضغط هنا للمتابعة في منصة SoufAI](${telegramManager.getBaseUrl()}${notification.actionUrl || "/ar/launch"})`;
        await telegramManager.sendMessage(tgChatId, tgMessage).catch(() => null);
      }

      // 4. Dispatch Web Push Notification (Desktop & Mobile Browser Background Push)
      try {
        const { webPushManager } = await import("@/lib/notifications/webPushManager");
        await webPushManager.sendPushNotification(notification.userId, {
          title: notification.title,
          body: notification.message,
          url: notification.actionUrl || "/ar/chat",
          id: notification.id,
        });
      } catch (pushErr) {
        console.warn("[Behavioral Engine] Web Push dispatch notice:", pushErr);
      }

      // Update fatigue record
      this.userFatigueMap.set(notification.userId, {
        lastSentAt: Date.now(),
        consecutiveIgnored: (this.userFatigueMap.get(notification.userId)?.consecutiveIgnored || 0) + 1,
      });

      notification.status = "delivered";
      return { success: true, notificationId: notification.id };
    } catch (err: any) {
      console.error("[Behavioral Dispatch Error]", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Reward feedback update for Contextual Multi-Armed Bandit
   * Invoked when user clicks, opens, or dismisses a notification.
   */
  public registerFeedback(notificationId: string, action: "click" | "open" | "dismiss" | "ignore") {
    const notif = this.historyLogs.find((n) => n.id === notificationId);
    if (!notif) return;

    const timeSlot = this.getCurrentTimeSlot();
    const armId = `${notif.framing}_${timeSlot}`;
    const arm = this.banditArms.get(armId);

    if (arm) {
      arm.totalImpressions += 1;

      if (action === "click" || action === "open") {
        arm.alpha += 1; // Reward: Increase Beta alpha
        arm.totalEngagements += 1;
        notif.status = "clicked";

        // Reset fatigue counter on positive engagement
        const fatigue = this.userFatigueMap.get(notif.userId);
        if (fatigue) fatigue.consecutiveIgnored = 0;
      } else if (action === "dismiss") {
        arm.beta += 0.5; // Soft penalty
        notif.status = "dismissed";
      } else {
        arm.beta += 0.2; // Soft penalty
      }
    }
  }

  /**
   * Get engine state metrics for diagnostics and admin visibility
   */
  public getEngineMetrics() {
    return {
      activeArmsCount: this.banditArms.size,
      totalDispatched: this.historyLogs.length,
      recentHistory: this.historyLogs.slice(0, 15),
      armsPerformance: Array.from(this.banditArms.values()).map((arm) => ({
        armId: arm.armId,
        framing: arm.framing,
        timeSlot: arm.timeSlot,
        winRate: arm.totalImpressions > 0 ? (arm.totalEngagements / arm.totalImpressions).toFixed(2) : "0.00",
        alpha: arm.alpha,
        beta: arm.beta,
      })),
      knowledgeBaseSize: ENCYCLOPEDIC_KNOWLEDGE_BASE.length,
    };
  }
}

export const behavioralNotificationEngine = new BehavioralNotificationEngine();
