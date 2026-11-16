/**
 * /api/v1/users/me/devices/[id]
 * 
 * DELETE: Revokes access for a specific device with strict IDOR ownership verification.
 * PATCH: Renames device.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb } from "@/lib/db";
import { userDevices, userSessions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { recordSyncEvent } from "@/lib/sync/syncEngine";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const { id: deviceId } = await params;

    const db = await getReadyDb();

    // Strict ownership verification to eliminate IDOR vulnerabilities
    const targetDevice = await db
      .select()
      .from(userDevices)
      .where(and(eq(userDevices.id, deviceId), eq(userDevices.userId, user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!targetDevice) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "الجهاز غير موجود أو لا تملك صلاحية الوصول إليه" },
        { status: 404 }
      );
    }

    await db.transaction(async (tx) => {
      await tx
        .update(userDevices)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(and(eq(userDevices.id, deviceId), eq(userDevices.userId, user.id)));

      if (targetDevice.sessionId) {
        await tx
          .delete(userSessions)
          .where(and(eq(userSessions.id, targetDevice.sessionId), eq(userSessions.userId, user.id)));
      }
    });

    // Dispatch real-time sync event
    await recordSyncEvent({
      userId: user.id,
      entityType: "device",
      entityId: deviceId,
      operation: "updated",
      payload: { id: deviceId, status: "revoked" },
    });

    return NextResponse.json({
      success: true,
      message: "تم إلغاء ترخيص الجهاز بنجاح",
      revokedDeviceId: deviceId,
    });
  } catch (error: any) {
    console.error("[Device Revoke DELETE Error]:", error);
    return NextResponse.json(
      { success: false, code: "REVOKE_FAILED", message: "فشل إلغاء ترخيص الجهاز" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const { id: deviceId } = await params;
    const body = await req.json().catch(() => ({}));

    const db = await getReadyDb();

    const targetDevice = await db
      .select()
      .from(userDevices)
      .where(and(eq(userDevices.id, deviceId), eq(userDevices.userId, user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!targetDevice) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "الجهاز غير موجود" },
        { status: 404 }
      );
    }

    const updated = await db
      .update(userDevices)
      .set({
        name: body.name || targetDevice.name,
        deviceType: body.deviceType || targetDevice.deviceType,
        updatedAt: new Date(),
      })
      .where(and(eq(userDevices.id, deviceId), eq(userDevices.userId, user.id)))
      .returning()
      .then((r) => r[0]);

    return NextResponse.json({
      success: true,
      device: updated,
    });
  } catch (error: any) {
    console.error("[Device Rename PATCH Error]:", error);
    return NextResponse.json(
      { success: false, code: "UPDATE_FAILED", message: "فشل تحديث بيانات الجهاز" },
      { status: 500 }
    );
  }
}
