import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely copy text to clipboard with automatic fallback for iframes / denied permissions / unfocused document
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Clipboard API if document is currently focused
  const isDocFocused = typeof document !== "undefined" && typeof document.hasFocus === "function" ? document.hasFocus() : true;

  if (isDocFocused && typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // 2. Fallback using temporary textarea (works reliably inside iframes and without strict window focus)
  try {
    if (typeof document !== "undefined" && document.body) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      textArea.setAttribute("readonly", "");
      document.body.appendChild(textArea);
      textArea.focus({ preventScroll: true });
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) return true;
    }
  } catch {
    // Ignored safely
  }

  // 3. Fallback attempt with modern API only if document is focused
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      if (typeof window !== "undefined") {
        window.focus();
      }
      if (typeof document !== "undefined" && typeof document.hasFocus === "function" && document.hasFocus()) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Ignored safely
    }
  }

  return false;
}

/**
 * Downloads an image from a URL or base64 data string safely
 */
export async function downloadImage(url: string, filename = `soufimage_${Date.now()}.png`) {
  if (!url) return;
  try {
    if (url.startsWith("data:")) {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    const response = await fetch(url, { mode: "cors" });
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.warn("Direct blob download failed, fallback to download link / new tab", err);
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.download = filename;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Safely converts any Date, string, number, or unknown object into a valid ISO string.
 * Prevents "val.toISOString is not a function" errors when values are retrieved
 * from JSON stores, memory engines, or string serialized states.
 */
export function toIsoDateString(val?: any, fallback?: string): string {
  if (val === null || val === undefined) {
    return fallback !== undefined ? fallback : new Date().toISOString();
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? (fallback !== undefined ? fallback : new Date().toISOString()) : val.toISOString();
  }
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
    return val;
  }
  if (typeof val === "number") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return fallback !== undefined ? fallback : new Date().toISOString();
}

export function safeToIsoDate(val?: any): string | null {
  if (val === null || val === undefined) return null;
  return toIsoDateString(val);
}
