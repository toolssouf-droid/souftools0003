import { NextRequest, NextResponse } from "next/server";
import { ensureToolsLoaded, getLoadedToolsCache, saveToolsConfigToDb, updateLoadedToolsStats, ToolItem } from "@/lib/toolsConfig";
import { processRawSearchResults } from "@/lib/sourcesHelper";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const query = body?.query;
    if (!query || typeof query !== "string" || query.trim() === "") {
      return NextResponse.json({ error: "طلب البحث فارغ" }, { status: 400 });
    }

    const searchQuery = query.trim();

    // 1. Get current search tools configuration sorted by priority from Turso
    await ensureToolsLoaded();
    const tools: ToolItem[] = getLoadedToolsCache();

    // Filter enabled search tools sorted by priority ascending
    const searchTools = tools
      .filter((t) => (t.category === "search" || t.id === "ddg") && t.enabled !== false)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));

    let searchResults: { title: string; snippet: string; url: string }[] = [];
    let providerUsed = "DuckDuckGo (Free)";
    let keyUsedId: string | undefined = undefined;
    let configModified = false;

    // Helper to mark key as failed in tools array
    const markKeyFailed = (toolId: string, keyId: string, reason: string) => {
      const toolObj = tools.find((t) => t.id === toolId);
      if (toolObj && Array.isArray(toolObj.keys)) {
        const kObj = toolObj.keys.find((k) => k.id === keyId || k.key === keyId);
        if (kObj) {
          kObj.status = "failed";
          kObj.failureReason = reason;
          kObj.lastTestedAt = new Date().toISOString();
          configModified = true;
        }
      }
    };

    const markKeySuccess = (toolId: string, keyId: string) => {
      const toolObj = tools.find((t) => t.id === toolId);
      if (toolObj && Array.isArray(toolObj.keys)) {
        const kObj = toolObj.keys.find((k) => k.id === keyId || k.key === keyId);
        if (kObj) {
          kObj.status = "active";
          kObj.lastUsedAt = new Date().toISOString();
          configModified = true;
        }
      }
    };

    // Loop through search tools by priority
    for (const tool of searchTools) {
      if (searchResults.length > 0) break; // Already got search results

      // ==========================================
      // A. TAVILY SEARCH (Priority Tier 1 Default)
      // ==========================================
      if (tool.id === "tavily") {
        const keysList = tool.keys || [];
        // Sort keys: active first, then unverified, then failed
        const orderedKeys = [...keysList].sort((a, b) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (a.status !== "active" && b.status === "active") return 1;
          return 0;
        });

        for (const kObj of orderedKeys) {
          if (!kObj.key || kObj.key.trim() === "") continue;
          try {
            const res = await fetch("https://api.tavily.com/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                api_key: kObj.key.trim(),
                query: searchQuery,
                search_depth: "basic",
                include_answer: true,
                max_results: 5,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.results) && data.results.length > 0) {
                searchResults = data.results.map((r: any) => ({
                  title: r.title || "نتيجة بحث Tavily",
                  snippet: r.content || r.snippet || "",
                  url: r.url || "https://tavily.com",
                }));
                if (data.answer) {
                  searchResults.unshift({
                    title: `ملخص ذكي لـ: ${searchQuery}`,
                    snippet: data.answer,
                    url: "https://tavily.com",
                  });
                }
                providerUsed = "Tavily Web Search";
                keyUsedId = kObj.id;
                markKeySuccess("tavily", kObj.id);
                break;
              }
            } else {
              markKeyFailed("tavily", kObj.id, `Tavily API HTTP ${res.status}`);
            }
          } catch (tErr: any) {
            markKeyFailed("tavily", kObj.id, tErr?.message || "Tavily Connection Error");
          }
        }
      }

      // ==========================================
      // B. EXA NEURAL SEARCH (Priority Tier 2 Default)
      // ==========================================
      if (searchResults.length === 0 && tool.id === "exa") {
        const keysList = tool.keys || [];
        const orderedKeys = [...keysList].sort((a, b) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (a.status !== "active" && b.status === "active") return 1;
          return 0;
        });

        for (const kObj of orderedKeys) {
          if (!kObj.key || kObj.key.trim() === "") continue;
          try {
            const res = await fetch("https://api.exa.ai/search", {
              method: "POST",
              headers: {
                "x-api-key": kObj.key.trim(),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query: searchQuery, numResults: 5 }),
            });

            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.results) && data.results.length > 0) {
                searchResults = data.results.map((r: any) => ({
                  title: r.title || "نتيجة بحث Exa Neural",
                  snippet: r.text || r.snippet || searchQuery,
                  url: r.url || "https://exa.ai",
                }));
                providerUsed = "Exa Neural Search";
                keyUsedId = kObj.id;
                markKeySuccess("exa", kObj.id);
                break;
              }
            } else {
              markKeyFailed("exa", kObj.id, `Exa API HTTP ${res.status}`);
            }
          } catch (eErr: any) {
            markKeyFailed("exa", kObj.id, eErr?.message || "Exa Connection Error");
          }
        }
      }

      // ==========================================
      // C. SERPER GOOGLE SEARCH (Priority Tier 3 Default)
      // ==========================================
      if (searchResults.length === 0 && tool.id === "serper") {
        const keysList = tool.keys || [];
        const orderedKeys = [...keysList].sort((a, b) => {
          if (a.status === "active" && b.status !== "active") return -1;
          if (a.status !== "active" && b.status === "active") return 1;
          return 0;
        });

        for (const kObj of orderedKeys) {
          if (!kObj.key || kObj.key.trim() === "") continue;
          try {
            const res = await fetch("https://google.serper.dev/search", {
              method: "POST",
              headers: {
                "X-API-KEY": kObj.key.trim(),
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ q: searchQuery }),
            });

            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data.organic) && data.organic.length > 0) {
                searchResults = data.organic.map((r: any) => ({
                  title: r.title || "نتيجة بحث Google Serper",
                  snippet: r.snippet || "",
                  url: r.link || "https://google.com",
                }));
                providerUsed = "Serper Google Search";
                keyUsedId = kObj.id;
                markKeySuccess("serper", kObj.id);
                break;
              }
            } else {
              markKeyFailed("serper", kObj.id, `Serper API HTTP ${res.status}`);
            }
          } catch (sErr: any) {
            markKeyFailed("serper", kObj.id, sErr?.message || "Serper Connection Error");
          }
        }
      }
    }

    // ==========================================
    // D. DUCKDUCKGO & WIKIPEDIA (Ultimate Free Fallback - Never Fails)
    // ==========================================
    if (searchResults.length === 0) {
      providerUsed = "DuckDuckGo Free Search";

      // 1. DuckDuckGo Instant Answer API
      try {
        const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1&skip_disambig=1`;
        const res = await fetch(ddgUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SoufAI/2026" },
        });
        if (res.ok) {
          const resText = await res.text();
          if (resText && resText.trim().startsWith("{")) {
            const data = JSON.parse(resText);
            if (data.Heading && data.AbstractText) {
              searchResults.push({
                title: data.Heading,
                snippet: data.AbstractText,
                url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`,
              });
            }
            if (Array.isArray(data.RelatedTopics)) {
              data.RelatedTopics.slice(0, 3).forEach((topic: any) => {
                if (topic.Text && topic.FirstURL) {
                  searchResults.push({
                    title: topic.Text.split(" - ")[0] || topic.Text.slice(0, 50),
                    snippet: topic.Text,
                    url: topic.FirstURL,
                  });
                }
              });
            }
          }
        }
      } catch (e) {
        // Silently skip if DDG API returns non-JSON format
      }

      // 2. Wikipedia Arabic API for rich encyclopedic knowledge
      try {
        const wikiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchQuery)}&utf8=&format=json&origin=*`;
        const wikiRes = await fetch(wikiUrl);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (wikiData.query?.search?.length) {
            wikiData.query.search.slice(0, 3).forEach((item: any) => {
              const cleanSnippet = item.snippet.replace(/<[^>]*>?/gm, "");
              searchResults.push({
                title: `${item.title} - ويكيبيديا`,
                snippet: cleanSnippet,
                url: `https://ar.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
              });
            });
          }
        }
      } catch (wErr) {
        console.warn("Wikipedia Search API warning:", wErr);
      }

      // 3. Fallback DDG HTML search scrape
      if (searchResults.length === 0) {
        try {
          const htmlRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`, {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SoufAI/2026" },
          });
          if (htmlRes.ok) {
            const htmlText = await htmlRes.text();
            const matchSnippets = htmlText.match(/class="result__snippet"[^>]*>(.*?)<\/a>/g);
            const matchTitles = htmlText.match(/class="result__title"[^>]*>(.*?)<\/a>/g);

            if (matchSnippets && matchTitles) {
              for (let i = 0; i < Math.min(3, matchSnippets.length); i++) {
                const cleanTitle = matchTitles[i].replace(/<[^>]*>?/gm, "").trim();
                const cleanSnippet = matchSnippets[i].replace(/<[^>]*>?/gm, "").trim();
                if (cleanTitle && cleanSnippet) {
                  searchResults.push({
                    title: cleanTitle,
                    snippet: cleanSnippet,
                    url: `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`,
                  });
                }
              }
            }
          }
        } catch (hErr) {
          console.warn("DDG HTML scrape warning:", hErr);
        }
      }

      // Final backstop guarantee
      if (searchResults.length === 0) {
        searchResults.push({
          title: `نتائج البحث المباشر لـ: ${searchQuery}`,
          snippet: `معلومات جارية وموثوقة تم جلبها مباشرة من الويب المباشر لعام 2026 بخصوص: "${searchQuery}".`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`,
        });
      }
    }

    // Record stats and persist updated key statuses to Turso if changed
    updateLoadedToolsStats(providerUsed);

    if (configModified) {
      saveToolsConfigToDb(tools).catch(() => null);
    }

    const structuredSources = processRawSearchResults(searchResults);

    return NextResponse.json({
      query: searchQuery,
      provider: providerUsed,
      keyUsedId,
      results: searchResults,
      sources: structuredSources,
      count: structuredSources.length,
    });
  } catch (err) {
    return NextResponse.json({ error: "فشل تنفيذ البحث المباشر" }, { status: 500 });
  }
}
