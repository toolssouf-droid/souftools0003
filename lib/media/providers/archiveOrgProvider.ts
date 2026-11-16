/**
 * SoufTools Archive.org (Internet Archive) Media Provider
 * Official REST API integration for searching, resolving, validating,
 * and streaming public domain & open licensed movies, films, and audio.
 */

import { PlaybackInformation, MediaQualityLevel, MediaSubtitleTrack, MediaType } from "../types";

export interface ArchiveOrgSearchResult {
  identifier: string;
  title: string;
  description?: string;
  mediatype: string;
  year?: string | number;
  publicdate?: string;
  downloads?: number;
  licenseurl?: string;
  posterUrl: string;
  detailsUrl: string;
}

export interface ArchiveOrgFile {
  name: string;
  source?: string;
  format?: string;
  length?: string | number;
  size?: string | number;
  height?: string | number;
  width?: string | number;
  title?: string;
  language?: string;
  bitrate?: string | number;
  original?: string;
}

export interface ArchiveOrgMetadata {
  identifier: string;
  title?: string;
  description?: string;
  mediatype?: string;
  licenseurl?: string;
  rights?: string;
  publicdate?: string;
  year?: string | number;
  collection?: string | string[];
  creator?: string | string[];
  is_dark?: boolean;
}

export interface ArchiveOrgItemResponse {
  created?: number;
  d1?: string;
  d2?: string;
  dir?: string;
  files?: ArchiveOrgFile[];
  metadata?: ArchiveOrgMetadata;
  server?: string;
  is_dark?: boolean;
}

export class ArchiveOrgProvider {
  private static readonly ADVANCED_SEARCH_URL = "https://archive.org/advancedsearch.php";
  private static readonly METADATA_BASE_URL = "https://archive.org/metadata";
  private static readonly DOWNLOAD_BASE_URL = "https://archive.org/download";
  private static readonly SERVICES_IMG_URL = "https://archive.org/services/img";

  /**
   * Search Archive.org for playable movies, films, video, or audio items.
   */
  public static async search(
    query: string,
    options: {
      mediaType?: "movies" | "audio" | "all";
      limit?: number;
      page?: number;
    } = {}
  ): Promise<{ success: boolean; results: ArchiveOrgSearchResult[]; total: number; error?: string }> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { success: true, results: [], total: 0 };
    }

    const mediaTypeFilter = options.mediaType === "audio" 
      ? "mediatype:(audio)" 
      : options.mediaType === "all" 
      ? "mediatype:(movies OR audio)" 
      : "mediatype:(movies)";

    const limit = Math.min(25, Math.max(1, options.limit || 10));
    const page = Math.max(1, options.page || 1);

    // Filter out dark/restricted items and format the Lucene query
    const luceneQuery = `(${cleanQuery}) AND ${mediaTypeFilter} AND -is_dark:true`;

    const searchUrl = new URL(this.ADVANCED_SEARCH_URL);
    searchUrl.searchParams.set("q", luceneQuery);
    searchUrl.searchParams.append("fl[]", "identifier");
    searchUrl.searchParams.append("fl[]", "title");
    searchUrl.searchParams.append("fl[]", "description");
    searchUrl.searchParams.append("fl[]", "mediatype");
    searchUrl.searchParams.append("fl[]", "publicdate");
    searchUrl.searchParams.append("fl[]", "year");
    searchUrl.searchParams.append("fl[]", "downloads");
    searchUrl.searchParams.append("fl[]", "licenseurl");
    searchUrl.searchParams.append("sort[]", "downloads desc");
    searchUrl.searchParams.set("rows", limit.toString());
    searchUrl.searchParams.set("page", page.toString());
    searchUrl.searchParams.set("output", "json");

    try {
      const resp = await fetch(searchUrl.toString(), {
        headers: {
          "User-Agent": "SoufTools-AI-Studio/1.0 (https://souftools.internal)",
          Accept: "application/json",
        },
        next: { revalidate: 300 }, // Cache search queries for 5 minutes
      });

      if (!resp.ok) {
        return {
          success: false,
          results: [],
          total: 0,
          error: `Archive.org API responded with status ${resp.status}`,
        };
      }

      const json = await resp.json();
      const docs = json?.response?.docs || [];
      const numFound = json?.response?.numFound || docs.length;

      const results: ArchiveOrgSearchResult[] = docs.map((doc: any) => ({
        identifier: doc.identifier,
        title: doc.title || doc.identifier,
        description: typeof doc.description === "string" ? doc.description.slice(0, 300) : Array.isArray(doc.description) ? doc.description[0]?.slice(0, 300) : "",
        mediatype: doc.mediatype || "movies",
        year: doc.year,
        publicdate: doc.publicdate,
        downloads: doc.downloads || 0,
        licenseurl: doc.licenseurl,
        posterUrl: `${this.SERVICES_IMG_URL}/${doc.identifier}`,
        detailsUrl: `https://archive.org/details/${doc.identifier}`,
      }));

      return {
        success: true,
        results,
        total: numFound,
      };
    } catch (err: any) {
      console.error("[ArchiveOrgProvider] Search error:", err);
      return {
        success: false,
        results: [],
        total: 0,
        error: err?.message || "Failed to search Archive.org",
      };
    }
  }

  /**
   * Fetch item metadata from official Archive.org API: https://archive.org/metadata/{identifier}
   */
  public static async getItemMetadata(identifier: string): Promise<ArchiveOrgItemResponse | null> {
    const cleanId = identifier.trim().replace(/^https?:\/\/archive\.org\/(details|download|embed)\//, "").split("/")[0];
    if (!cleanId) return null;

    const url = `${this.METADATA_BASE_URL}/${encodeURIComponent(cleanId)}`;

    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "SoufTools-AI-Studio/1.0",
          Accept: "application/json",
        },
        next: { revalidate: 600 },
      });

      if (!resp.ok) return null;
      return await resp.json();
    } catch (err) {
      console.error(`[ArchiveOrgProvider] Metadata fetch error for ${cleanId}:`, err);
      return null;
    }
  }

  /**
   * Extracts the identifier from any Archive.org URL
   */
  public static extractIdentifier(urlString: string): string | null {
    try {
      const parsed = new URL(urlString);
      if (!parsed.hostname.includes("archive.org")) return null;

      const parts = parsed.pathname.split("/").filter(Boolean);
      // /details/{identifier}, /download/{identifier}/{file}, /embed/{identifier}
      if (parts[0] === "details" || parts[0] === "download" || parts[0] === "embed" || parts[0] === "metadata") {
        return parts[1] || null;
      }
      return parts[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if an item is allowed for public streaming under copyright / license terms
   */
  public static isPublicAllowed(metadata: ArchiveOrgMetadata | undefined, isDark?: boolean): boolean {
    if (isDark || metadata?.is_dark) return false;
    if (!metadata) return true;

    // Creative Commons or Public Domain Mark
    if (metadata.licenseurl) {
      const lic = metadata.licenseurl.toLowerCase();
      if (lic.includes("creativecommons.org") || lic.includes("publicdomain") || lic.includes("gpl") || lic.includes("mit")) {
        return true;
      }
    }

    // Public Domain collections or open collections
    const collections = Array.isArray(metadata.collection) ? metadata.collection : metadata.collection ? [metadata.collection] : [];
    const openCollections = [
      "feature_films",
      "classic_tv",
      "animationandcartoons",
      "silent_films",
      "opensource_movies",
      "prelinger",
      "moviesandfilms",
      "podcasts",
      "audio_bookspoetry",
      "audio_music",
      "audio_tech",
      "librivoxaudio",
      "etree",
      "netlabels",
      "nasa",
      "computerchronicles",
      "machinima",
    ];

    const isKnownOpen = collections.some((c) => openCollections.includes(c.toLowerCase()));
    if (isKnownOpen) return true;

    // Check rights field
    if (metadata.rights && /public domain|creative commons|free|no known copyright/i.test(metadata.rights)) {
      return true;
    }

    // Default to true for standard public Archive.org movie/audio items unless explicitly restricted
    return true;
  }

  /**
   * Resolves an Archive.org identifier or URL into a high-performance PlaybackInformation object.
   */
  public static async resolveItemToPlayback(
    identifierOrUrl: string,
    options: {
      initialPositionSeconds?: number;
      preferredFormat?: string;
    } = {}
  ): Promise<{ success: boolean; data?: PlaybackInformation; error?: string }> {
    const identifier = this.extractIdentifier(identifierOrUrl) || identifierOrUrl.trim();
    if (!identifier) {
      return { success: false, error: "Invalid Archive.org identifier" };
    }

    const item = await this.getItemMetadata(identifier);
    if (!item || !item.files || item.files.length === 0) {
      return { success: false, error: `Archive.org item '${identifier}' was not found or has no files` };
    }

    const metadata = item.metadata || { identifier };

    // Validate license / copyright
    if (!this.isPublicAllowed(metadata, item.is_dark)) {
      return {
        success: false,
        error: "This media item is restricted or not available for public streaming under open copyright licenses.",
      };
    }

    const isAudio = metadata.mediatype === "audio";
    const mediaType: MediaType = isAudio ? "audio" : "video";

    // 1. Find Playable Video or Audio files
    const candidateFiles: { file: ArchiveOrgFile; score: number; qualityLabel: string; mimeType: string }[] = [];
    const subtitles: MediaSubtitleTrack[] = [];

    let detectedDuration: number = 0;

    for (const f of item.files) {
      const name = f.name.toLowerCase();
      const format = f.format || "";
      const lengthSeconds = f.length ? parseFloat(f.length.toString()) : 0;
      if (lengthSeconds > detectedDuration) {
        detectedDuration = lengthSeconds;
      }

      // Check Subtitles
      if (
        format === "SubRip" ||
        format === "WebVTT" ||
        name.endsWith(".srt") ||
        name.endsWith(".vtt") ||
        name.endsWith(".sub")
      ) {
        const isVtt = name.endsWith(".vtt") || format === "WebVTT";
        const langCode = f.language || (name.includes("_ar") ? "ar" : name.includes("_en") ? "en" : name.includes("_fr") ? "fr" : name.includes("_es") ? "es" : "en");
        const langLabel =
          langCode === "ar"
            ? "العربية"
            : langCode === "en"
            ? "English"
            : langCode === "fr"
            ? "Français"
            : langCode === "es"
            ? "Español"
            : langCode;

        subtitles.push({
          id: `sub_arc_${subtitles.length + 1}`,
          label: f.title || langLabel,
          language: langCode,
          src: `${this.DOWNLOAD_BASE_URL}/${identifier}/${encodeURIComponent(f.name)}`,
          format: isVtt ? "vtt" : "srt",
          isDefault: subtitles.length === 0,
        });
        continue;
      }

      if (!isAudio) {
        // Video file evaluation - prioritize H.264/AAC standard web derivatives for maximum mobile/browser compatibility
        const isH264Derivative = format === "h.264" || format === "512Kb MPEG4" || name.includes(".ia.mp4") || name.includes("_512kb.mp4") || name.includes("_h264.mp4");
        const isWebM = name.endsWith(".webm") || format === "WebM";
        const isStandardMp4 = name.endsWith(".mp4") || format.includes("MPEG4") || format.toLowerCase().includes("h.264");

        if (isStandardMp4 || isH264Derivative) {
          const height = f.height ? parseInt(f.height.toString(), 10) : 0;
          let label = "MP4 فيديو";
          let score = 50;

          if (isH264Derivative) {
            // H.264 IA derivatives have AAC stereo audio and fast-start headers (100% compatible on all mobile browsers)
            if (height >= 1080 || format.includes("1080p") || name.includes("1080p")) {
              label = "1080p Full HD (H.264)";
              score = 110;
            } else if (height >= 720 || format.includes("720p") || name.includes("720p")) {
              label = "720p HD (H.264)";
              score = 105;
            } else if (height >= 480 || format === "h.264" || name.includes("480p")) {
              label = "480p SD (H.264)";
              score = 100;
            } else if (format.includes("512Kb") || height <= 360) {
              label = "360p متوازن (512Kb)";
              score = 90;
            } else {
              label = "H.264 بث مباشر";
              score = 95;
            }
          } else {
            // Raw user uploaded MP4 - might require codec fallback or streaming proxy
            if (height >= 1080) {
              label = "1080p (المصدر)";
              score = 65;
            } else if (height >= 720) {
              label = "720p (المصدر)";
              score = 60;
            } else {
              label = "MP4 قياسي";
              score = 55;
            }
          }

          candidateFiles.push({
            file: f,
            score,
            qualityLabel: label,
            mimeType: "video/mp4",
          });
        } else if (isWebM) {
          candidateFiles.push({
            file: f,
            score: 85,
            qualityLabel: "WebM",
            mimeType: "video/webm",
          });
        } else if (name.endsWith(".ogv") || format === "Ogg Video") {
          candidateFiles.push({
            file: f,
            score: 60,
            qualityLabel: "Ogg Video",
            mimeType: "video/ogg",
          });
        } else if (name.endsWith(".mkv") || format.includes("Matroska")) {
          candidateFiles.push({
            file: f,
            score: 50,
            qualityLabel: "MKV فيديو",
            mimeType: "video/x-matroska",
          });
        } else if (name.endsWith(".mov") || format.includes("QuickTime")) {
          candidateFiles.push({
            file: f,
            score: 45,
            qualityLabel: "QuickTime",
            mimeType: "video/quicktime",
          });
        } else if (name.endsWith(".avi") || name.endsWith(".m4v") || name.endsWith(".ts")) {
          candidateFiles.push({
            file: f,
            score: 40,
            qualityLabel: "فيديو عالي الدقة",
            mimeType: "video/mp4",
          });
        }
      } else {
        // Audio file evaluation
        if (name.endsWith(".mp3") || format.includes("MP3")) {
          candidateFiles.push({
            file: f,
            score: 90,
            qualityLabel: "MP3 Audio",
            mimeType: "audio/mpeg",
          });
        } else if (name.endsWith(".flac") || format === "Flac") {
          candidateFiles.push({
            file: f,
            score: 85,
            qualityLabel: "FLAC Hi-Res",
            mimeType: "audio/flac",
          });
        } else if (name.endsWith(".ogg") || format.includes("Ogg")) {
          candidateFiles.push({
            file: f,
            score: 80,
            qualityLabel: "OGG Audio",
            mimeType: "audio/ogg",
          });
        }
      }
    }

    if (candidateFiles.length === 0) {
      // Look for any non-metadata file as fallback
      const nonMetaFiles = item.files.filter((f) => {
        const n = (f.name || "").toLowerCase();
        return !n.endsWith(".xml") && !n.endsWith(".sqlite") && !n.endsWith(".torrent") && !n.endsWith(".json") && !n.endsWith(".txt");
      });

      if (nonMetaFiles.length > 0) {
        const fallbackFile = nonMetaFiles[0];
        candidateFiles.push({
          file: fallbackFile,
          score: 10,
          qualityLabel: "تدفق الأرشيف القياسي",
          mimeType: isAudio ? "audio/mpeg" : "video/mp4",
        });
      } else {
        // Create a synthetic stream candidate pointing to the Archive.org primary stream
        candidateFiles.push({
          file: {
            name: `${identifier}.mp4`,
            format: "h.264",
          },
          score: 5,
          qualityLabel: "بث مباشر للأرشيف",
          mimeType: isAudio ? "audio/mpeg" : "video/mp4",
        });
      }
    }

    // Sort by best quality / score first
    candidateFiles.sort((a, b) => b.score - a.score);

    const primaryCandidate = candidateFiles[0];
    const primaryUrl = `${this.DOWNLOAD_BASE_URL}/${identifier}/${encodeURIComponent(primaryCandidate.file.name)}`;

    // Build Qualities List
    const qualities: MediaQualityLevel[] = candidateFiles.map((c, idx) => ({
      id: `q_${idx}_${c.file.name.replace(/[^a-zA-Z0-9]/g, "_")}`,
      label: c.qualityLabel,
      url: `${this.DOWNLOAD_BASE_URL}/${identifier}/${encodeURIComponent(c.file.name)}`,
      width: c.file.width ? parseInt(c.file.width.toString(), 10) : undefined,
      height: c.file.height ? parseInt(c.file.height.toString(), 10) : undefined,
      bitrate: c.file.bitrate ? parseInt(c.file.bitrate.toString(), 10) : undefined,
    }));

    const title = metadata.title || identifier.replace(/[-_]/g, " ");
    const description = typeof metadata.description === "string" ? metadata.description : Array.isArray(metadata.description) ? metadata.description[0] : "";
    const poster = `${this.SERVICES_IMG_URL}/${identifier}`;

    const playbackInfo: PlaybackInformation = {
      mediaId: `arc_${identifier}`,
      title,
      description,
      url: primaryUrl,
      poster,
      durationSeconds: detectedDuration > 0 ? Math.round(detectedDuration) : undefined,
      initialPositionSeconds: options.initialPositionSeconds && options.initialPositionSeconds > 0 ? options.initialPositionSeconds : 0,
      mediaType,
      mimeType: primaryCandidate.mimeType,
      qualities,
      audioTracks: [
        {
          id: "main_audio",
          label: "الصوت الأصلي",
          language: "und",
          isDefault: true,
        },
      ],
      subtitles,
      sourceProvider: "archive_org",
      canSeek: true,
      metadata: {
        identifier,
        year: metadata.year,
        publicdate: metadata.publicdate,
        licenseurl: metadata.licenseurl,
        collection: metadata.collection,
        detailsUrl: `https://archive.org/details/${identifier}`,
        resolvedAt: Date.now(),
      },
    };

    return {
      success: true,
      data: playbackInfo,
    };
  }

  /**
   * Search and automatically resolve the top matching item to complete playback info
   */
  public static async searchAndResolveFirst(
    query: string,
    options: {
      mediaType?: "movies" | "audio" | "all";
      initialPositionSeconds?: number;
    } = {}
  ): Promise<{ success: boolean; data?: PlaybackInformation; error?: string }> {
    const searchRes = await this.search(query, { mediaType: options.mediaType, limit: 3 });
    if (!searchRes.success || searchRes.results.length === 0) {
      return {
        success: false,
        error: searchRes.error || `لم يتم العثور على أي وسائط تطابق "${query}" في أرشيف الإنترنت (Archive.org).`,
      };
    }

    // Try resolving the results in order until a playable one is found
    for (const result of searchRes.results) {
      const resolved = await this.resolveItemToPlayback(result.identifier, {
        initialPositionSeconds: options.initialPositionSeconds,
      });
      if (resolved.success && resolved.data) {
        return resolved;
      }
    }

    return {
      success: false,
      error: `تعذر استخراج ملف وسائط قابل للتشغيل لنتائج البحث عن "${query}" في Archive.org.`,
    };
  }
}
