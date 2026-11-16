/**
 * POST /api/v1/agent/run
 *
 * Initiates an asynchronous (background WorkerQueue/Engine) or synchronous SoufAI Agent Engine run.
 */

import { NextRequest, NextResponse } from "next/server";
import { SoufAIEngine } from "@/lib/agent/engine/soufAIEngine";
import { AgentRepository } from "@/lib/db";
import { resolveAuthUser } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      return NextResponse.json(
        { error: "يجب عليك تسجيل الدخول أولاً لتشغيل الوكيل الذكي.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const { prompt, projectId, modelId, budgetTier, maxSteps, async: runInBackground } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "prompt string is required." },
        { status: 400 }
      );
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (runInBackground === true) {
      await AgentRepository.createTask({
        id: taskId,
        userId,
        projectId: projectId || "p_default",
        goal: prompt,
        category: "full_engineering",
        status: "queued",
        budgetTier: budgetTier || "auto",
        maxSteps: maxSteps || 8,
      });

      void SoufAIEngine.run({
        userPrompt: prompt,
        userId,
        projectId: projectId || "p_default",
        modelId,
        budgetTier,
        maxSteps: maxSteps || 8,
        taskId,
      }).catch((err) => {
        console.error(`[Agent Run Background] Task ${taskId} failed:`, err);
      });

      return NextResponse.json(
        {
          success: true,
          taskId,
          status: "queued",
          message: "تم وضع المهمة في طابور التنفيذ الخلفي بنجاح",
        },
        { status: 202 }
      );
    }

    // Synchronous execution preserving full JSON contract
    const result = await SoufAIEngine.run({
      userPrompt: prompt,
      userId,
      projectId: projectId || "p_default",
      modelId,
      budgetTier,
      maxSteps: maxSteps || 8,
      taskId,
    });

    return NextResponse.json({
      success: result.status === "completed",
      taskId: result.taskId,
      status: result.status,
      summary: result.summary,
      finalResponse: result.finalResponse,
      qualityReport: result.qualityReport,
      visionEvaluation: result.visionEvaluation,
      filesChanged: result.filesChanged,
      previewUrl: result.previewUrl,
      durationMs: result.totalDurationMs,
      stepsExecuted: result.stepsExecuted,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal Agent Engine failure." },
      { status: 500 }
    );
  }
}
