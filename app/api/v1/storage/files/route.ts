/**
 * SoufTools User Files Management API Route
 * Lists user files and supports secure deletion with quota update.
 */

import { NextRequest, NextResponse } from "next/server";
import { StorageRepository } from "@/lib/db";
import { ObjectStorage } from "@/lib/storage/objectStorage";
import { requireAuth } from "@/lib/auth/serverAuth";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  try {
    const files = await StorageRepository.listByUser(user.id);
    const mapped = files.map((f: any) => {
      const token = ObjectStorage.generateSignedToken(f.id, user.id);
      return {
        id: f.id,
        filename: f.filename,
        mimeType: f.mimeType,
        category: f.category,
        sizeBytes: f.sizeBytes,
        checksum: f.checksum,
        createdAt: f.createdAt,
        signedUrl: `/api/v1/storage/download/${f.id}?token=${encodeURIComponent(token)}`,
      };
    });

    return NextResponse.json({
      success: true,
      files: mapped,
      storageUsedBytes: user.storageUsedBytes,
      storageLimitBytes: user.storageLimitBytes,
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل استرجاع الملفات", error: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  const fileId = req.nextUrl.searchParams.get("id");
  if (!fileId) {
    return NextResponse.json({ code: "BAD_REQUEST", message: "معرف الملف مطلوب" }, { status: 400 });
  }

  try {
    const deleted = await ObjectStorage.deleteObject(fileId, user.id);
    if (!deleted) {
      return NextResponse.json({ code: "NOT_FOUND", message: "الملف غير موجود أو ليس لديك إذن بحذفه" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "تم حذف الملف بنجاح" });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "فشل حذف الملف", error: err.message },
      { status: 500 }
    );
  }
}
