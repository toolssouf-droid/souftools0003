/**
 * SoufTools Subtitle Engine
 * Pure client-side, zero-dependency SRT & WebVTT parser, synchronizer, and cue extractor.
 * High-speed, lightweight, supports timing offset and styling parameters.
 */

import { SubtitleCue } from "../types";

/**
 * Parses timestamp string (SRT: 00:01:23,456 or VTT: 00:01:23.456 / 01:23.456) to seconds
 */
export function parseSubtitleTimestamp(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace(",", ".");
  const parts = clean.split(":");
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 3) {
    hours = parseFloat(parts[0]) || 0;
    minutes = parseFloat(parts[1]) || 0;
    seconds = parseFloat(parts[2]) || 0;
  } else if (parts.length === 2) {
    minutes = parseFloat(parts[0]) || 0;
    seconds = parseFloat(parts[1]) || 0;
  } else {
    seconds = parseFloat(parts[0]) || 0;
  }

  return Math.max(0, hours * 3600 + minutes * 60 + seconds);
}

/**
 * Parses raw WebVTT or SRT text into an array of SubtitleCue objects
 */
export function parseSubtitleContent(rawText: string, format: "vtt" | "srt" = "vtt"): SubtitleCue[] {
  if (!rawText || !rawText.trim()) return [];

  const cues: SubtitleCue[] = [];
  // Normalize line endings
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n\n+/);

  let cueIndex = 0;

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length === 0) continue;

    // Check if this is the WEBVTT header or NOTE block
    if (lines[0].startsWith("WEBVTT") || lines[0].startsWith("NOTE")) {
      continue;
    }

    let timeLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timeLineIndex = i;
        break;
      }
    }

    if (timeLineIndex === -1) continue;

    const timeLine = lines[timeLineIndex];
    const timeMatch = timeLine.match(/((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{2,3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{2,3})/);
    if (!timeMatch) continue;

    const startTime = parseSubtitleTimestamp(timeMatch[1]);
    const endTime = parseSubtitleTimestamp(timeMatch[2]);
    if (endTime <= startTime) continue;

    const textLines = lines.slice(timeLineIndex + 1);
    // Strip HTML/VTT tags like <v Voice>, <c.color>, <b>, <i> while keeping line breaks
    const cleanText = textLines
      .join("\n")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!cleanText) continue;

    cueIndex++;
    cues.push({
      id: `cue_${cueIndex}`,
      startTime,
      endTime,
      text: cleanText,
    });
  }

  return cues.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Fetches and parses a remote subtitle file (VTT or SRT)
 */
export async function loadSubtitleTrack(url: string): Promise<SubtitleCue[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[SubtitleEngine] Failed to fetch subtitle at ${url}: ${res.status}`);
      return [];
    }
    const text = await res.text();
    const isVtt = url.endsWith(".vtt") || text.startsWith("WEBVTT");
    return parseSubtitleContent(text, isVtt ? "vtt" : "srt");
  } catch (err) {
    console.warn("[SubtitleEngine] Error fetching subtitles:", err);
    return [];
  }
}

/**
 * Finds the active subtitle cue at a given playback time in seconds, accounting for timing offset.
 */
export function getActiveCueAtTime(
  cues: SubtitleCue[],
  currentTimeSeconds: number,
  offsetSeconds: number = 0
): SubtitleCue | null {
  if (!cues || cues.length === 0) return null;

  const adjustedTime = currentTimeSeconds - offsetSeconds;
  if (adjustedTime < 0) return null;

  // Simple and fast linear search for small lists, or binary search for larger lists
  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (adjustedTime >= cue.startTime && adjustedTime <= cue.endTime) {
      return cue;
    }
    if (cue.startTime > adjustedTime) {
      // Since cues are sorted, if startTime is past current time, no need to continue
      break;
    }
  }

  return null;
}
