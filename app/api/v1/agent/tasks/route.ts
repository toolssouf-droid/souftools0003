/**
 * GET /api/v1/agent/tasks
 * 
 * Lists recent tasks and agent runs for the current user.
 */

import { NextRequest, NextResponse } from "next/server";
import { AgentRepository } from "@/lib/db";
import { resolveAuthUser } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const user = await resolveAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
  }

  const tasks = await AgentRepository.listUserTasks(user.id, 30);
  return NextResponse.json({ tasks });
}
