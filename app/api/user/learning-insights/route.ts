import { NextRequest, NextResponse } from "next/server";
import { UserLearningRepository } from "@/lib/db";
import { AdaptiveLearningEngine } from "@/lib/learning/adaptiveLearningEngine";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const patterns = await UserLearningRepository.listPatternsByUser(userId, undefined, 30);
    const suggestions = await AdaptiveLearningEngine.getProactiveSuggestions(userId);
    const summary = await UserLearningRepository.getUserHabitSummary(userId);

    return NextResponse.json({
      success: true,
      userId,
      patterns,
      suggestions,
      summary,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch learning insights" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const userId = authResult.user.id;

  try {
    const body = await req.json().catch(() => ({}));
    const text = body.text || "";

    if (!text) {
      return NextResponse.json({ success: false, error: "النص مطلوب" }, { status: 400 });
    }

    const insights = await AdaptiveLearningEngine.analyzeAndLearn(userId, text, body.source || "web");
    return NextResponse.json({ success: true, insights });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record learning insight" },
      { status: 500 }
    );
  }
}
