/**
 * SoufTools Secure File Upload API Route
 * Handles private file storage uploads with quota verification, magic-byte inspection,
 * and signed download token generation.
 */

import { NextRequest, NextResponse } from "next/server";
import { ObjectStorage } from "@/lib/storage/objectStorage";
import { requireAuth } from "@/lib/auth/serverAuth";
import { checkRateLimit } from "@/lib/security/rateLimiter";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult) return authResult.errorResponse;
  const { user } = authResult;

  // Rate limiting on uploads (20 uploads per minute per user)
  const rate = checkRateLimit(`upload_${user.id}`, 20, 20);
  if (!rate.allowed) {
    return NextResponse.json(
      { code: "RATE_LIMITED", message: "تم تجاوز حد الرفع المتكرر، يرجى الانتظار", retryAfter: rate.retryAfterSeconds },
      { status: 429 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const conversationId = (formData.get("conversationId") as string) || undefined;
    const projectId = (formData.get("projectId") as string) || undefined;

    if (!file) {
      return NextResponse.json({ code: "BAD_REQUEST", message: "لم يتم إرسال أي ملف" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Limit maximum upload per request (25MB)
    if (buffer.length > 25 * 1024 * 1024) {
      return NextResponse.json(
        { code: "PAYLOAD_TOO_LARGE", message: "حجم الملف يتجاوز الحد الأقصى (25 ميجابايت)" },
        { status: 413 }
      );
    }

    const uploadResult = await ObjectStorage.putObject({
      userId: user.id,
      filename: file.name,
      buffer,
      mimeType: file.type || "application/octet-stream",
      conversationId,
      projectId,
    });

    if (!uploadResult.success) {
      return NextResponse.json(
        { code: "STORAGE_ERROR", message: uploadResult.error || "فشل رفع الملف" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      file: uploadResult.file,
    });
  } catch (err: any) {
    console.error("[Storage upload] unexpected error", err);
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "خطأ أثناء معالجة رفع الملف" },
      { status: 500 }
    );
  }
}
