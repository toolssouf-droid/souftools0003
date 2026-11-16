/**
 * SoufTools High-Performance Media Streaming Proxy
 * Proxies media streams with HTTP 206 Partial Content (Range requests) support,
 * permissive CORS, and automatic redirect resolution for Archive.org and external providers.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
      return new NextResponse("Missing 'url' query parameter", { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return new NextResponse("Invalid media URL format", { status: 400 });
    }

    // Security check: only allow http/https protocols and reject private IP spaces
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new NextResponse("Invalid URL protocol", { status: 400 });
    }

    const hostname = parsed.hostname.toLowerCase();
    const isPrivate =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".local");

    // Only allow public media streaming (e.g. archive.org, wikimedia, cdn, public s3, etc.)
    if (isPrivate) {
      return new NextResponse("Forbidden host", { status: 403 });
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

    const upstreamResponse = await fetch(targetUrl, {
      method: "GET",
      headers: upstreamHeaders,
      redirect: "follow",
    });

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
