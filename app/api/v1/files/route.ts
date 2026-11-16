/**
 * /api/v1/files
 * 
 * GET: Lists private storage objects for the authenticated user.
 * POST: Uploads/registers a file into Private Object Storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/serverAuth";
import { getReadyDb } from "@/lib/db";
import { storageObjects } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ObjectStorage } from "@/lib/storage/objectStorage";
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
      .from(storageObjects)
      .where(eq(storageObjects.userId, user.id))
      .orderBy(desc(storageObjects.createdAt));

    return NextResponse.json({
      success: true,
      files: rows.map((f) => {
        const signedToken = ObjectStorage.generateSignedToken(f.id, user.id, 3600);
        return {
          id: f.id,
          filename: f.filename,
          mimeType: f.mimeType,
          category: f.category,
          sizeBytes: f.sizeBytes,
          checksumSha256: f.checksum,
          downloadUrl: `/api/v1/storage/download?fileId=${f.id}&token=${signedToken}`,
          createdAt: toIsoDateString(f.createdAt),
        };
      }),
    });
  } catch (error: any) {
    console.error("[Files GET Error]:", error);
    return NextResponse.json(
      { success: false, code: "FILES_FETCH_ERROR", message: "فشل استرداد الملفات" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;

    const { user } = authResult;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const deviceId = req.headers.get("x-device-id");

    if (!file) {
      return NextResponse.json(
        { success: false, code: "FILE_REQUIRED", message: "الملف مطلوب في الطلب" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadResult = await ObjectStorage.putObject({
      userId: user.id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
    });

    if (!uploadResult.success || !uploadResult.file) {
      return NextResponse.json(
        { success: false, code: "STORAGE_ERROR", message: uploadResult.error || "فشل تخزين الملف" },
        { status: 500 }
      );
    }

    const stored = uploadResult.file;

    await recordSyncEvent({
      userId: user.id,
      entityType: "file",
      entityId: stored.fileId,
      operation: "created",
      payload: {
        id: stored.fileId,
        filename: stored.filename,
        category: stored.category,
        sizeBytes: stored.sizeBytes,
      },
      deviceId,
    });

    return NextResponse.json({
      success: true,
      file: stored,
    });
  } catch (error: any) {
    console.error("[File Upload Error]:", error);
    return NextResponse.json(
      { success: false, code: "UPLOAD_FAILED", message: error.message || "فشل رفع الملف" },
      { status: 500 }
    );
  }
}
