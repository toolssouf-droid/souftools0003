/**
 * SoufTools Media Architecture Types
 * Pure TypeScript contracts for Media Items, Resolvers, Adapters,
 * Playback States, Subtitle Engine, and Player Event Bus.
 */

export type MediaType = "video" | "audio" | "stream" | "adaptive";

export interface MediaQualityLevel {
  id: string;
  label: string; // e.g. "1080p", "720p", "480p", "Auto"
  width?: number;
  height?: number;
  bitrate?: number; // bps
  url: string;
}

export interface MediaAudioTrack {
  id: string;
  label: string;
  language: string; // ISO 639-1 code or name e.g. "ar", "en"
  kind?: "main" | "dub" | "commentary" | "description";
  isDefault?: boolean;
}

export interface MediaSubtitleTrack {
  id: string;
  label: string;
  language: string;
  src: string; // VTT or SRT URL, or data URI
  format: "vtt" | "srt";
  isDefault?: boolean;
}

export interface SubtitleCue {
  id: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface SubtitleSettings {
  enabled: boolean;
  selectedTrackId: string | null;
  fontSize: "sm" | "base" | "lg" | "xl";
  offsetSeconds: number; // Timing offset (+/- seconds)
  backgroundColor: "transparent" | "semi" | "dark";
  textColor: string;
}

export interface PlaybackInformation {
  mediaId: string;
  title: string;
  description?: string;
  url: string;
  poster?: string;
  posterUrl?: string;
  durationSeconds?: number;
  initialPositionSeconds?: number;
  mediaType: MediaType;
  mimeType?: string;
  qualities: MediaQualityLevel[];
  audioTracks: MediaAudioTrack[];
  subtitles: MediaSubtitleTrack[];
  sourceProvider: "direct" | "storage" | "youtube" | "vimeo" | "hls" | "archive_org" | "custom";
  isLive?: boolean;
  canSeek?: boolean;
  metadata?: Record<string, any>;
}

export interface RealPlayerEvent {
  type:
    | "media.opened"
    | "media.played"
    | "media.paused"
    | "media.seeked"
    | "media.progress"
    | "media.quality_changed"
    | "media.subtitle_changed"
    | "media.audio_changed"
    | "media.completed"
    | "media.error";
  mediaId: string;
  positionSeconds: number;
  durationSeconds: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  quality?: string;
  subtitleTrackId?: string | null;
  audioTrackId?: string | null;
  error?: string;
  timestamp: number;
}

export interface WatchHistoryRecord {
  id: string;
  userId: string;
  mediaId: string;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  lastWatchedAt: string | Date;
  metadata?: Record<string, any>;
}

export interface MediaPlayerToolParams {
  action:
    | "open_media"
    | "search_archive"
    | "play_media"
    | "pause_media"
    | "seek_media"
    | "set_volume"
    | "set_quality"
    | "set_audio_track"
    | "set_subtitle"
    | "get_media_info"
    | "get_playback_position"
    | "get_available_tracks";
  searchQuery?: string;
  mediaTypeFilter?: "movies" | "audio" | "all";
  url?: string;
  mediaId?: string;
  title?: string;
  positionSeconds?: number;
  volume?: number; // 0 to 1
  qualityId?: string;
  audioTrackId?: string;
  subtitleTrackId?: string;
  subtitlesUrl?: string;
  subtitleLanguage?: string;
  posterUrl?: string;
}

export interface MediaPlayerToolResult {
  success: boolean;
  action: string;
  mediaPayload?: PlaybackInformation;
  currentState?: {
    mediaId?: string;
    positionSeconds?: number;
    durationSeconds?: number;
    isPlaying?: boolean;
    volume?: number;
    activeSubtitleTrack?: string | null;
    activeQuality?: string | null;
  };
  message?: string;
  error?: string;
}
