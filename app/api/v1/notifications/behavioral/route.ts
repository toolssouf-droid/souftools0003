/**
 * /api/v1/notifications/behavioral
 * 
 * GET: Retrieves contextual behavioral suggestions, optimal timing, and encyclopedic sparks.
 * POST: Triggers smart behavioral notification evaluation or registers interaction feedback for Bandit training.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { behavioralNotificationEngine } from "@/lib/notifications/behavioralNotificationEngine";
import { ENCYCLOPEDIC_KNOWLEDGE_BASE } from "@/lib/notifications/encyclopediaKnowledge";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "suggestion";

    if (mode === "metrics") {
      // Diagnostic metrics
      return NextResponse.json({
        success: true,
        metrics: behavioralNotificationEngine.getEngineMetrics(),
      });
    }

    if (mode === "sparks") {
      // Return curated encyclopedic sparks
      return NextResponse.json({
        success: true,
        sparks: ENCYCLOPEDIC_KNOWLEDGE_BASE,
      });
    }

    // Contextual evaluation for current user
    const context = {
      userId: user.id,
      email: user.email,
      lastActiveTimestamp: Date.now(),
      userPreferredLanguage: "ar" as const,
    };

    const foggEvaluation = behavioralNotificationEngine.evaluateFoggThreshold(context);
    const optimalFraming = behavioralNotificationEngine.selectOptimalFraming();
    const suggestedPrompt = behavioralNotificationEngine.generateBehavioralPrompt(context);

    return NextResponse.json({
      success: true,
      data: {
        foggEvaluation,
        optimalFraming,
        currentTimeSlot: behavioralNotificationEngine.getCurrentTimeSlot(),
        suggestedPrompt,
      },
    });
  } catch (error: any) {
    console.error("[Behavioral Notifications GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "BEHAVIORAL_NOTIF_ERROR", message: "فشل استرداد بيانات الإشعارات السلوكية" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const body = await req.json().catch(() => ({}));
    const { action, notificationId, contextData, feedbackAction } = body;

    // 1. Bandit Feedback Registration (Reinforcement Learning loop)
    if (action === "feedback" && notificationId && feedbackAction) {
      behavioralNotificationEngine.registerFeedback(notificationId, feedbackAction);
      return NextResponse.json({
        success: true,
        message: "تم تسجيل استجابة المستخدم وتحديث خوارزمية التعلم التعزيزي بنجاح.",
      });
    }

    // 2. Proactive Evaluation & Dispatch
    if (action === "evaluate_and_dispatch") {
      const evalContext = {
        userId: user.id,
        email: user.email,
        activeConversationTopic: contextData?.topic,
        recentToolsUsed: contextData?.tools,
        unreadEmailsCount: contextData?.unreadEmailsCount,
        openTasksCount: contextData?.openTasksCount,
        lastActiveTimestamp: Date.now(),
        userPreferredLanguage: "ar" as const,
      };

      const fogg = behavioralNotificationEngine.evaluateFoggThreshold(evalContext);
      if (fogg.shouldPrompt) {
        const prompt = behavioralNotificationEngine.generateBehavioralPrompt(evalContext);
        await behavioralNotificationEngine.dispatchNotification(prompt, evalContext);

        return NextResponse.json({
          success: true,
          dispatched: true,
          notification: prompt,
          foggScore: fogg,
        });
      } else {
        return NextResponse.json({
          success: true,
          dispatched: false,
          reason: fogg.reason,
          foggScore: fogg,
        });
      }
    }

    return NextResponse.json(
      { success: false, code: "INVALID_ACTION", message: "إجراء غير صالح" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[Behavioral Notifications POST Error]:", error);
    return NextResponse.json(
      { success: false, code: "BEHAVIORAL_ACTION_ERROR", message: "فشل معالجة الإشعار السلوكي" },
      { status: 500 }
    );
  }
}
