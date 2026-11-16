/**
 * SoufAI Media Player Tool
 * Real autonomous Agent Tool allowing SoufAI to open, play, seek, configure subtitles,
 * and control media playback inline inside the chat interface.
 */

import { AgentTool, AgentToolExecutionContext, StructuredToolResult } from "./toolInterface";
import { MediaResolver } from "@/lib/media/mediaResolver";
import { ArchiveOrgProvider } from "@/lib/media/providers/archiveOrgProvider";
import { MediaPlayerToolParams, PlaybackInformation } from "@/lib/media/types";
import { WatchHistoryRepository } from "@/lib/db";

export const mediaPlayerTool: AgentTool = {
  name: "media_player",
  description:
    "أداة مشغل الوسائط المتقدمة لمنصة SoufAI مع دعم أرشيف الإنترنت الرسمي (Archive.org). تتيح البحث في أرشيف الأفلام والوثائقيات والتسجيلات المفتوحة (search_archive) وتشغيلها أو تشغيل أي رابط وسائط مباشر داخل المحادثة بشكل مدمج، مع القفز للدقائق (seek)، الترجمة، والتحكم بالصوت والجودة واستئناف المشاهدة.",
  category: "server_safe",
  allowedChannels: ["web", "telegram", "api"],
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "الإجراء المطلوب تنفيذه على مشغل الوسائط",
        enum: [
          "open_media",
          "search_archive",
          "play_media",
          "pause_media",
          "seek_media",
          "set_volume",
          "set_quality",
          "set_audio_track",
          "set_subtitle",
          "get_media_info",
          "get_playback_position",
          "get_available_tracks",
        ],
      },
      searchQuery: {
        type: "string",
        description: "كلمة البحث في أرشيف الإنترنت Archive.org عند استخدام action: search_archive (مثلاً: 'Night of the Living Dead' أو 'Charlie Chaplin')",
      },
      mediaTypeFilter: {
        type: "string",
        description: "نوع الوسائط المبحوث عنها في Archive.org",
        enum: ["movies", "audio", "all"],
      },
      url: {
        type: "string",
        description: "رابط الفيديو أو المقطع الصوتي المباشر أو من أرشيف الإنترنت أو التخزين (مطلوب عند open_media)",
      },
      mediaId: {
        type: "string",
        description: "معرف الوسائط (اختياري، أو يتم استنتاجه من الرابط)",
      },
      title: {
        type: "string",
        description: "عنوان الفيديو أو المقطع الصوتي",
      },
      positionSeconds: {
        type: "number",
        description: "الموضع الزمني بالثواني للتشغيل أو القفز (مثلاً 900 للدقيقة 15)",
      },
      volume: {
        type: "number",
        description: "مستوى الصوت من 0 إلى 1 (مثلاً 0.8)",
      },
      qualityId: {
        type: "string",
        description: "معرف الجودة المطلوبة (إذا كانت مدعومة في المصدر)",
      },
      audioTrackId: {
        type: "string",
        description: "معرف المسار الصوتي المطلوب (إذا كان متاحاً)",
      },
      subtitleTrackId: {
        type: "string",
        description: "معرف مسار الترجمة المطلوب تفعيله",
      },
      subtitlesUrl: {
        type: "string",
        description: "رابط ملف الترجمة الخارجي (SRT أو VTT) إن وجد",
      },
      subtitleLanguage: {
        type: "string",
        description: "لغة ملف الترجمة (مثلاً ar أو en)",
      },
      posterUrl: {
        type: "string",
        description: "رابط الصورة المصغرة أو غلاف الفيديو",
      },
    },
    required: ["action"],
  },
  permissions: ["media:playback", "media:read"],
  timeout: 15000,
  cost: 1,
  supportsParallel: true,
  execute: async (args: MediaPlayerToolParams, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
    const action = args.action || "open_media";

    try {
      // 1. Search and resolve from Archive.org
      if (action === "search_archive" || (args.searchQuery && !args.url)) {
        const query = args.searchQuery || args.title || "";
        if (!query.trim()) {
          return {
            success: false,
            tool: "media_player",
            data: null,
            error: {
              code: "MISSING_SEARCH_QUERY",
              message: "يجب تحديد عبارة البحث (searchQuery) للبحث في أرشيف الإنترنت.",
              retryable: false,
            },
          };
        }

        const resolved = await ArchiveOrgProvider.searchAndResolveFirst(query, {
          mediaType: args.mediaTypeFilter || "movies",
          initialPositionSeconds: args.positionSeconds,
        });

        if (!resolved.success || !resolved.data) {
          return {
            success: false,
            tool: "media_player",
            data: null,
            error: {
              code: "ARCHIVE_SEARCH_FAILED",
              message: resolved.error || `تعذر العثور على وسائط قابلة للتشغيل تطابق "${query}" في Archive.org.`,
              retryable: false,
            },
          };
        }

        const playbackInfo: PlaybackInformation = resolved.data;

        // Check for saved resume position in database
        if (context.userId && (!args.positionSeconds || args.positionSeconds <= 0)) {
          try {
            const savedProgress = await WatchHistoryRepository.getProgress(context.userId, playbackInfo.mediaId);
            if (savedProgress && savedProgress.positionSeconds > 0 && !savedProgress.completed) {
              playbackInfo.initialPositionSeconds = savedProgress.positionSeconds;
            }
          } catch (err) {
            console.warn("[mediaPlayerTool] Failed to get watch history:", err);
          }
        }

        return {
          success: true,
          tool: "media_player",
          data: {
            action: "open_media",
            mediaPayload: playbackInfo,
            status: "ready",
            provider: "archive_org",
            message: `تم العثور على الوسائط في أرشيف الإنترنت وجاهزة للتشغيل: ${playbackInfo.title}${
              playbackInfo.durationSeconds ? ` (${Math.round(playbackInfo.durationSeconds / 60)} دقيقة)` : ""
            }${playbackInfo.initialPositionSeconds ? ` - استئناف من الدقيقة ${Math.floor(playbackInfo.initialPositionSeconds / 60)}` : ""}`,
          },
          widgetData: {
            type: "media_player",
            action: "open_media",
            payload: playbackInfo,
          },
          error: null,
        };
      }

      // 2. Open media from direct URL, Archive.org URL, or storage
      if (action === "open_media" || (args.url && !args.mediaId)) {
        if (!args.url) {
          return {
            success: false,
            tool: "media_player",
            data: null,
            error: {
              code: "MISSING_URL",
              message: "يجب تحديد رابط الوسائط (url) لفتح المشغل.",
              retryable: false,
            },
          };
        }

        const resolved = await MediaResolver.resolveMedia({
          url: args.url,
          title: args.title,
          initialPositionSeconds: args.positionSeconds,
          subtitlesUrl: args.subtitlesUrl,
          subtitleLanguage: args.subtitleLanguage,
          posterUrl: args.posterUrl,
        });

        if (!resolved.success || !resolved.data) {
          return {
            success: false,
            tool: "media_player",
            data: null,
            error: {
              code: "RESOLVE_FAILED",
              message: resolved.error || "تعذر معالجة رابط الوسائط المطلوب.",
              retryable: false,
            },
          };
        }

        const playbackInfo: PlaybackInformation = resolved.data;

        // Check for saved resume position in database
        if (context.userId && (!args.positionSeconds || args.positionSeconds <= 0)) {
          try {
            const savedProgress = await WatchHistoryRepository.getProgress(context.userId, playbackInfo.mediaId);
            if (savedProgress && savedProgress.positionSeconds > 0 && !savedProgress.completed) {
              playbackInfo.initialPositionSeconds = savedProgress.positionSeconds;
            }
          } catch (err) {
            console.warn("[mediaPlayerTool] Failed to get watch history:", err);
          }
        }

        return {
          success: true,
          tool: "media_player",
          data: {
            action: "open_media",
            mediaPayload: playbackInfo,
            status: "ready",
            message: `تم فتح المشغل بنجاح: ${playbackInfo.title}${
              playbackInfo.initialPositionSeconds ? ` (بدءاً من الدقيقة ${Math.floor(playbackInfo.initialPositionSeconds / 60)})` : ""
            }`,
          },
          widgetData: {
            type: "media_player",
            action: "open_media",
            payload: playbackInfo,
          },
          error: null,
        };
      }

      // Playback controls (seek, pause, play, volume, etc.)
      return {
        success: true,
        tool: "media_player",
        data: {
          action,
          mediaId: args.mediaId,
          url: args.url,
          positionSeconds: args.positionSeconds,
          volume: args.volume,
          qualityId: args.qualityId,
          audioTrackId: args.audioTrackId,
          subtitleTrackId: args.subtitleTrackId,
          status: "executed",
          message: `تم تطبيق أمر ${action} بنجاح`,
        },
        widgetData: {
          type: "media_player_control",
          action,
          params: args,
        },
        error: null,
      };
    } catch (err: any) {
      return {
        success: false,
        tool: "media_player",
        data: null,
        error: {
          code: "MEDIA_PLAYER_ERROR",
          message: err?.message || "حدث خطأ غير متوقع أثناء تنفيذ أداة مشغل الوسائط.",
          retryable: true,
        },
      };
    }
  },
};

