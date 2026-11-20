/**
 * SoufTools SSRF Protection Guard
 * Validates outgoing URLs to prevent Server-Side Request Forgery against internal networks.
 */

import { URL } from "url";
import dns from "node:dns/promises";

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

    function isPrivateIpv4(hostname: string): boolean {
      const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      if (!match) return false;
      const octets = match.slice(1).map(Number);
      if (octets.some((value) => value > 255)) return false;
      const [a, b] = octets;
      return (
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 198 && (b === 18 || b === 19)) ||
        (a === 192 && b === 0)
      );
    }

    function isPrivateIpv6(hostname: string): boolean {
      const value = hostname.toLowerCase().replace(/^\[|\]$/g, "");
      if (!value.includes(":")) return false;
      return (
        value === "::" ||
        value === "::1" ||
        value.startsWith("fc") ||
        value.startsWith("fd") ||
        value.startsWith("fe8") ||
        value.startsWith("fe9") ||
        value.startsWith("fea") ||
        value.startsWith("feb") ||
        value.startsWith("::ffff:127.") ||
        value.startsWith("::ffff:10.") ||
        value.startsWith("::ffff:169.254.") ||
        value.startsWith("::ffff:192.168.")
      );
    }

    export async function resolveAndValidatePublicUrl(
      urlString: string
    ): Promise<{ safe: boolean; error?: string; url?: URL }> {
      let parsed: URL;
      try {
        parsed = new URL(urlString);
      } catch {
        return { safe: false, error: "Invalid URL string" };
      }

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { safe: false, error: "Only HTTP and HTTPS protocols are permitted" };
      }
      if (parsed.username || parsed.password) {
        return { safe: false, error: "Credentials in URLs are forbidden" };
      }
      if (parsed.port && !["80", "443", ""].includes(parsed.port)) {
        return { safe: false, error: "Only ports 80 and 443 are permitted" };
      }

      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === "localhost" ||
        hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") ||
        hostname.endsWith(".internal") ||
        isPrivateIpv4(hostname) ||
        isPrivateIpv6(hostname)
      ) {
        return { safe: false, error: "Access to loopback/internal hosts is forbidden" };
      }

      if (/^[a-fA-F0-9:.]+:[a-fA-F0-9:.]*$/.test(hostname) || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
        if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
          return { safe: false, error: "Private IP addresses are forbidden" };
        }
      } else {
        try {
          const addresses = await dns.lookup(hostname, { verbatim: true, all: true });
          if (!addresses.length) return { safe: false, error: "Hostname did not resolve" };
          for (const address of addresses) {
            const value = address.address;
            if (isPrivateIpv4(value) || isPrivateIpv6(value)) {
              return { safe: false, error: "Hostname resolves to a private address" };
            }
          }
        } catch {
          return { safe: false, error: "Hostname resolution failed" };
        }
      }

      return { safe: true, url: parsed };
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
