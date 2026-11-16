// app/api/v1/models/recommend/route.ts
import { NextRequest, NextResponse } from "next/server";
import { recommendModelForTask, getModelById } from "@/lib/models/modelRegistry";

/**
 * POST /api/v1/models/recommend
 * Analyzes a user's task or prompt and intelligently recommends the optimal model
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const task = body.task || body.prompt || "";

    if (!task || typeof task !== "string" || task.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Task text is required for recommendation",
        },
        { status: 400 }
      );
    }

    const recommendation = recommendModelForTask(task);
    const recommendedModel = getModelById(recommendation.recommendedId);
    const alternativeModel = recommendation.alternativeId ? getModelById(recommendation.alternativeId) : null;

    return NextResponse.json({
      success: true,
      task: task.trim(),
      detectedTaskType: recommendation.detectedTaskType,
      confidence: recommendation.confidence,
      recommended: {
        model_id: recommendation.recommendedId,
        display_name: recommendedModel?.display_name || recommendation.recommendedId,
        badgeAr: recommendedModel?.identity.badgeAr,
        badgeEn: recommendedModel?.identity.badgeEn,
        accentColor: recommendedModel?.identity.accentColor,
        reasonsAr: recommendation.reasonsAr,
        reasonsEn: recommendation.reasonsEn,
        contextWindow: recommendedModel?.capabilities.context_window_label,
      },
      alternative: alternativeModel
        ? {
            model_id: alternativeModel.model_id,
            display_name: alternativeModel.display_name,
            accentColor: alternativeModel.identity.accentColor,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Error in /api/v1/models/recommend:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to compute model recommendation",
        message: error?.message,
      },
      { status: 500 }
    );
  }
}
