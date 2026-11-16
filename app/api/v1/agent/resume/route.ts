/**
 * SoufAI Agent Engine - Resume Task Route
 *
 * Resumes execution of a paused, failed, or interrupted agent task from its last Turso checkpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { SoufAIEngine } from "@/lib/agent/engine/soufAIEngine";
import { AgentRepository } from "@/lib/db";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const body = await req.json().catch(() => ({}));
    const { taskId } = body;

    if (!taskId || typeof taskId !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "taskId is required" } },
        { status: 400 }
      );
    }

    const ownerFilter = user.role === "super_admin" ? undefined : user.id;
    const task = await AgentRepository.getTask(taskId, ownerFilter);
    if (!task) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Task not found or unauthorized" } },
        { status: 404 }
      );
    }

    // Accept the request without claiming the background worker has acquired its lease yet.
    SoufAIEngine.resumeTask(taskId, ownerFilter).catch((err) => {
      console.error(`[SoufAI Engine] Resume task ${taskId} error:`, err);
    });

    return NextResponse.json({
      success: true,
      taskId,
      status: "accepted",
      checkpointStep: task.checkpointStep || 0,
      message: "تم قبول طلب الاستئناف؛ لم يتم تأكيد بدء التنفيذ بعد.",
    }, { status: 202 });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message || "Failed to resume task" } },
      { status: 500 }
    );
  }
}
