/**
 * SoufTools Playback Engine Utilities
 * Real-time client-side performance, buffer estimation, network monitoring,
 * touch gestures, and throttled database synchronization.
 */

import { RealPlayerEvent } from "./types";

export interface NetworkSpeedMetrics {
  bandwidthEstimateKbps: number;
  rttMs: number;
  effectiveType: "slow-2g" | "2g" | "3g" | "4g";
}

/**
 * Measures effective network conditions using Network Information API if available
 */
export function getNetworkMetrics(): NetworkSpeedMetrics {
  if (typeof navigator !== "undefined" && "connection" in navigator) {
    const conn = (navigator as any).connection;
    return {
      bandwidthEstimateKbps: conn?.downlink ? conn.downlink * 1000 : 10000,
      rttMs: conn?.rtt || 50,
      effectiveType: conn?.effectiveType || "4g",
    };
  }
  return {
    bandwidthEstimateKbps: 10000,
    rttMs: 50,
    effectiveType: "4g",
  };
}

/**
 * Calculates buffered percentage from HTMLMediaElement
 */
export function calculateBufferedPercentage(media: HTMLMediaElement): number {
  if (!media || !media.duration || media.duration <= 0) return 0;
  const buffered = media.buffered;
  if (buffered.length === 0) return 0;

  const currentTime = media.currentTime;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= currentTime && currentTime <= buffered.end(i)) {
      return (buffered.end(i) / media.duration) * 100;
    }
  }
  // If not currently in a range, return the furthest loaded end
  return (buffered.end(buffered.length - 1) / media.duration) * 100;
}

/**
 * Formats seconds into human-readable time (e.g. 01:23 or 01:15:30)
 */
export function formatMediaDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "00:00";
  const sec = Math.floor(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Local fast cache for resume position
 */
const RESUME_KEY_PREFIX = "souf_media_pos_";
const VOLUME_KEY = "souf_media_volume";
const MUTED_KEY = "souf_media_muted";

export function getLocalResumePosition(mediaId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const val = localStorage.getItem(`${RESUME_KEY_PREFIX}${mediaId}`);
    return val ? parseFloat(val) || 0 : 0;
  } catch {
    return 0;
  }
}

export function saveLocalResumePosition(mediaId: string, positionSeconds: number): void {
  if (typeof window === "undefined" || !mediaId) return;
  try {
    localStorage.setItem(`${RESUME_KEY_PREFIX}${mediaId}`, positionSeconds.toString());
  } catch {}
}

export function getSavedVolume(): { volume: number; isMuted: boolean } {
  if (typeof window === "undefined") return { volume: 1, isMuted: false };
  try {
    const vol = localStorage.getItem(VOLUME_KEY);
    const muted = localStorage.getItem(MUTED_KEY);
    return {
      volume: vol !== null ? parseFloat(vol) : 1,
      isMuted: muted === "true",
    };
  } catch {
    return { volume: 1, isMuted: false };
  }
}

export function saveVolumePreference(volume: number, isMuted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VOLUME_KEY, volume.toString());
    localStorage.setItem(MUTED_KEY, isMuted ? "true" : "false");
  } catch {}
}

/**
 * Throttled Watch Progress Synchronizer to PostgreSQL Backend
 */
export class WatchProgressSyncManager {
  private static syncTimers: Map<string, NodeJS.Timeout> = new Map();
  private static lastSentPosition: Map<string, number> = new Map();

  public static syncProgress(
    mediaId: string,
    positionSeconds: number,
    durationSeconds: number,
    completed: boolean = false,
    userId?: string,
    metadata?: Record<string, any>
  ) {
    if (!mediaId || typeof window === "undefined") return;

    // Save locally immediately for fast resume
    saveLocalResumePosition(mediaId, positionSeconds);

    // Save local metadata cache
    if (metadata && Object.keys(metadata).length > 0) {
      try {
        localStorage.setItem(`souf_media_meta_${mediaId}`, JSON.stringify({
          mediaId,
          positionSeconds: Math.floor(positionSeconds),
          durationSeconds: Math.floor(durationSeconds || 0),
          completed,
          lastWatchedAt: new Date().toISOString(),
          metadata,
        }));
      } catch {}
    }

    const lastPos = this.lastSentPosition.get(mediaId) || 0;
    // Don't spam backend if position hasn't changed by at least 3 seconds (unless completed)
    if (!completed && Math.abs(positionSeconds - lastPos) < 3) {
      return;
    }

    // Debounce backend request by 2.5 seconds
    if (this.syncTimers.has(mediaId)) {
      clearTimeout(this.syncTimers.get(mediaId)!);
    }

    const timer = setTimeout(async () => {
      this.syncTimers.delete(mediaId);
      this.lastSentPosition.set(mediaId, positionSeconds);

      try {
        await fetch("/api/v1/media/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaId,
            positionSeconds: Math.floor(positionSeconds),
            durationSeconds: Math.floor(durationSeconds || 0),
            completed,
            userId,
            metadata: metadata || {},
          }),
        });
      } catch (err) {
        // Silently handle offline/network sync failure
      }
    }, completed ? 100 : 2500);

    this.syncTimers.set(mediaId, timer);
  }
}
