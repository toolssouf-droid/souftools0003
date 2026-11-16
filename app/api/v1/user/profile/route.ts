/**
 * SoufTools User Profile & GDPR API Route
 * Handles user profile, storage quota inspection, asynchronous GDPR data export,
 * and account data purging.
 */

import { NextRequest, NextResponse } from "next/server";
import { UserRepository } from "@/lib/db";
import { WorkerQueue } from "@/lib/queue/workerQueue";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  const dbUser = await UserRepository.getById(user.id);

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: dbUser?.name || null,
      photoUrl: dbUser?.image || null,
      storageUsedBytes: dbUser?.storageUsedBytes || 0,
      storageLimitBytes: dbUser?.storageLimitBytes || 150 * 1024 * 1024,
      storageUsagePercent: Math.min(
        100,
        Math.round(((dbUser?.storageUsedBytes || 0) / (dbUser?.storageLimitBytes || 150 * 1024 * 1024)) * 100)
      ),
    },
  });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "export_gdpr") {
    const jobId = await WorkerQueue.enqueueAsync("export_user_data", { userId: user.id }, { userId: user.id });
    return NextResponse.json({
      success: true,
      message: "تم جدولة طلب تصدير البيانات بنجاح",
      jobId,
    });
  }

  if (action === "purge_account") {
    const jobId = await WorkerQueue.enqueueAsync("purge_user_data", { userId: user.id }, { userId: user.id });
    return NextResponse.json({
      success: true,
      message: "تم جدولة حذف كافة بيانات الحساب والملفات نهائياً",
      jobId,
    });
  }

  return NextResponse.json({ code: "BAD_REQUEST", message: "إجراء غير معروف" }, { status: 400 });
}
