/**
 * SoufTools Media Resolver
 * Universal abstraction layer for resolving media sources (Direct URLs, Storage,
 * Streaming Streams, Audio/Video files) with strict SSRF & Security validation.
 */

import { isSafePublicUrl } from "@/lib/security/ssrfGuard";
import { PlaybackInformation, MediaQualityLevel, MediaAudioTrack, MediaSubtitleTrack, MediaType } from "./types";
import { ArchiveOrgProvider } from "./providers/archiveOrgProvider";
import crypto from "crypto";

export interface ResolveMediaOptions {
  url: string;
  title?: string;
  initialPositionSeconds?: number;
  subtitlesUrl?: string;
  subtitleLanguage?: string;
  posterUrl?: string;
  mimeType?: string;
  qualities?: MediaQualityLevel[];
  audioTracks?: MediaAudioTrack[];
  subtitles?: MediaSubtitleTrack[];
}

export class MediaResolver {
  /**
   * Generates a deterministic media ID based on URL or file identifier
   */
  public static generateMediaId(url: string): string {
    const hash = crypto.createHash("sha256").update(url.trim()).digest("hex").slice(0, 16);
    return `med_${hash}`;
  }

  /**
   * Detects the media type from URL extension or MIME type
   */
  public static detectMediaType(url: string, mimeType?: string): { mediaType: MediaType; mimeType: string } {
    const cleanUrl = url.split("?")[0].toLowerCase();

    if (mimeType) {
      if (mimeType.startsWith("audio/")) {
        return { mediaType: "audio", mimeType };
      }
      if (mimeType.includes("mpegurl") || mimeType.includes("m3u8")) {
        return { mediaType: "adaptive", mimeType: "application/x-mpegURL" };
      }
      if (mimeType.startsWith("video/")) {
        return { mediaType: "video", mimeType };
      }
    }

    if (cleanUrl.endsWith(".m3u8")) {
      return { mediaType: "adaptive", mimeType: "application/x-mpegURL" };
    }
    if (cleanUrl.endsWith(".mp3") || cleanUrl.endsWith(".wav") || cleanUrl.endsWith(".ogg") || cleanUrl.endsWith(".m4a") || cleanUrl.endsWith(".aac") || cleanUrl.endsWith(".flac")) {
      const ext = cleanUrl.split(".").pop() || "mp3";
      return { mediaType: "audio", mimeType: `audio/${ext === "mp3" ? "mpeg" : ext}` };
    }
    if (cleanUrl.endsWith(".webm")) {
      return { mediaType: "video", mimeType: "video/webm" };
    }
    if (cleanUrl.endsWith(".ogv")) {
      return { mediaType: "video", mimeType: "video/ogg" };
    }

    // Default to MP4 video
    return { mediaType: "video", mimeType: "video/mp4" };
  }

  /**
   * Resolves a media URL into a complete PlaybackInformation contract
   */
  public static async resolveMedia(options: ResolveMediaOptions): Promise<{ success: boolean; data?: PlaybackInformation; error?: string }> {
    const rawUrl = options.url?.trim();
    if (!rawUrl) {
      return { success: false, error: "Media URL is required" };
    }

    // Handle relative platform media or data URLs vs remote URLs
    const isPlatformLocal = rawUrl.startsWith("/") || rawUrl.startsWith("data:");

    // If it's an Archive.org URL or item ID, resolve via ArchiveOrgProvider directly
    if (rawUrl.includes("archive.org/")) {
      const archiveResult = await ArchiveOrgProvider.resolveItemToPlayback(rawUrl, {
        initialPositionSeconds: options.initialPositionSeconds,
      });
      if (archiveResult.success && archiveResult.data) {
        if (options.title) archiveResult.data.title = options.title;
        if (options.subtitles && options.subtitles.length > 0) {
          archiveResult.data.subtitles = [...(archiveResult.data.subtitles || []), ...options.subtitles];
        }
        return archiveResult;
      }
    }

    if (!isPlatformLocal) {
      const safetyCheck = isSafePublicUrl(rawUrl);
      if (!safetyCheck.safe) {
        return { success: false, error: safetyCheck.error || "URL failed security validation" };
      }
    }

    const mediaId = MediaResolver.generateMediaId(rawUrl);
    const { mediaType, mimeType } = MediaResolver.detectMediaType(rawUrl, options.mimeType);

    // Build subtitle tracks if provided
    const subtitles: MediaSubtitleTrack[] = [...(options.subtitles || [])];
    if (options.subtitlesUrl) {
      const subSafe = isPlatformLocal || isSafePublicUrl(options.subtitlesUrl).safe;
      if (subSafe) {
        const isVtt = options.subtitlesUrl.toLowerCase().includes(".vtt");
        subtitles.push({
          id: `sub_${subtitles.length + 1}`,
          label: options.subtitleLanguage ? `العربية / ${options.subtitleLanguage}` : "الترجمة",
          language: options.subtitleLanguage || "ar",
          src: options.subtitlesUrl,
          format: isVtt ? "vtt" : "srt",
          isDefault: true,
        });
      }
    }

    // Determine source provider
    let sourceProvider: PlaybackInformation["sourceProvider"] = "direct";
    if (rawUrl.includes("storage.googleapis.com") || rawUrl.startsWith("/api/v1/storage") || rawUrl.includes("firebasestorage")) {
      sourceProvider = "storage";
    } else if (rawUrl.includes(".m3u8")) {
      sourceProvider = "hls";
    }

    // Derive a clean title if not provided
    let title = options.title?.trim();
    if (!title) {
      try {
        const urlObj = new URL(rawUrl, "http://localhost");
        const filename = urlObj.pathname.split("/").pop() || "ملف وسائط";
        title = decodeURIComponent(filename).replace(/[-_]/g, " ");
      } catch {
        title = "ملف وسائط";
      }
    }

    const playbackInfo: PlaybackInformation = {
      mediaId,
      title,
      url: rawUrl,
      poster: options.posterUrl,
      initialPositionSeconds: options.initialPositionSeconds && options.initialPositionSeconds > 0 ? options.initialPositionSeconds : 0,
      mediaType,
      mimeType,
      qualities: options.qualities || [],
      audioTracks: options.audioTracks || [],
      subtitles,
      sourceProvider,
      canSeek: true,
      metadata: {
        resolvedAt: Date.now(),
      },
    };

    return {
      success: true,
      data: playbackInfo,
    };
  }
}
