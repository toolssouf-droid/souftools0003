/**
 * /api/v1/projects
 * 
 * GET: Lists user projects from Turso.
 * POST: Creates a new project in Turso and broadcasts a sync event.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb, UserRepository } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { toIsoDateString } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const database = await getReadyDb();

    const rows = await database
      .select()
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(desc(projects.updatedAt));

    return NextResponse.json({
      success: true,
      projects: rows.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        framework: p.framework,
        version: p.version,
        metadata: p.metadata,
        createdAt: toIsoDateString(p.createdAt),
        updatedAt: toIsoDateString(p.updatedAt),
      })),
    });
  } catch (error: any) {
    console.error("[Projects GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "PROJECTS_FETCH_ERROR", message: "فشل استرداد المشاريع" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const database = await getReadyDb();
    await UserRepository.upsertUser({ id: user.id, email: user.email || `${user.id}@souftools.app` });

    const body = await req.json().catch(() => ({}));
    const deviceId = req.headers.get("x-device-id");

    const id = body.id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const name = body.name || "مشروع جديد";
    const description = body.description || "";
    const framework = body.framework || "react_nextjs";
    const now = new Date();

    const [created] = await database
      .insert(projects)
      .values({
        id,
        userId: user.id,
        name,
        description,
        framework,
        version: 1,
        metadata: body.metadata || {},
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await recordSyncEvent({
      userId: user.id,
      entityType: "project",
      entityId: id,
      operation: "created",
      version: 1,
      payload: {
        id: created.id,
        name: created.name,
        framework: created.framework,
        version: 1,
        createdAt: toIsoDateString(created.createdAt),
      },
      deviceId,
    });

    return NextResponse.json({
      success: true,
      project: {
        ...created,
        createdAt: toIsoDateString(created.createdAt),
        updatedAt: toIsoDateString(created.updatedAt),
      },
    });
  } catch (error: any) {
    console.error("[Projects POST Error]:", error);
    return NextResponse.json(
      { success: false, code: "PROJECT_CREATE_ERROR", message: "فشل إنشاء المشروع" },
      { status: 500 }
    );
  }
}
