/**
 * /api/v1/users/me/devices
 * 
 * Multi-Device Management API:
 * GET: Lists all registered devices for the authenticated user.
 * POST: Registers or heartbeats the current client device.
 * DELETE: Revokes all devices except the current device (remote logout).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb, UserRepository } from "@/lib/db";
import { userDevices, userSessions } from "@/lib/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { toIsoDateString } from "@/lib/utils";
import { extractClientIp, parseDeviceDetails } from "@/lib/auth/deviceParser";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const currentDeviceId = req.headers.get("x-device-id");

    const db = await getReadyDb();
    const rows = await db
      .select()
      .from(userDevices)
      .where(eq(userDevices.userId, user.id))
      .orderBy(desc(userDevices.lastSeenAt));

    return NextResponse.json({
      success: true,
      devices: rows.map((d) => ({
        id: d.id,
        name: d.name,
        deviceType: d.deviceType,
        browser: d.browser,
        os: d.os,
        ipAddress: d.ipAddress,
        status: d.status,
        isCurrent: d.id === currentDeviceId,
        lastSeenAt: toIsoDateString(d.lastSeenAt),
        createdAt: toIsoDateString(d.createdAt),
      })),
    });
  } catch (error: any) {
    console.error("[Devices GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "DEVICES_FETCH_ERROR", message: "فشل استرداد قائمة الأجهزة" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const body = await req.json().catch(() => ({}));
    const userAgent = req.headers.get("user-agent") || "Unknown Device";
    const ip = extractClientIp(req.headers);
    const parsed = parseDeviceDetails(userAgent, ip);
    const now = new Date();

    const deviceId = body.deviceId || `dev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const name = body.name || parsed.name;
    const deviceType = body.deviceType || parsed.deviceType;
    const browser = body.browser || parsed.browser;
    const os = body.os || parsed.os;

    const db = await getReadyDb();
    await UserRepository.upsertUser({
      id: user.id,
      email: user.email,
      displayName: user.name || undefined,
    });

    const existing = await db
      .select()
      .from(userDevices)
      .where(and(eq(userDevices.userId, user.id), eq(userDevices.id, deviceId)))
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      // If previously revoked, check if re-registration is allowed or block
      await db
        .update(userDevices)
        .set({
          name: name || existing.name,
          deviceType: deviceType || existing.deviceType,
          browser: browser || existing.browser,
          os: os || existing.os,
          lastSeenAt: now,
          ipAddress: ip,
          status: "active",
          updatedAt: now,
        })
        .where(eq(userDevices.id, existing.id));
    } else {
      await db.insert(userDevices).values({
        id: deviceId,
        userId: user.id,
        name,
        deviceType,
        browser,
        os,
        ipAddress: ip,
        status: "active",
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    await recordSyncEvent({
      userId: user.id,
      entityType: "device",
      entityId: deviceId,
      operation: existing ? "updated" : "created",
      payload: { deviceId, name, status: "active" },
    });

    return NextResponse.json({
      success: true,
      device: {
        id: deviceId,
        name,
        deviceType,
        browser,
        os,
        status: "active",
        lastSeenAt: now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Device Register POST Error]:", error);
    return NextResponse.json(
      { success: false, code: "DEVICE_REGISTER_ERROR", message: "فشل تسجيل الجهاز" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const currentDeviceId = req.headers.get("x-device-id");

    if (!currentDeviceId) {
      return NextResponse.json(
        { success: false, code: "DEVICE_ID_REQUIRED", message: "معرف الجهاز الحالي مطلوب في ترويسة x-device-id" },
        { status: 400 }
      );
    }

    const db = await getReadyDb();

    // Revoke all other devices and invalidate sessions atomically
    await db.transaction(async (tx) => {
      await tx
        .update(userDevices)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(and(eq(userDevices.userId, user.id), ne(userDevices.id, currentDeviceId)));

      await tx
        .delete(userSessions)
        .where(eq(userSessions.userId, user.id));
    });

    // Broadcast sync event to notify all connected clients
    await recordSyncEvent({
      userId: user.id,
      entityType: "device",
      entityId: "all_others",
      operation: "deleted",
      payload: { action: "revoke_all_others", currentDeviceId },
    });

    return NextResponse.json({
      success: true,
      message: "تم تسجيل الخروج وإلغاء صلاحية كافة الأجهزة الأخرى بنجاح",
    });
  } catch (error: any) {
    console.error("[Devices Bulk Revoke Error]:", error);
    return NextResponse.json(
      { success: false, code: "REVOKE_ERROR", message: "فشل إلغاء صلاحيات الأجهزة الأخرى" },
      { status: 500 }
    );
  }
}
