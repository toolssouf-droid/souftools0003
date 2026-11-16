/**
 * SoufAI Agent Engine - Stop Task Route
 *
 * Safely halts an ongoing agent task owned by the caller, terminates active child processes,
 * updates the Turso task state, and releases leases.
 */

import { NextRequest, NextResponse } from "next/server";
import { SoufAIEngine } from "@/lib/agent/engine/soufAIEngine";
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
    const result = await SoufAIEngine.stopTask(taskId, ownerFilter);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: error.message || "Failed to stop task" } },
      { status: 500 }
    );
  }
}
