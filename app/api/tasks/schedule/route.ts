import { NextRequest, NextResponse } from "next/server";
import { ScheduledTaskRepository } from "@/lib/db";
import { requireAuth } from "@/lib/auth/serverAuth";
import { checkRateLimit } from "@/lib/security/rateLimiter";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const { user } = authResult;

    const status = req.nextUrl.searchParams.get("status") || undefined;
    const tasks = await ScheduledTaskRepository.listTasksByUser(user.id, status, 50);
    return NextResponse.json({ success: true, tasks });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to list tasks" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const { user } = authResult;

    // Rate limit task creation (20 per minute)
    const rateCheck = checkRateLimit(`tasks_create_${user.id}`, 20, 20);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: "تم تجاوز حد إنشاء المهام المجدولة، يرجى المحاولة لاحقاً" },
        { status: 429 }
      );
    }

    const body = await req.json();

    if (!body.title || !body.targetTimestamp) {
      return NextResponse.json(
        { success: false, error: "العنوان وتوقيت التنفيذ المستهدف مطلوبان" },
        { status: 400 }
      );
    }

    const task = await ScheduledTaskRepository.createTask({
      id: body.id,
      userId: user.id, // Strictly bind to authenticated user
      chatId: body.chatId,
      channel: body.channel || "web",
      title: body.title,
      type: body.type || "reminder",
      prompt: body.prompt || body.title,
      payload: body.payload || {},
      targetTimestamp: Number(body.targetTimestamp),
      targetDateIso: body.targetDateIso || new Date(Number(body.targetTimestamp)).toISOString(),
      recurrence: body.recurrence || "once",
      autoExecute: body.autoExecute !== false,
    });

    return NextResponse.json({ success: true, task });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create scheduled task" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const { user } = authResult;

    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ success: false, error: "معرف المهمة مطلوب" }, { status: 400 });
    }

    // Verify task existence and ownership (Anti-IDOR)
    const existing = await ScheduledTaskRepository.getTaskById(body.id);
    if (!existing || (existing.userId !== user.id && user.role !== "admin" && user.role !== "super_admin")) {
      return NextResponse.json(
        { success: false, error: "المهمة غير موجودة أو لا تملك صلاحية تعديلها" },
        { status: 404 }
      );
    }

    if (body.action === "run_now") {
      const { ServerTaskRunner } = await import("@/lib/scheduler/serverTaskRunner");
      const result = await ServerTaskRunner.executeSingleTaskById(body.id);
      return NextResponse.json({ success: true, result });
    }

    if (body.action === "snooze") {
      const minutes = body.minutes || 15;
      const nextTime = Date.now() + minutes * 60 * 1000;
      await ScheduledTaskRepository.rescheduleRecurringTask(body.id, nextTime, new Date(nextTime).toISOString());
      return NextResponse.json({ success: true, targetTimestamp: nextTime });
    }

    if (body.status) {
      await ScheduledTaskRepository.updateTaskStatus(body.id, body.status, body.executionResult, body.failureReason);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const { user } = authResult;

    const taskId = req.nextUrl.searchParams.get("id");
    if (!taskId) {
      return NextResponse.json({ success: false, error: "معرف المهمة مطلوب" }, { status: 400 });
    }

    // Verify task existence and ownership (Anti-IDOR)
    const existing = await ScheduledTaskRepository.getTaskById(taskId);
    if (!existing || (existing.userId !== user.id && user.role !== "admin" && user.role !== "super_admin")) {
      return NextResponse.json(
        { success: false, error: "المهمة غير موجودة أو لا تملك صلاحية حذفها" },
        { status: 404 }
      );
    }

    await ScheduledTaskRepository.deleteTask(taskId);
    return NextResponse.json({ success: true, message: "تم حذف المهمة المجدولة بنجاح" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete task" },
      { status: 500 }
    );
  }
}
