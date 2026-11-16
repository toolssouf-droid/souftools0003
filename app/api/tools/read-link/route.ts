import { NextRequest, NextResponse } from "next/server";
import { ensureToolsLoaded, getLoadedToolsCache, updateLoadedToolsStats } from "@/lib/toolsConfig";
import { requireAuth } from "@/lib/auth/serverAuth";
import { isSafePublicUrl } from "@/lib/security/ssrfGuard";
import { checkRateLimit } from "@/lib/security/rateLimiter";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let providerUsed = "direct_reader";

  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult) return authResult.errorResponse;
    const { user } = authResult;

    // Rate Limiting (30 link reads per minute per user)
    const rateCheck = checkRateLimit(`read_link_${user.id}`, 30, 30);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "تم تجاوز الحد المسموح لقراءة الروابط، يرجى المحاولة بعد قليل.", retryAfter: rateCheck.retryAfterSeconds },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const url = body?.url;
    if (!url) {
      return NextResponse.json({ error: "الرابط مطلوب" }, { status: 400 });
    }

    // SSRF Guard Check: Block local, private, and internal addresses
    const ssrfCheck = isSafePublicUrl(url);
    if (!ssrfCheck.safe) {
      return NextResponse.json(
        { error: `الرابط غير مسموح به لأسباب أمنية: ${ssrfCheck.error || "عنوان غير آمن"}` },
        { status: 403 }
      );
    }

    // Standard URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: "الرابط المدخل غير صالح" }, { status: 400 });
    }

    await ensureToolsLoaded();
    const tools = getLoadedToolsCache();
    const readerTools = tools
      .filter((t) => t.category === "reader" && t.enabled)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));

    // 1. ATTEMPT FIRECRAWL IF CONFIGURED
    const firecrawlTool = readerTools.find((t) => t.id === "firecrawl");
    if (firecrawlTool && firecrawlTool.keys?.length > 0) {
      for (const kObj of firecrawlTool.keys) {
        if (!kObj.key?.trim()) continue;
        const fcStart = Date.now();
        try {
          const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${kObj.key.trim()}`,
            },
            body: JSON.stringify({
              url,
              formats: ["markdown"],
            }),
          });
          const fcLatency = Date.now() - fcStart;
          if (fcRes.ok) {
            const fcData = await fcRes.json();
            const mdContent = fcData.data?.markdown || fcData.markdown;
            if (mdContent && typeof mdContent === "string" && mdContent.trim().length > 50) {
              updateLoadedToolsStats("firecrawl", "success", url, fcLatency);
              return NextResponse.json({
                success: true,
                url,
                title: fcData.data?.metadata?.title || parsedUrl.hostname,
                content: mdContent.slice(0, 10000),
                provider: "Firecrawl Web Scraper",
              });
            }
          }
          updateLoadedToolsStats("firecrawl", "failed", url, fcLatency);
        } catch {}
      }
    }

    // 2. ATTEMPT JINA READER IF CONFIGURED
    const jinaTool = readerTools.find((t) => t.id === "jina");
    if (jinaTool) {
      const jinaKey = jinaTool.keys?.[0]?.key?.trim();
      const jinaStart = Date.now();
      try {
        const headers: Record<string, string> = {
          Accept: "text/plain, application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SoufAI/2026",
        };
        if (jinaKey && jinaKey !== "FREE_NO_KEY") {
          headers.Authorization = `Bearer ${jinaKey}`;
        }

        const jinaRes = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
          headers,
        });
        const jinaLatency = Date.now() - jinaStart;
        if (jinaRes.ok) {
          const jinaText = await jinaRes.text();
          if (jinaText && jinaText.trim().length > 50) {
            updateLoadedToolsStats("jina", "success", url, jinaLatency);
            return NextResponse.json({
              success: true,
              url,
              title: parsedUrl.hostname,
              content: jinaText.slice(0, 10000),
              provider: "Jina Reader",
            });
          }
        }
        updateLoadedToolsStats("jina", "failed", url, jinaLatency);
      } catch {}
    }

    // 3. FALLBACK: DIRECT HTML EXTRACTION WITH STRICT TIMEOUT & SSRF GUARD
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SoufAI/2026",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      updateLoadedToolsStats("direct_reader", "failed", url, Date.now() - startTime);
      return NextResponse.json({ error: `فشل جلب الرابط، رمز الاستجابة: ${res.status}` }, { status: 500 });
    }

    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
    const description = descMatch ? descMatch[1].trim() : "";

    let cleanText = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      // Decode HTML entities
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&lrm;|&rlm;/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (description && !cleanText.includes(description)) {
      cleanText = `${description}\n\n${cleanText}`;
    }

    if (cleanText.length > 8000) {
      cleanText = cleanText.substring(0, 8000) + "... [تم تقليص النص الطويل]";
    }

    updateLoadedToolsStats("direct_reader", "success", url, Date.now() - startTime);

    return NextResponse.json({
      success: true,
      url,
      title,
      content: cleanText,
      provider: "Direct Web Extractor",
    });
  } catch (err: any) {
    console.error("Link scraper error:", err);
    updateLoadedToolsStats(providerUsed, "failed", req.url || "", Date.now() - startTime);
    return NextResponse.json(
      {
        error: `فشل استخراج محتوى الرابط: ${err?.message || "خطأ غير معروف"}`,
      },
      { status: 500 }
    );
  }
}
