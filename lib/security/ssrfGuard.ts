/**
 * SoufTools SSRF Protection Guard
 * Validates outgoing URLs to prevent Server-Side Request Forgery against internal networks.
 */

import { URL } from "url";

const FORBIDDEN_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254", // Cloud metadata endpoint
  "metadata.google.internal",
]);

export function isSafePublicUrl(urlString: string): { safe: boolean; error?: string } {
  try {
    const parsed = new URL(urlString);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { safe: false, error: "Only HTTP and HTTPS protocols are permitted" };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (FORBIDDEN_HOSTS.has(hostname)) {
      return { safe: false, error: "Access to loopback/internal hosts is strictly forbidden" };
    }

    // Check private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipv4Match) {
      const b0 = parseInt(ipv4Match[1], 10);
      const b1 = parseInt(ipv4Match[2], 10);

      if (b0 === 10) return { safe: false, error: "Private IP ranges are forbidden" };
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return { safe: false, error: "Private IP ranges are forbidden" };
      if (b0 === 192 && b1 === 168) return { safe: false, error: "Private IP ranges are forbidden" };
      if (b0 === 127 || b0 === 0) return { safe: false, error: "Loopback addresses are forbidden" };
    }

    return { safe: true };
  } catch {
    return { safe: false, error: "Invalid URL string" };
  }
}
