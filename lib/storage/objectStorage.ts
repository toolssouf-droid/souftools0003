/**
 * SoufTools Private Object Storage Engine
 * High-security server-side private file storage with quota controls,
 * HMAC-signed temporary URLs, content-type sniffing & magic-byte verification.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { StorageRepository, UserRepository } from "@/lib/db";

const STORAGE_ROOT =
  process.env.STORAGE_LOCAL_DIR ||
  path.join(process.cwd(), ".souftools_storage");
const STORAGE_PATH_REQUIRED = process.env.VERCEL === "1" && !process.env.STORAGE_LOCAL_DIR?.trim();

const SIGNING_SECRET =
  process.env.STORAGE_SIGNING_SECRET ||
  process.env.ENCRYPTION_SECRET;

if (!SIGNING_SECRET || SIGNING_SECRET.trim().length < 32) {
  throw new Error("STORAGE_SIGNING_SECRET or ENCRYPTION_SECRET must contain at least 32 characters");
}

export interface StoredFileResult {
  fileId: string;
  objectKey: string;
  filename: string;
  mimeType: string;
  category: "image" | "video" | "audio" | "document" | "code" | "archive";
  sizeBytes: number;
  checksum: string;
  signedUrl: string;
}

export const ObjectStorage = {
  /**
   * Generates an HMAC-signed token for time-limited, private file downloads
   */
  generateSignedToken(fileId: string, userId: string, expiresInSeconds = 900): string {
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = `${fileId}:${userId}:${expiresAt}`;
    const hmac = crypto
      .createHmac("sha256", SIGNING_SECRET)
      .update(payload)
      .digest("hex");
    return `${Buffer.from(payload).toString("base64url")}.${hmac}`;
  },

  /**
   * Verifies an HMAC-signed token
   */
  verifySignedToken(token: string): { valid: boolean; fileId?: string; userId?: string; error?: string } {
    try {
      const [payloadB64, hmac] = token.split(".");
      if (!payloadB64 || !hmac) {
        return { valid: false, error: "Malformed token" };
      }
      const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
      const [fileId, userId, expiresStr] = payload.split(":");
      const expiresAt = parseInt(expiresStr, 10);

      if (isNaN(expiresAt) || Math.floor(Date.now() / 1000) > expiresAt) {
        return { valid: false, error: "Token expired" };
      }

      const expectedHmac = crypto
        .createHmac("sha256", SIGNING_SECRET)
        .update(payload)
        .digest("hex");

      if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
        return { valid: false, error: "Invalid signature" };
      }

      return { valid: true, fileId, userId };
    } catch {
      return { valid: false, error: "Token verification failed" };
    }
  },

  /**
   * Sniffs file magic bytes to prevent spoofed MIME types
   */
  detectMagicCategory(
    buffer: Buffer,
    fallbackMime: string,
    filename: string
  ): { category: StoredFileResult["category"]; verifiedMime: string } {
    const ext = path.extname(filename).toLowerCase();

    // JPEG: FF D8 FF
    if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { category: "image", verifiedMime: "image/jpeg" };
    }
    // PNG: 89 50 4E 47
    if (buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { category: "image", verifiedMime: "image/png" };
    }
    // GIF: 47 49 46 38
    if (buffer.length > 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return { category: "image", verifiedMime: "image/gif" };
    }
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (buffer.length > 12 && buffer.toString("utf8", 0, 4) === "RIFF" && buffer.toString("utf8", 8, 12) === "WEBP") {
      return { category: "image", verifiedMime: "image/webp" };
    }
    // PDF: 25 50 44 46 (%PDF)
    if (buffer.length > 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return { category: "document", verifiedMime: "application/pdf" };
    }
    // MP4 / MOV: ... ftyp
    if (buffer.length > 8 && buffer.toString("utf8", 4, 8) === "ftyp") {
      return { category: "video", verifiedMime: "video/mp4" };
    }
    // WebM / MKV: 1A 45 DF A3
    if (buffer.length > 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
      return { category: "video", verifiedMime: "video/webm" };
    }
    // MP3: 49 44 33 (ID3) or FF FB
    if ((buffer.length > 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
      return { category: "audio", verifiedMime: "audio/mpeg" };
    }

    // Extension fallback
    if (/\.(jpg|jpeg|png|webp|gif|svg|bmp)$/i.test(ext)) {
      return { category: "image", verifiedMime: fallbackMime || "image/jpeg" };
    }
    if (/\.(mp4|webm|mov|mkv|avi)$/i.test(ext)) {
      return { category: "video", verifiedMime: fallbackMime || "video/mp4" };
    }
    if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(ext)) {
      return { category: "audio", verifiedMime: fallbackMime || "audio/mpeg" };
    }
    if (/\.(ts|tsx|js|jsx|json|py|html|css|sql|sh)$/i.test(ext)) {
      return { category: "code", verifiedMime: fallbackMime || "text/plain" };
    }
    if (/\.(zip|tar|gz|7z|rar)$/i.test(ext)) {
      return { category: "archive", verifiedMime: fallbackMime || "application/zip" };
    }

    return { category: "document", verifiedMime: fallbackMime || "application/octet-stream" };
  },

  /**
   * Uploads and stores a file privately on the SoufTools backend
   */
  async putObject(params: {
    userId: string;
    filename: string;
    buffer: Buffer;
    mimeType: string;
    conversationId?: string;
    projectId?: string;
    metadata?: Record<string, any>;
  }): Promise<{ success: boolean; error?: string; file?: StoredFileResult }> {
    const { userId, filename, buffer, mimeType, conversationId, projectId, metadata } = params;

    if (STORAGE_PATH_REQUIRED) {
      return {
        success: false,
        error: "تخزين الملفات يحتاج إلى STORAGE_LOCAL_DIR لمسار تخزين دائم وقابل للكتابة على بيئة الاستضافة.",
      };
    }

    // 1. Check user storage quota
    const user = await UserRepository.getById(userId);
    const userUsed = user?.storageUsedBytes || 0;
    const userLimit = user?.storageLimitBytes || 150 * 1024 * 1024; // 150MB default

    if (userUsed + buffer.length > userLimit) {
      return {
        success: false,
        error: `تم تجاوز مساحة التخزين المتاحة (${Math.round(userLimit / 1024 / 1024)} ميجابايت). يرجى حذف بعض الملفات السابقة.`,
      };
    }

    // 2. Magic byte inspection & categorization
    const { category, verifiedMime } = this.detectMagicCategory(buffer, mimeType, filename);

    // 3. Generate secure IDs & paths
    const fileId = `souf_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `users/${userId}/${category}/${fileId}_${safeFilename}`;
    const fullDiskPath = path.join(STORAGE_ROOT, objectKey);

    // 4. Calculate SHA-256 Checksum
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    // 5. Write to secure private disk
    try {
      const dir = path.dirname(fullDiskPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullDiskPath, buffer);
    } catch (err: any) {
      return { success: false, error: `فشل حفظ الملف على الخادم: ${err.message}` };
    }

    // 6. Record metadata in Database Repository
    await StorageRepository.createObject({
      id: fileId,
      userId,
      conversationId,
      projectId,
      objectKey,
      filename: safeFilename,
      mimeType: verifiedMime,
      category,
      sizeBytes: buffer.length,
      checksum,
      metadata: {
        ...metadata,
        originalFilename: filename,
        verifiedMime,
      },
    });

    const token = this.generateSignedToken(fileId, userId);
    const signedUrl = `/api/v1/storage/download/${fileId}?token=${encodeURIComponent(token)}`;

    return {
      success: true,
      file: {
        fileId,
        objectKey,
        filename: safeFilename,
        mimeType: verifiedMime,
        category,
        sizeBytes: buffer.length,
        checksum,
        signedUrl,
      },
    };
  },

  /**
   * Retrieves file path and metadata for authorized stream reading
   */
  async getObjectStream(fileId: string, userId?: string) {
    const meta = await StorageRepository.getObjectById(fileId, userId);
    if (!meta) return null;

    const fullDiskPath = path.join(STORAGE_ROOT, meta.objectKey);
    if (!fs.existsSync(fullDiskPath)) return null;

    return {
      meta,
      filePath: fullDiskPath,
      size: meta.sizeBytes,
      mimeType: meta.mimeType,
      filename: meta.filename,
    };
  },

  /**
   * Deletes a file privately
   */
  async deleteObject(fileId: string, userId: string): Promise<boolean> {
    const meta = await StorageRepository.deleteObject(fileId, userId);
    if (!meta) return false;

    try {
      const fullDiskPath = path.join(STORAGE_ROOT, meta.objectKey);
      if (fs.existsSync(fullDiskPath)) {
        fs.unlinkSync(fullDiskPath);
      }
      return true;
    } catch {
      return true;
    }
  },
};
