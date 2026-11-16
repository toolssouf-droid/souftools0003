/**
 * /api/v1/users/me
 * 
 * GET: Returns current authenticated user profile, quota, and storage stats.
 * DELETE: Permanently purges user account and cascades through Turso data.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb } from "@/lib/db";
import { users, agentTasks, workerJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeToIsoDate } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;

    const db = await getReadyDb();
    const dbUser = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
      .then((r) => r[0]);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: dbUser?.name || user.name,
        role: user.role,
        storageUsedBytes: dbUser?.storageUsedBytes || user.storageUsedBytes,
        storageLimitBytes: dbUser?.storageLimitBytes || user.storageLimitBytes,
        createdAt: safeToIsoDate(dbUser?.createdAt),
      },
    });
  } catch (error: any) {
    console.error("[Users Me GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "USER_FETCH_ERROR", message: "فشل استرداد بيانات المستخدم" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;

    const db = await getReadyDb();

    // Delete user and non-FK-cascaded worker/agent records atomically in Turso
    await db.transaction(async (tx) => {
      await tx.delete(workerJobs).where(eq(workerJobs.userId, user.id));
      await tx.delete(agentTasks).where(eq(agentTasks.userId, user.id));
      await tx.delete(users).where(eq(users.id, user.id));
    });

    return NextResponse.json({
      success: true,
      message: "تم حذف الحساب وجميع البيانات السحابية المرتبطة به نهائياً",
    });
  } catch (error: any) {
    console.error("[Users Me DELETE Error]:", error);
    return NextResponse.json(
      { success: false, code: "USER_DELETE_ERROR", message: "فشل حذف الحساب" },
      { status: 500 }
    );
  }
}
