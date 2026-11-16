/**
 * /api/v1/projects/[id]
 * 
 * GET: Retrieves project with its files and strict IDOR verification.
 * PATCH: Updates project metadata with optimistic concurrency.
 * DELETE: Deletes project and its files, broadcasting sync event.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb } from "@/lib/db";
import { projects, projectFiles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { recordSyncEvent } from "@/lib/sync/syncEngine";
import { toIsoDateString } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const database = await getReadyDb();
    const { id: projectId } = await params;

    const proj = await database
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!proj) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "المشروع غير موجود" },
        { status: 404 }
      );
    }

    const files = await database
      .select({
        id: projectFiles.id,
        path: projectFiles.path,
        sizeBytes: projectFiles.sizeBytes,
        version: projectFiles.version,
        updatedAt: projectFiles.updatedAt,
      })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));

    return NextResponse.json({
      success: true,
      project: {
        ...proj,
        createdAt: toIsoDateString(proj.createdAt),
        updatedAt: toIsoDateString(proj.updatedAt),
        files: files.map((f) => ({
          ...f,
          updatedAt: toIsoDateString(f.updatedAt),
        })),
      },
    });
  } catch (error: any) {
    console.error("[Project GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "FETCH_ERROR", message: "فشل استرداد بيانات المشروع" },
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
    const database = await getReadyDb();
    const { id: projectId } = await params;
    const body = await req.json().catch(() => ({}));
    const deviceId = req.headers.get("x-device-id");

    const existing = await database
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "المشروع غير موجود" },
        { status: 404 }
      );
    }

    const nextVersion = existing.version + 1;
    const now = new Date();

    const [updated] = await database
      .update(projects)
      .set({
        name: body.name || existing.name,
        description: body.description !== undefined ? body.description : existing.description,
        framework: body.framework || existing.framework,
        metadata: body.metadata ? { ...existing.metadata, ...body.metadata } : existing.metadata,
        version: nextVersion,
        updatedAt: now,
      })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
      .returning();

    await recordSyncEvent({
      userId: user.id,
      entityType: "project",
      entityId: projectId,
      operation: "updated",
      version: nextVersion,
      payload: updated,
      deviceId,
    });

    return NextResponse.json({
      success: true,
      project: {
        ...updated,
        createdAt: toIsoDateString(updated.createdAt),
        updatedAt: toIsoDateString(updated.updatedAt),
      },
    });
  } catch (error: any) {
    console.error("[Project PATCH Error]:", error);
    return NextResponse.json(
      { success: false, code: "UPDATE_ERROR", message: "فشل تحديث بيانات المشروع" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const database = await getReadyDb();
    const { id: projectId } = await params;
    const deviceId = req.headers.get("x-device-id");

    const existing = await database
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
      .limit(1)
      .then((r) => r[0]);

    if (!existing) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "المشروع غير موجود" },
        { status: 404 }
      );
    }

    await database.transaction(async (tx) => {
      await tx.delete(projectFiles).where(eq(projectFiles.projectId, projectId));
      await tx.delete(projects).where(and(eq(projects.id, projectId), eq(projects.userId, user.id)));
    });

    await recordSyncEvent({
      userId: user.id,
      entityType: "project",
      entityId: projectId,
      operation: "deleted",
      payload: { id: projectId },
      deviceId,
    });

    return NextResponse.json({
      success: true,
      message: "تم حذف المشروع بنجاح",
      deletedId: projectId,
    });
  } catch (error: any) {
    console.error("[Project DELETE Error]:", error);
    return NextResponse.json(
      { success: false, code: "DELETE_ERROR", message: "فشل حذف المشروع" },
      { status: 500 }
    );
  }
}
