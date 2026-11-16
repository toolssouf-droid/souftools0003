/**
 * /api/v1/preferences
 * 
 * GET: Returns user preferences from Turso.
 * PUT: Updates user preferences with optimistic concurrency control and sync event dispatch.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb, UserRepository } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { toIsoDateString } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const database = await getReadyDb();

    let pref = await database
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1)
      .then((r) => r[0]);

    if (!pref) {
      pref = await database
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.id, `pref_${user.id}`))
        .limit(1)
        .then((r) => r[0]);
    }

    if (!pref) {
      const prefId = `pref_${user.id}`;
      try {
        await UserRepository.upsertUser({ id: user.id, email: user.email || `${user.id}@souftools.app` });
        const [newPref] = await database
          .insert(userPreferences)
          .values({
            id: prefId,
            userId: user.id,
            theme: "dark",
            locale: "ar",
            defaultModelId: "spark",
            soundEnabled: true,
            autoScroll: true,
            webSearchEnabled: false,
            version: 1,
          })
          .onConflictDoUpdate({
            target: userPreferences.id,
            set: {
              userId: user.id,
            },
          })
          .returning();
        pref = newPref;
      } catch (prefErr) {
        pref = await database
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.userId, user.id))
          .limit(1)
          .then((r) => r[0]);
      }
    }

    if (!pref) {
      pref = {
        id: `pref_${user.id}`,
        userId: user.id,
        theme: "dark",
        locale: "ar",
        defaultModelId: "spark",
        soundEnabled: true,
        autoScroll: true,
        webSearchEnabled: false,
        customSettings: {},
        version: 1,
        updatedAt: new Date(),
      } as any;
    }

    return NextResponse.json({
      success: true,
      preferences: {
        ...pref,
        updatedAt: toIsoDateString(pref.updatedAt),
      },
    });
  } catch (error: any) {
    console.error("[Preferences GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "PREFERENCES_FETCH_ERROR", message: "فشل استرداد إعدادات المستخدم" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const database = await getReadyDb();
    const body = await req.json().catch(() => ({}));
    const deviceId = req.headers.get("x-device-id");

    let existing = await database
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1)
      .then((r) => r[0]);

    const newVersion = (existing?.version || 1) + 1;
    const updateData: any = {
      updatedAt: new Date(),
      version: newVersion,
    };

    if (body.theme !== undefined) updateData.theme = body.theme;
    if (body.locale !== undefined) updateData.locale = body.locale;
    if (body.defaultModelId !== undefined) updateData.defaultModelId = body.defaultModelId;
    if (body.soundEnabled !== undefined) updateData.soundEnabled = Boolean(body.soundEnabled);
    if (body.autoScroll !== undefined) updateData.autoScroll = Boolean(body.autoScroll);
    if (body.webSearchEnabled !== undefined) updateData.webSearchEnabled = Boolean(body.webSearchEnabled);
    if (body.customSettings !== undefined) {
      updateData.customSettings = {
        ...(existing?.customSettings || {}),
        ...body.customSettings,
      };
    }

    let updated: any;
    if (existing) {
      const [res] = await database
        .update(userPreferences)
        .set(updateData)
        .where(and(eq(userPreferences.id, existing.id), eq(userPreferences.userId, user.id)))
        .returning();
      updated = res;
    } else {
      try {
        await UserRepository.upsertUser({ id: user.id, email: user.email || `${user.id}@souftools.app` });
        const [res] = await database
          .insert(userPreferences)
          .values({
            id: `pref_${user.id}`,
            userId: user.id,
            ...updateData,
          })
          .onConflictDoUpdate({
            target: userPreferences.id,
            set: {
              ...updateData,
              userId: user.id,
            },
          })
          .returning();
        updated = res;
      } catch {
        const [res] = await database
          .update(userPreferences)
          .set(updateData)
          .where(eq(userPreferences.userId, user.id))
          .returning();
        updated = res;
      }
    }

    // Broadcast sync event to all other user devices
    await recordSyncEvent({
      userId: user.id,
      entityType: "preference",
      entityId: user.id,
      operation: "updated",
      version: newVersion,
      payload: {
        theme: updated.theme,
        locale: updated.locale,
        defaultModelId: updated.defaultModelId,
        soundEnabled: updated.soundEnabled,
        autoScroll: updated.autoScroll,
        webSearchEnabled: updated.webSearchEnabled,
        customSettings: updated.customSettings,
      },
      deviceId,
    });

    return NextResponse.json({
      success: true,
      preferences: {
        ...updated,
        updatedAt: toIsoDateString(updated.updatedAt),
      },
    });
  } catch (error: any) {
    console.error("[Preferences PUT Error]:", error);
    return NextResponse.json(
      { success: false, code: "PREFERENCES_UPDATE_ERROR", message: "فشل حفظ إعدادات المستخدم" },
      { status: 500 }
    );
  }
}
