"use client";

/**
 * SoufTools Inline Media Player Component
 * Borderless, seamless, high-performance media player embedded directly inside the chat flow.
 * Supports Video/Audio, Subtitles (VTT/SRT), Adaptive Qualities, Double-tap Seek, PiP,
 * Keyboard Shortcuts, Smart Resume, and Real Event Bus.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture,
  RotateCcw,
  RotateCw,
  Subtitles,
  Settings,
  AlertCircle,
  Loader2,
  Check,
  FastForward,
  Film,
  Music,
} from "lucide-react";
import { PlaybackInformation, SubtitleCue, SubtitleSettings, RealPlayerEvent } from "@/lib/media/types";
import {
  formatMediaDuration,
  calculateBufferedPercentage,
  getSavedVolume,
  saveVolumePreference,
  WatchProgressSyncManager,
  getLocalResumePosition,
} from "@/lib/media/playbackEngine";
import { loadSubtitleTrack, getActiveCueAtTime, parseSubtitleContent } from "@/lib/media/subtitles/subtitleEngine";

interface InlineMediaPlayerProps {
  payload: PlaybackInformation;
  isRtl?: boolean;
  userId?: string;
  onEvent?: (event: RealPlayerEvent) => void;
}

export const InlineMediaPlayer: React.FC<InlineMediaPlayerProps> = ({
  payload,
  isRtl = true,
  userId,
  onEvent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  // Playback States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(payload.durationSeconds || 0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState<string | null>(null);

  // Volume States
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // View States
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Dynamic Stream Source, Proxy & Embed Fallback States
  const [currentUrl, setCurrentUrl] = useState<string>(payload.url);
  const [isUsingProxy, setIsUsingProxy] = useState<boolean>(false);
  const [isUsingEmbed, setIsUsingEmbed] = useState<boolean>(false);
  const [triedQualityIndex, setTriedQualityIndex] = useState<number>(0);

  // Settings & Track Menus
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSubtitlesMenuOpen, setIsSubtitlesMenuOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string>(
    payload.qualities?.[0]?.id || "auto"
  );
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>(
    payload.audioTracks?.[0]?.id || "default"
  );

  // Subtitle Engine States
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>({
    enabled: !!payload.subtitles?.length && !!payload.subtitles[0].isDefault,
    selectedTrackId: payload.subtitles?.[0]?.id || null,
    fontSize: "base",
    offsetSeconds: 0,
    backgroundColor: "semi",
    textColor: "#ffffff",
  });
  const [loadedCues, setLoadedCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);

  // Double tap seek animation indicators
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<{
    side: "left" | "right";
    active: boolean;
  } | null>(null);

  // Resume prompt state
  const [resumePrompt, setResumePrompt] = useState<{
    position: number;
    shown: boolean;
  } | null>(null);

  const isAudioOnly = payload.mediaType === "audio";

  // Emit event helper
  const emitPlayerEvent = useCallback(
    (type: RealPlayerEvent["type"], extra: Partial<RealPlayerEvent> = {}) => {
      const event: RealPlayerEvent = {
        type,
        mediaId: payload.mediaId,
        positionSeconds: videoRef.current?.currentTime || currentTime,
        durationSeconds: videoRef.current?.duration || duration,
        volume: videoRef.current?.volume ?? volume,
        isMuted: videoRef.current?.muted ?? isMuted,
        playbackRate: videoRef.current?.playbackRate ?? playbackRate,
        quality: selectedQuality,
        subtitleTrackId: subtitleSettings.enabled ? subtitleSettings.selectedTrackId : null,
        audioTrackId: selectedAudioTrack,
        timestamp: Date.now(),
        ...extra,
      };
      if (onEvent) {
        onEvent(event);
      }
    },
    [
      payload.mediaId,
      currentTime,
      duration,
      volume,
      isMuted,
      playbackRate,
      selectedQuality,
      subtitleSettings,
      selectedAudioTrack,
      onEvent,
    ]
  );

  // Initialize saved volume & resume position
  useEffect(() => {
    const saved = getSavedVolume();
    setVolume(saved.volume);
    setIsMuted(saved.isMuted);

    const initialPos = payload.initialPositionSeconds || getLocalResumePosition(payload.mediaId);
    if (initialPos > 10 && (!payload.durationSeconds || initialPos < payload.durationSeconds - 10)) {
      setResumePrompt({ position: initialPos, shown: true });
    }

    emitPlayerEvent("media.opened");
  }, [payload.mediaId, payload.initialPositionSeconds, payload.durationSeconds, emitPlayerEvent]);

  // Load Subtitles
  useEffect(() => {
    if (!subtitleSettings.enabled || !subtitleSettings.selectedTrackId) {
      setLoadedCues([]);
      setActiveCue(null);
      return;
    }

    const track = payload.subtitles?.find((s) => s.id === subtitleSettings.selectedTrackId);
    if (track && track.src) {
      loadSubtitleTrack(track.src).then((cues) => {
        setLoadedCues(cues);
      });
    }
  }, [subtitleSettings.enabled, subtitleSettings.selectedTrackId, payload.subtitles]);

  // Auto-hide controls timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isSettingsOpen && !isSubtitlesMenuOpen) {
          setShowControls(false);
        }
      }, 3200);
    }
  }, [isPlaying, isSettingsOpen, isSubtitlesMenuOpen]);

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          emitPlayerEvent("media.played");
        })
        .catch((err) => {
          console.warn("[MediaPlayer] Play error:", err);
        });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      emitPlayerEvent("media.paused");
    }
    resetControlsTimer();
  }, [emitPlayerEvent, resetControlsTimer]);

  // Seek relative (seconds)
  const seekRelative = useCallback(
    (deltaSeconds: number) => {
      if (!videoRef.current) return;
      const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + deltaSeconds));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      emitPlayerEvent("media.seeked", { positionSeconds: newTime });
      resetControlsTimer();
    },
    [emitPlayerEvent, resetControlsTimer]
  );

  // Direct Seek
  const seekTo = useCallback(
    (seconds: number) => {
      if (!videoRef.current) return;
      const clamped = Math.max(0, Math.min(videoRef.current.duration || 0, seconds));
      videoRef.current.currentTime = clamped;
      setCurrentTime(clamped);
      emitPlayerEvent("media.seeked", { positionSeconds: clamped });
    },
    [emitPlayerEvent]
  );

  // Handle Progress Bar Click / Drag
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = isRtl
      ? (rect.right - e.clientX) / rect.width
      : (e.clientX - rect.left) / rect.width;
    const targetSeconds = Math.max(0, Math.min(duration, pos * duration));
    seekTo(targetSeconds);
  };

  // Volume Change
  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    const muted = clamped === 0;
    setIsMuted(muted);
    if (videoRef.current) {
      videoRef.current.volume = clamped;
      videoRef.current.muted = muted;
    }
    saveVolumePreference(clamped, muted);
  };

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
    saveVolumePreference(volume, nextMuted);
  }, [isMuted, volume]);

  // Fullscreen Toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Picture in Picture Toggle
  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch (err) {
      console.warn("PiP error:", err);
    }
  };

  // Speed Rate Change
  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setIsSettingsOpen(false);
  };

  // Fullscreen event listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Keyboard Shortcuts (Desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      // Check if player container has focus or mouse hover
      if (!containerRef.current?.matches(":hover") && document.activeElement !== containerRef.current) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
        case "arrowleft":
          e.preventDefault();
          seekRelative(-10);
          break;
        case "l":
        case "arrowright":
          e.preventDefault();
          seekRelative(10);
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(volume + 0.1);
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(volume - 0.1);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "c":
          e.preventDefault();
          setSubtitleSettings((prev) => ({ ...prev, enabled: !prev.enabled }));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekRelative, volume, isMuted, toggleMute, toggleFullscreen]);

  // Touch double tap handler (Mobile)
  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    const touch = e.changedTouches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = touch.clientX - rect.left;
    const isLeft = x < rect.width / 2;

    if (now - lastTapRef.current.time < 300 && Math.abs(x - lastTapRef.current.x) < 50) {
      // Double tap detected
      const seekAmount = isLeft ? -10 : 10;
      seekRelative(seekAmount);
      setDoubleTapFeedback({
        side: isLeft ? "left" : "right",
        active: true,
      });
      setTimeout(() => setDoubleTapFeedback(null), 600);
      lastTapRef.current = { time: 0, x: 0 };
    } else {
      lastTapRef.current = { time: now, x };
      resetControlsTimer();
    }
  };

  // Video Time Update & Subtitle Sync
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    // Sync subtitle cue
    if (subtitleSettings.enabled && loadedCues.length > 0) {
      const cue = getActiveCueAtTime(loadedCues, cur, subtitleSettings.offsetSeconds);
      setActiveCue(cue);
    } else {
      setActiveCue(null);
    }

    // Sync progress to PostgreSQL throttled
    WatchProgressSyncManager.syncProgress(
      payload.mediaId,
      cur,
      videoRef.current.duration || duration,
      false,
      userId,
      {
        title: payload.title,
        posterUrl: payload.posterUrl,
        mediaType: payload.mediaType,
        url: payload.url,
        description: payload.description || payload.metadata?.description || "",
        overview: payload.description || payload.metadata?.overview || payload.metadata?.story || "",
        year: payload.metadata?.year || payload.metadata?.date,
        creator: payload.metadata?.creator,
        qualities: payload.qualities,
        identifier: payload.metadata?.identifier,
        ...payload.metadata,
      }
    );
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration;
    if (dur && !isNaN(dur)) {
      setDuration(dur);
    }
    setIsLoading(false);

    // Initial position seek if specified
    if (payload.initialPositionSeconds && payload.initialPositionSeconds > 0) {
      videoRef.current.currentTime = payload.initialPositionSeconds;
      setCurrentTime(payload.initialPositionSeconds);
    }
  };

  const handleProgress = () => {
    if (!videoRef.current) return;
    const pct = calculateBufferedPercentage(videoRef.current);
    setBufferedPercent(pct);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setShowControls(true);
    emitPlayerEvent("media.completed");
    WatchProgressSyncManager.syncProgress(
      payload.mediaId,
      duration,
      duration,
      true,
      userId,
      {
        title: payload.title,
        posterUrl: payload.posterUrl,
        mediaType: payload.mediaType,
        url: payload.url,
        description: payload.description || payload.metadata?.description || "",
        overview: payload.description || payload.metadata?.overview || payload.metadata?.story || "",
        year: payload.metadata?.year || payload.metadata?.date,
        creator: payload.metadata?.creator,
        qualities: payload.qualities,
        identifier: payload.metadata?.identifier,
        ...payload.metadata,
      }
    );
  };

  const archiveIdentifier = useMemo(() => {
    return (
      payload.metadata?.identifier ||
      (payload.mediaId.startsWith("arc_") ? payload.mediaId.replace(/^arc_/, "") : null)
    );
  }, [payload.metadata?.identifier, payload.mediaId]);

  const handleError = (e: any) => {
    setIsLoading(false);
    setIsBuffering(false);

    // 1. If direct URL failed and we haven't tried the streaming proxy yet, switch to streaming proxy!
    if (!isUsingProxy && currentUrl && !currentUrl.startsWith("/api/v1/media/stream")) {
      const proxyUrl = `/api/v1/media/stream?url=${encodeURIComponent(currentUrl)}`;
      console.info("[InlineMediaPlayer] Direct stream failed, switching to streaming proxy:", proxyUrl);
      setIsUsingProxy(true);
      setCurrentUrl(proxyUrl);
      setHasError(null);
      setIsLoading(true);
      if (videoRef.current) {
        const curTime = currentTime;
        videoRef.current.src = proxyUrl;
        videoRef.current.load();
        if (curTime > 0) videoRef.current.currentTime = curTime;
        videoRef.current.play().catch(() => {});
      }
      return;
    }

    // 2. If proxy also failed, try next available quality/format from payload.qualities
    if (payload.qualities && triedQualityIndex < payload.qualities.length - 1) {
      const nextIdx = triedQualityIndex + 1;
      const nextQuality = payload.qualities[nextIdx];
      if (nextQuality && nextQuality.url) {
        console.info(`[InlineMediaPlayer] Trying alternative stream quality [${nextQuality.label}]:`, nextQuality.url);
        setTriedQualityIndex(nextIdx);
        setSelectedQuality(nextQuality.id);
        setIsUsingProxy(false);
        setCurrentUrl(nextQuality.url);
        setHasError(null);
        setIsLoading(true);
        if (videoRef.current) {
          const curTime = currentTime;
          videoRef.current.src = nextQuality.url;
          videoRef.current.load();
          if (curTime > 0) videoRef.current.currentTime = curTime;
          videoRef.current.play().catch(() => {});
        }
        return;
      }
    }

    // 3. If direct and proxy fail, automatically try Archive embed fallback if identifier exists
    if (archiveIdentifier && !isUsingEmbed) {
      console.info("[InlineMediaPlayer] Native stream failed, automatically switching to Archive.org embed:", archiveIdentifier);
      setIsUsingEmbed(true);
      setIsLoading(false);
      setHasError(null);
      return;
    }

    // 4. If all streams fail, display clear options including inline Archive.org embed
    const errorMsg = videoRef.current?.error?.message || "تعذر تحميل ملف الوسائط بسبب قيود التنسيق أو المتصفح.";
    setHasError(errorMsg);
    emitPlayerEvent("media.error", { error: errorMsg });
  };

  const progressPercent = useMemo(() => {
    if (!duration || duration <= 0) return 0;
    return Math.min(100, (currentTime / duration) * 100);
  }, [currentTime, duration]);

  return (
    <div
      ref={containerRef}
      id={`media-player-${payload.mediaId}`}
      dir={isRtl ? "rtl" : "ltr"}
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full select-none overflow-hidden rounded-xl bg-[#070c0c] font-sans text-[#e8f5f5] transition-all duration-200 ${
        isFullscreen
          ? "fixed inset-0 z-50 flex h-screen w-screen items-center justify-center rounded-none"
          : isAudioOnly
          ? "py-3 px-4 bg-[#0a1212] border border-[#00d4aa]/20 shadow-lg"
          : "aspect-video max-h-[72vh] min-h-[220px]"
      }`}
    >
      {/* 1. Archive.org Embed Fallback Iframe (if enabled) */}
      {isUsingEmbed && archiveIdentifier ? (
        <iframe
          src={`https://archive.org/embed/${archiveIdentifier}?autoplay=1`}
          title={payload.title}
          allow="fullscreen; autoplay; picture-in-picture; encrypted-media"
          className="h-full w-full border-0 bg-black"
        />
      ) : (
        /* HTML5 Video / Audio Element */
        <video
          ref={videoRef}
          src={currentUrl}
          poster={payload.poster}
          playsInline
          autoPlay
          crossOrigin="anonymous"
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onProgress={handleProgress}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
          }}
          onEnded={handleEnded}
          onError={handleError}
          onClick={togglePlay}
          className={`h-full w-full object-contain ${isAudioOnly ? "hidden" : "cursor-pointer"}`}
        />
      )}

      {/* 2. Audio-only visualizer banner */}
      {isAudioOnly && (
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#00d4aa]/15 text-[#00d4aa]">
            <Music className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-bold text-[#e8f5f5]">{payload.title}</h4>
            <p className="text-xs text-[#8db3b3]">تسجيل صوتي • {formatMediaDuration(duration)}</p>
          </div>
        </div>
      )}

      {/* 3. Subtitles Overlay */}
      {subtitleSettings.enabled && activeCue && !isAudioOnly && (
        <div className="pointer-events-none absolute bottom-16 left-0 right-0 z-20 flex justify-center px-4 text-center">
          <div
            className={`max-w-[85%] rounded px-3 py-1 font-medium transition-all ${
              subtitleSettings.fontSize === "sm"
                ? "text-xs"
                : subtitleSettings.fontSize === "lg"
                ? "text-lg"
                : subtitleSettings.fontSize === "xl"
                ? "text-xl font-bold"
                : "text-sm sm:text-base"
            } ${
              subtitleSettings.backgroundColor === "dark"
                ? "bg-black/90 text-white"
                : subtitleSettings.backgroundColor === "transparent"
                ? "text-white [text-shadow:_0_2px_4px_rgba(0,0,0,0.9)]"
                : "bg-black/60 text-white backdrop-blur-xs"
            }`}
            style={{ color: subtitleSettings.textColor }}
          >
            {activeCue.text}
          </div>
        </div>
      )}

      {/* 4. Loading / Buffering Indicator */}
      {(isLoading || isBuffering) && !hasError && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-xs">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-[#00d4aa]" />
            <span className="text-xs font-medium text-[#8db3b3]">
              {isLoading ? "جاري تجهيز المشغل..." : "جاري التحميل المؤقت..."}
            </span>
          </div>
        </div>
      )}

      {/* 5. Error State */}
      {hasError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#0c1414]/95 p-6 text-center backdrop-blur-sm">
          <AlertCircle className="h-10 w-10 text-[#ef4444]" />
          <p className="max-w-md text-sm text-[#e8f5f5]">{hasError}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setHasError(null);
                setIsLoading(true);
                if (videoRef.current) {
                  videoRef.current.src = currentUrl;
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="flex items-center gap-1.5 rounded-lg bg-[#00d4aa] px-4 py-2 text-xs font-bold text-[#0a0f0f] transition-all hover:opacity-90 shadow-md"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>إعادة المحاولة</span>
            </button>

            {/* Archive.org Embed Fallback Button */}
            {archiveIdentifier && !isUsingEmbed && (
              <button
                type="button"
                onClick={() => {
                  setHasError(null);
                  setIsUsingEmbed(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#142323] border border-[#00d4aa]/40 px-3.5 py-2 text-xs font-semibold text-[#e8f5f5] transition-all hover:bg-[#00d4aa]/15"
              >
                <Play className="h-3.5 w-3.5 text-[#00d4aa]" />
                <span>تشغيل عبر مشغل الأرشيف المدمج</span>
              </button>
            )}

            {/* Alternative Qualities Try Button */}
            {payload.qualities && payload.qualities.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const nextIdx = (triedQualityIndex + 1) % payload.qualities.length;
                  const nextQ = payload.qualities[nextIdx];
                  if (nextQ) {
                    setTriedQualityIndex(nextIdx);
                    setSelectedQuality(nextQ.id);
                    setIsUsingProxy(false);
                    setCurrentUrl(nextQ.url);
                    setHasError(null);
                    setIsLoading(true);
                    if (videoRef.current) {
                      videoRef.current.src = nextQ.url;
                      videoRef.current.load();
                      videoRef.current.play().catch(() => {});
                    }
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-[#e8f5f5] transition-all hover:bg-white/15"
              >
                <span>تجربة جودة/بث بديل ({payload.qualities.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 6. Smart Resume Prompt Banner */}
      {resumePrompt?.shown && !isPlaying && currentTime < 5 && (
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between rounded-lg bg-[#0b1414]/90 border border-[#00d4aa]/30 px-3 py-2 text-xs backdrop-blur-md">
          <span className="text-[#e8f5f5]">
            توقفت سابقاً عند الدقيقة <strong>{formatMediaDuration(resumePrompt.position)}</strong>. هل تود الاستئناف؟
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                seekTo(resumePrompt.position);
                setResumePrompt(null);
                togglePlay();
              }}
              className="rounded bg-[#00d4aa] px-2.5 py-1 font-bold text-[#0a0f0f] hover:opacity-90"
            >
              استئناف
            </button>
            <button
              type="button"
              onClick={() => setResumePrompt(null)}
              className="rounded border border-[#1e2e2e] px-2 py-1 text-[#8db3b3] hover:text-[#e8f5f5]"
            >
              تجاهل
            </button>
          </div>
        </div>
      )}

      {/* 7. Double Tap Seek Feedback Ripple */}
      {doubleTapFeedback?.active && (
        <div
          className={`pointer-events-none absolute inset-y-0 z-30 flex w-1/3 items-center justify-center bg-[#00d4aa]/15 backdrop-blur-xs transition-opacity ${
            doubleTapFeedback.side === "left" ? "left-0" : "right-0"
          }`}
        >
          <div className="flex flex-col items-center gap-1 text-[#00d4aa]">
            {doubleTapFeedback.side === "left" ? (
              <>
                <RotateCcw className="h-7 w-7 animate-pulse" />
                <span className="text-xs font-bold">-10s</span>
              </>
            ) : (
              <>
                <RotateCw className="h-7 w-7 animate-pulse" />
                <span className="text-xs font-bold">+10s</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 8. Floating Modern Minimal Controls */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-8 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* Progress / Seek Timeline Bar */}
        <div
          ref={progressBarRef}
          onClick={handleProgressBarClick}
          className="group relative mb-2.5 flex h-2 w-full cursor-pointer items-center rounded-full bg-white/20 transition-all hover:h-3"
        >
          {/* Buffered Track */}
          <div
            className="absolute inset-y-0 start-0 rounded-full bg-white/30"
            style={{ width: `${bufferedPercent}%` }}
          />

          {/* Played Track */}
          <div
            className="absolute inset-y-0 start-0 rounded-full bg-[#00d4aa]"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Scrubber Handle */}
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[#00d4aa] opacity-0 shadow-[0_0_8px_#00d4aa] transition-opacity group-hover:opacity-100"
            style={{
              [isRtl ? "right" : "left"]: `calc(${progressPercent}% - 7px)`,
            }}
          />
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between gap-2">
          {/* Left Controls (Play/Pause, Seek buttons, Time) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#00d4aa] text-[#0a0f0f] transition-transform hover:scale-105 active:scale-95"
              title={isPlaying ? "إيقاف مؤقت (Space)" : "تشغيل (Space)"}
            >
              {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current translate-x-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => seekRelative(-10)}
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-[#8db3b3] hover:bg-white/10 hover:text-[#e8f5f5]"
              title="رجوع 10 ثوانٍ (J / ArrowLeft)"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => seekRelative(10)}
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-[#8db3b3] hover:bg-white/10 hover:text-[#e8f5f5]"
              title="تقديم 10 ثوانٍ (L / ArrowRight)"
            >
              <RotateCw className="h-4 w-4" />
            </button>

            {/* Time Indicator */}
            <div className="text-xs font-mono text-[#8db3b3] ms-1">
              <span className="text-[#e8f5f5] font-semibold">{formatMediaDuration(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatMediaDuration(duration)}</span>
            </div>
          </div>

          {/* Right Controls (Volume, Subtitles, Quality, PiP, Fullscreen) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Volume Slider */}
            <div className="group relative flex items-center">
              <button
                type="button"
                onClick={toggleMute}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8db3b3] hover:bg-white/10 hover:text-[#e8f5f5]"
                title="كتم / تشغيل الصوت (M)"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4 text-[#ef4444]" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>

              <div className="hidden sm:flex w-0 items-center overflow-hidden transition-all duration-200 group-hover:w-20 group-hover:ms-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/20 accent-[#00d4aa]"
                />
              </div>
            </div>

            {/* Subtitle Button & Selector */}
            {payload.subtitles && payload.subtitles.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSubtitlesMenuOpen(!isSubtitlesMenuOpen)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    subtitleSettings.enabled
                      ? "bg-[#00d4aa]/20 text-[#00d4aa]"
                      : "text-[#8db3b3] hover:bg-white/10 hover:text-[#e8f5f5]"
                  }`}
                  title="الترجمة والشرح (C)"
                >
                  <Subtitles className="h-4 w-4" />
                </button>

                {/* Subtitle Menu Popup */}
                {isSubtitlesMenuOpen && (
                  <div className="absolute bottom-11 end-0 z-40 min-w-[200px] rounded-xl border border-[#1e2e2e] bg-[#0c1414] p-2 shadow-2xl backdrop-blur-md">
                    <div className="border-b border-[#1e2e2e] pb-1.5 mb-1.5 text-[11px] font-bold text-[#8db3b3]">
                      خيارات الترجمة
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSubtitleSettings((prev) => ({ ...prev, enabled: false }));
                        setIsSubtitlesMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-[#e8f5f5] hover:bg-[#00d4aa]/10"
                    >
                      <span>إيقاف الترجمة</span>
                      {!subtitleSettings.enabled && <Check className="h-3.5 w-3.5 text-[#00d4aa]" />}
                    </button>
                    {payload.subtitles.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          setSubtitleSettings((prev) => ({
                            ...prev,
                            enabled: true,
                            selectedTrackId: sub.id,
                          }));
                          setIsSubtitlesMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-[#e8f5f5] hover:bg-[#00d4aa]/10"
                      >
                        <span>{sub.label}</span>
                        {subtitleSettings.enabled && subtitleSettings.selectedTrackId === sub.id && (
                          <Check className="h-3.5 w-3.5 text-[#00d4aa]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Playback Settings (Speed, Quality) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8db3b3] hover:bg-white/10 hover:text-[#e8f5f5]"
                title="الإعدادات والسرعة"
              >
                <Settings className="h-4 w-4" />
              </button>

              {isSettingsOpen && (
                <div className="absolute bottom-11 end-0 z-40 min-w-[210px] rounded-xl border border-[#1e2e2e] bg-[#0c1414] p-2.5 shadow-2xl backdrop-blur-md">
                  {/* Speed Section */}
                  <div className="mb-2 text-[11px] font-bold text-[#8db3b3]">سرعة التشغيل</div>
                  <div className="grid grid-cols-4 gap-1 mb-3">
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                      <button
                        key={`rate-${rate}`}
                        type="button"
                        onClick={() => handleSpeedChange(rate)}
                        className={`rounded py-1 text-center text-xs font-mono transition-colors ${
                          playbackRate === rate
                            ? "bg-[#00d4aa] text-[#0a0f0f] font-bold"
                            : "bg-white/5 text-[#e8f5f5] hover:bg-white/10"
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>

                  {/* Quality Section (Only if multi-quality available) */}
                  {payload.qualities && payload.qualities.length > 1 && (
                    <>
                      <div className="border-t border-[#1e2e2e] pt-2 mb-1.5 text-[11px] font-bold text-[#8db3b3]">
                        جودة الفيديو
                      </div>
                      {payload.qualities.map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => {
                            setSelectedQuality(q.id);
                            setCurrentUrl(q.url);
                            setIsUsingProxy(false);
                            setHasError(null);
                            setIsLoading(true);
                            if (videoRef.current) {
                              const cur = videoRef.current.currentTime;
                              videoRef.current.src = q.url;
                              videoRef.current.load();
                              if (cur > 0) videoRef.current.currentTime = cur;
                              if (isPlaying) videoRef.current.play().catch(() => {});
                            }
                            setIsSettingsOpen(false);
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs text-[#e8f5f5] hover:bg-[#00d4aa]/10"
                        >
                          <span>{q.label}</span>
                          {selectedQuality === q.id && <Check className="h-3.5 w-3.5 text-[#00d4aa]" />}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Picture-in-Picture (PiP) */}
            {!isAudioOnly && (
              <button
                type="button"
                onClick={togglePiP}
                className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg text-[#8db3b3] hover:bg-white/10 hover:text-[#e8f5f5]"
                title="صورة داخل صورة (PiP)"
              >
                <PictureInPicture className="h-4 w-4" />
              </button>
            )}

            {/* Fullscreen Toggle */}
            {!isAudioOnly && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8db3b3] hover:bg-white/10 hover:text-[#e8f5f5]"
                title="ملء الشاشة (F)"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
