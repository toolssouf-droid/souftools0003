/**
 * SoufTools High-Performance Media Streaming Proxy
 * Proxies media streams with HTTP 206 Partial Content (Range requests) support,
 * permissive CORS, and automatic redirect resolution for Archive.org and external providers.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveAndValidatePublicUrl } from "@/lib/security/ssrfGuard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
      return new NextResponse("Missing 'url' query parameter", { status: 400 });
    }

    let parsed: URL | undefined;
    let redirectCountExceeded = false;
    let currentUrl = targetUrl;
    let upstreamResponse: Response | null = null;

    for (let redirectCount = 0; redirectCount <= 5; redirectCount++) {
      const validation = await resolveAndValidatePublicUrl(currentUrl);
      if (!validation.safe || !validation.url) {
        return new NextResponse(validation.error || "Forbidden host", { status: 403 });
      }
      parsed = validation.url;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        upstreamResponse = await fetch(parsed.toString(), {
          method: "GET",
          headers: {
            "User-Agent": "SoufToolsMediaProxy/1.0",
            Accept: "*/*",
            ...(req.headers.get("range") ? { Range: req.headers.get("range")! } : {}),
          },
          redirect: "manual",
          signal: controller.signal,
          cache: "no-store",
        });
      } finally {
        clearTimeout(timeout);
      }

      if ([301, 302, 303, 307, 308].includes(upstreamResponse.status)) {
        const location = upstreamResponse.headers.get("location");
        if (!location) break;
        currentUrl = new URL(location, parsed).toString();
        continue;
      }
      break;
    }

    if (!upstreamResponse || !parsed) {
      return new NextResponse("Failed to resolve media redirect", { status: 502 });
    }
    if (redirectCountExceeded) {
      return new NextResponse("Too many redirects", { status: 502 });
    }

    // Forward Range header if requested by the HTML5 video element
    const rangeHeader = req.headers.get("range");
    const upstreamHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "*/*",
    };

    if (rangeHeader) {
      upstreamHeaders["Range"] = rangeHeader;
    }

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      return new NextResponse(`Upstream media server returned ${upstreamResponse.status}`, {
        status: upstreamResponse.status,
      });
    }

    // Determine content type
    let contentType = upstreamResponse.headers.get("content-type") || "video/mp4";
    if (contentType.includes("text/html") || contentType.includes("application/json")) {
      // If server returned html, infer from filename extension
      if (parsed.pathname.endsWith(".mp4")) contentType = "video/mp4";
      else if (parsed.pathname.endsWith(".webm")) contentType = "video/webm";
      else if (parsed.pathname.endsWith(".mp3")) contentType = "audio/mpeg";
      else if (parsed.pathname.endsWith(".ogg") || parsed.pathname.endsWith(".ogv")) contentType = "video/ogg";
      else if (parsed.pathname.endsWith(".vtt")) contentType = "text/vtt";
      else if (parsed.pathname.endsWith(".srt")) contentType = "text/plain";
    }

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Range, Accept-Encoding, Origin");
    responseHeaders.set("Cache-Control", "public, max-age=86400, s-maxage=86400");

    const contentLength = upstreamResponse.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    const contentRange = upstreamResponse.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }

    const status = upstreamResponse.status === 206 ? 206 : 200;

    return new NextResponse(upstreamResponse.body as any, {
      status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("[Media Stream Proxy Error]:", error);
    return new NextResponse(error?.message || "Failed to stream media", { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Accept-Encoding, Origin",
    },
  });
}
