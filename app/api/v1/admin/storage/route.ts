/**
 * SoufTools Admin Storage Management API Route
 * Provides storage usage breakdown (images, videos, docs), and admin sweep utilities.
 */

import { NextRequest, NextResponse } from "next/server";
import { StorageRepository, AuditRepository } from "@/lib/db";
import { WorkerQueue } from "@/lib/queue/workerQueue";
import { requireAdmin } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;

  try {
    const stats = await StorageRepository.getAdminStorageStats();
    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل استرجاع إحصائيات التخزين", error: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  const body = await req.json().catch(() => ({}));
  const action = body.action;

  if (action === "sweep_orphans") {
    const jobId = await WorkerQueue.enqueueAsync("cleanup_orphaned_storage", {}, { userId: user.id });
    await AuditRepository.logAction({
      adminUserId: user.id,
      action: "ADMIN_STORAGE_ORPHAN_SWEEP",
      resourceType: "storage",
      details: { initiatedBy: user.email },
    });

    return NextResponse.json({
      success: true,
      message: "تم بدء تنظيف الكائنات والملفات المؤقتة في الخلفية",
      jobId,
    });
  }

  return NextResponse.json({ code: "BAD_REQUEST", message: "إجراء غير معروف" }, { status: 400 });
}
