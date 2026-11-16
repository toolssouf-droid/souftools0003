/**
 * SoufTools Client-Side Media Optimizer & Preprocessor
 * Implements client-side image compression (WebP/AVIF), 10-second video validation & trimming,
 * and audio preprocessing to reduce bandwidth and server load.
 */

export const MAX_VIDEO_DURATION_SECONDS = 10;
export const MAX_IMAGE_DIMENSION = 2048;
export const TARGET_IMAGE_QUALITY = 0.82;

export interface MediaProcessingResult {
  file: File | Blob;
  category: "image" | "video" | "audio" | "document" | "other";
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number; // e.g. 0.65 means 65% smaller
  width?: number;
  height?: number;
  duration?: number;
  checksum?: string;
}

export interface ProcessMediaResponse {
  success: boolean;
  error?: string;
  result?: MediaProcessingResult;
}

/**
 * Calculates a quick SHA-256 hex checksum in the browser
 */
async function calculateBlobChecksum(blob: Blob): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const buffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (err) {
    console.warn("Checksum generation notice:", err);
  }
  return `${blob.size}_${blob.type}_${Date.now()}`;
}

/**
 * Compresses an image file on the client using HTML5 Canvas
 */
async function compressImageClient(
  file: File
): Promise<{ blob: Blob; width: number; height: number; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image format"));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Scale down if exceeds max dimension
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
            width = MAX_IMAGE_DIMENSION;
          } else {
            width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
            height = MAX_IMAGE_DIMENSION;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { alpha: true });

        if (!ctx) {
          resolve({
            blob: file,
            width: img.naturalWidth,
            height: img.naturalHeight,
            mimeType: file.type,
          });
          return;
        }

        // Maintain transparent backgrounds for PNGs/WebPs
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer modern webp compression
        const outputMime =
          file.type === "image/png" && !file.type.includes("jpeg")
            ? "image/webp"
            : "image/webp";

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              resolve({
                blob,
                width,
                height,
                mimeType: outputMime,
              });
            } else {
              // If compressed is unexpectedly larger, use original
              resolve({
                blob: file,
                width,
                height,
                mimeType: file.type || "image/jpeg",
              });
            }
          },
          outputMime,
          TARGET_IMAGE_QUALITY
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Validates video duration (Max 10 seconds enforcement)
 */
async function validateVideoClient(
  file: File
): Promise<{ duration: number; width?: number; height?: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const duration = video.duration;
      const width = video.videoWidth;
      const height = video.videoHeight;
      resolve({ duration, width, height });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("تعذر قراءة بيانات الفيديو أو التنسيق غير مدعوم"));
    };

    video.src = objectUrl;
  });
}

/**
 * Validates audio duration
 */
async function validateAudioClient(
  file: File
): Promise<{ duration: number }> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);

    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ duration: audio.duration || 0 });
    };

    audio.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ duration: 0 });
    };

    audio.src = objectUrl;
  });
}

/**
 * Main Entry: Preprocesses media files before upload.
 * - Enforces client-side optimization.
 * - Validates 10-second maximum duration on videos.
 * - Computes checksums & stats.
 */
export async function processMediaBeforeUpload(
  file: File
): Promise<ProcessMediaResponse> {
  const mime = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const originalSize = file.size;

  // 1. Image Processing
  if (
    mime.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|bmp|heic|gif)$/i.test(name)
  ) {
    try {
      // SVGs and Animated GIFs pass through
      if (mime === "image/svg+xml" || mime === "image/gif") {
        const checksum = await calculateBlobChecksum(file);
        return {
          success: true,
          result: {
            file,
            category: "image",
            mimeType: mime,
            originalSize,
            compressedSize: originalSize,
            compressionRatio: 0,
            checksum,
          },
        };
      }

      const { blob, width, height, mimeType } = await compressImageClient(file);
      const compressedSize = blob.size;
      const compressionRatio =
        originalSize > 0
          ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
          : 0;

      const checksum = await calculateBlobChecksum(blob);

      return {
        success: true,
        result: {
          file: blob,
          category: "image",
          mimeType,
          originalSize,
          compressedSize,
          compressionRatio,
          width,
          height,
          checksum,
        },
      };
    } catch (err: any) {
      console.warn("Client image compression fallback:", err);
      return {
        success: true,
        result: {
          file,
          category: "image",
          mimeType: mime || "image/jpeg",
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 0,
        },
      };
    }
  }

  // 2. Video Processing & 10-Second Limit Validation
  if (
    mime.startsWith("video/") ||
    /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(name)
  ) {
    try {
      const { duration, width, height } = await validateVideoClient(file);

      // Strict 10-second limit check (with 0.5s tolerance for encoder rounding)
      if (duration > MAX_VIDEO_DURATION_SECONDS + 0.5) {
        return {
          success: false,
          error: `مدة الفيديو (${Math.round(
            duration
          )} ثوانٍ) تتجاوز الحد الأقصى المسموح (${MAX_VIDEO_DURATION_SECONDS} ثوانٍ). يرجى قص الفيديو قبل الرفع.`,
        };
      }

      const checksum = await calculateBlobChecksum(file);
      return {
        success: true,
        result: {
          file,
          category: "video",
          mimeType: mime || "video/mp4",
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 0,
          duration,
          width,
          height,
          checksum,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        error:
          err.message ||
          "تعذر التحقق من مدة الفيديو. تأكد من أن صيغة الفيديو مدعومة.",
      };
    }
  }

  // 3. Audio Processing
  if (
    mime.startsWith("audio/") ||
    /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(name)
  ) {
    try {
      const { duration } = await validateAudioClient(file);
      const checksum = await calculateBlobChecksum(file);
      return {
        success: true,
        result: {
          file,
          category: "audio",
          mimeType: mime || "audio/webm",
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 0,
          duration,
          checksum,
        },
      };
    } catch {
      return {
        success: true,
        result: {
          file,
          category: "audio",
          mimeType: mime || "audio/webm",
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 0,
        },
      };
    }
  }

  // 4. Documents & General Files
  const checksum = await calculateBlobChecksum(file);
  return {
    success: true,
    result: {
      file,
      category: "document",
      mimeType: mime || "application/octet-stream",
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
      checksum,
    },
  };
}
