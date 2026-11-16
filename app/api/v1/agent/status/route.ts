/**
 * GET /api/v1/agent/status?taskId=xyz
 *
 * Returns snapshot status, current subtasks, latest checkpoint, and events for a task (user-isolated).
 */

import { NextRequest, NextResponse } from "next/server";
import { AgentRepository } from "@/lib/db";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const ownerFilter = user.role === "super_admin" ? undefined : user.id;
  const task = await AgentRepository.getTask(taskId, ownerFilter);

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const [subtasks, events, latestCheckpoint] = await Promise.all([
    AgentRepository.getSubtasksByTaskId(taskId),
    AgentRepository.getEventsByTaskId(taskId, 100),
    AgentRepository.getLatestCheckpoint(taskId),
  ]);

  return NextResponse.json({
    task,
    subtasks,
    events,
    latestCheckpoint,
  });
}
