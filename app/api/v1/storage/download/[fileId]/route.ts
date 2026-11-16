/**
 * SoufTools Secure File Stream / Download API Route
 * Validates HMAC signed tokens and serves private files via byte streams.
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { ObjectStorage } from "@/lib/storage/objectStorage";
import { resolveAuthUser } from "@/lib/auth/serverAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  if (!fileId) {
    return new NextResponse("File ID required", { status: 400 });
  }

  const token = req.nextUrl.searchParams.get("token");
  let authorizedUserId: string | undefined;

  // 1. Verify Signed Token
  if (token) {
    const tokenResult = ObjectStorage.verifySignedToken(token);
    if (!tokenResult.valid || tokenResult.fileId !== fileId) {
      return new NextResponse("Invalid or expired signed URL", { status: 403 });
    }
    authorizedUserId = tokenResult.userId;
  } else {
    // 2. Or verify session user
    const user = await resolveAuthUser(req);
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    authorizedUserId = user.id;
  }

  const fileData = await ObjectStorage.getObjectStream(fileId, authorizedUserId);
  if (!fileData) {
    return new NextResponse("File not found or access denied", { status: 404 });
  }

  const { filePath, size, mimeType, filename } = fileData;
  const stat = fs.statSync(filePath);
  const rangeHeader = req.headers.get("range");

  // XSS Defense: Prevent browser script execution on untrusted user uploads
  const safeFilename = (filename || "download").replace(/["\r\n\/\\]/g, "_");
  const dangerousMimes = [
    "text/html",
    "text/xml",
    "application/xhtml+xml",
    "application/xml",
    "image/svg+xml",
    "text/javascript",
    "application/javascript",
  ];
  const isDangerousForInline = dangerousMimes.some((m) => mimeType.toLowerCase().includes(m));
  const disposition = isDangerousForInline ? `attachment; filename="${safeFilename}"` : `inline; filename="${safeFilename}"`;

  // Handle HTTP Range Requests for smooth audio/video playback
  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = end - start + 1;

    const fileStream = fs.createReadStream(filePath, { start, end });
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(stream as any, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize.toString(),
        "Content-Type": isDangerousForInline ? "application/octet-stream" : mimeType,
        "Content-Disposition": disposition,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  }

  const fileStream = fs.createReadStream(filePath);
  const stream = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk) => controller.enqueue(chunk));
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(stream as any, {
    status: 200,
    headers: {
      "Content-Length": stat.size.toString(),
      "Content-Type": isDangerousForInline ? "application/octet-stream" : mimeType,
      "Content-Disposition": disposition,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
