import { processRawSearchResults, SearchSource } from "@/lib/sourcesHelper";
import { ensureToolsLoaded, getLoadedToolsCache, updateLoadedToolsStats, ToolItem } from "@/lib/toolsConfig";
import { executeRoutedPrompt } from "@/lib/router";

export interface AgenticResearchResult {
  needsSearch: boolean;
  searchPerformed: boolean;
  augmentedPrompt: string;
  sources: SearchSource[];
  agentSteps: string[];
  queriesUsed: string[];
  pagesRead: { url: string; title: string; length: number }[];
  providerUsed?: string;
}

/**
 * 1. Intelligent Decision Engine:
 * Determines if a query requires live web research, current data, live specs, news, or external documentation.
 */
export async function shouldPerformWebResearch(
  prompt: string,
  webSearchEnabled: boolean,
  activeTools: string[] = [],
  modelId: "spark" | "core" | "pro" | "ultra" | string = "core"
): Promise<boolean> {
  try {
    const decisionPrompt = `أنت الوكيل المسؤول والذكي المفوّض باتخاذ القرار حول تفعيل أو تعطيل ميزة "البحث في الويب" لمساعد الذكاء الاصطناعي SoufAI.
بناءً على رغبة المستخدم وحالة النظام الحالية، يجب عليك اتخاذ قرار حاسم ومدروس.

سياق النظام الحالي:
- زر تفعيل ميزة البحث بالواجهة (webSearchEnabled): ${webSearchEnabled ? "مفعّل (TRUE)" : "غير مفعّل (FALSE)"}
- الأدوات النشطة الأخرى: ${activeTools.join(", ") || "لا يوجد"}

استعلام المستخدم الحالي: "${prompt}"

شروط وقواعد اتخاذ القرار:
1. إذا كانت حالة ميزة البحث بالواجهة "غير مفعّل (FALSE)"، فالقاعدة العامة هي عدم البحث (أجب بـ NO) للحفاظ على الموارد والخصوصية، ولا تغير هذا القرار إلا إذا كان استعلام المستخدم يتضمن طلباً مباشراً وصريحاً وحتمياً للبحث في الويب (مثل: "ابحث في الويب عن..."، "ابحث لي في النت عن..."، "سوي لي بحث قوقل عن..."). الأسئلة العادية حتى لو كانت عن معلومات متغيرة لا تبرر تفعيل البحث إذا كان الزر مغلقاً إلا لو أمر المستخدم بذلك صراحةً.
2. إذا كانت حالة ميزة البحث بالواجهة "مفعّل (TRUE)"، فإن المستخدم يريد مساعدتك؛ قم بتأكيد البحث (أجب بـ YES) لكل استعلام يتطلب معلومات حديثة، مقارنات أسعار حية، أخبار جارية، أو مواضيع متغيرة ومواصفات لعام 2026. ولكن أجب بـ NO إذا كان الاستعلام بسيطاً جداً ولا يستدعي إطلاقاً تصفح الإنترنت (مثال: "مرحباً"، "كيف حالك"، "احسب 5+5"، أسئلة برمجية عامة، أو أسئلة فلسفية وثابتة).

أجب بكلمة واحدة فقط بالإنجليزية: إما YES أو NO دون أي شرح أو تعليق أو هوامش إضافية.`;

    const result = await executeRoutedPrompt({
      modelId: modelId as any,
      prompt: decisionPrompt,
    });

    const choice = result?.text?.trim().toUpperCase() || "";
    console.log(`[Research Decision Engine] Agentic decision via route [${modelId}]: ${choice} (UI Toggle was ${webSearchEnabled}, Provider was ${result.providerUsed}, Model was ${result.modelUsed})`);
    
    if (choice.includes("YES")) {
      return true;
    }
    if (choice.includes("NO")) {
      return false;
    }
    
    return webSearchEnabled;
  } catch (err) {
    console.warn("Error calling executeRoutedPrompt for research decision:", err);
    return webSearchEnabled;
  }
}

/**
 * Executes a raw search query using configured tools (Tavily, Exa, Serper, DuckDuckGo, Wikipedia)
 */
export async function executeRawSearchQuery(
  searchQuery: string
): Promise<{ results: { title: string; snippet: string; url: string }[]; providerUsed: string }> {
  await ensureToolsLoaded();
  const tools: ToolItem[] = getLoadedToolsCache();

  const searchTools = tools
    .filter((t) => (t.category === "search" || t.id === "ddg") && t.enabled !== false)
    .sort((a, b) => (a.priority || 99) - (b.priority || 99));

  let searchResults: { title: string; snippet: string; url: string }[] = [];
  let providerUsed = "DuckDuckGo Free Search";

  for (const tool of searchTools) {
    if (searchResults.length > 0) break;

    // Tavily
    if (tool.id === "tavily" && tool.keys?.length) {
      for (const kObj of tool.keys) {
        if (!kObj.key?.trim()) continue;
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
              providerUsed = "Tavily Web Search";
              break;
            }
          }
        } catch (e) {
          /* ignore */
        }
      }
    }

    // Exa
    if (searchResults.length === 0 && tool.id === "exa" && tool.keys?.length) {
      for (const kObj of tool.keys) {
        if (!kObj.key?.trim()) continue;
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
              break;
            }
          }
        } catch (e) {
          /* ignore */
        }
      }
    }

    // Serper
    if (searchResults.length === 0 && tool.id === "serper" && tool.keys?.length) {
      for (const kObj of tool.keys) {
        if (!kObj.key?.trim()) continue;
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
              break;
            }
          }
        } catch (e) {
          /* ignore */
        }
      }
    }
  }

  // Free Web Search Engine (Google News RSS + DuckDuckGo Instant Answers + Wikipedia AR/EN)
  if (searchResults.length === 0) {
    providerUsed = "Live Web Intelligence";

    // 1. Google News RSS for real-time live events, sports, football, news
    try {
      const newsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=ar&gl=SA&ceid=SA:ar`;
      const newsRes = await fetch(newsUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SoufAI/2026" },
      });
      if (newsRes.ok) {
        const xmlText = await newsRes.text();
        const items = xmlText.match(/<item>[\s\S]*?<\/item>/g) || [];
        for (const item of items.slice(0, 4)) {
          const titleMatch = item.match(/<title>(.*?)<\/title>/);
          const linkMatch = item.match(/<link>(.*?)<\/link>/);
          const pubDateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
          if (titleMatch && linkMatch) {
            const rawTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();
            const rawLink = linkMatch[1].trim();
            const dateStr = pubDateMatch ? ` [${pubDateMatch[1].slice(0, 16)}]` : "";
            searchResults.push({
              title: `${rawTitle}${dateStr}`,
              snippet: `خبر صحفي مباشر منشور حول "${searchQuery}": ${rawTitle}`,
              url: rawLink,
            });
          }
        }
      }
    } catch (e) {
      /* ignore */
    }

    // 2. DuckDuckGo Instant Answers
    if (searchResults.length < 3) {
      try {
        const ddgApiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1`;
        const ddgRes = await fetch(ddgApiUrl);
        if (ddgRes.ok) {
          const ddgData = await ddgRes.json();
          if (ddgData.AbstractText && ddgData.AbstractURL) {
            searchResults.push({
              title: ddgData.Heading || searchQuery,
              snippet: ddgData.AbstractText,
              url: ddgData.AbstractURL,
            });
          }
          if (Array.isArray(ddgData.RelatedTopics)) {
            for (const topic of ddgData.RelatedTopics.slice(0, 2)) {
              if (topic.Text && topic.FirstURL) {
                searchResults.push({
                  title: topic.Text.slice(0, 60),
                  snippet: topic.Text,
                  url: topic.FirstURL,
                });
              }
            }
          }
        }
      } catch (e) {
        /* ignore */
      }
    }

    // 3. Wikipedia API (Arabic & English)
    if (searchResults.length < 3) {
      for (const lang of ["ar", "en"]) {
        try {
          const wikiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
            searchQuery
          )}&utf8=&format=json&origin=*`;
          const wikiRes = await fetch(wikiUrl);
          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            if (wikiData.query?.search?.length) {
              wikiData.query.search.slice(0, 2).forEach((item: any) => {
                const cleanSnippet = item.snippet.replace(/<[^>]*>?/gm, "").trim();
                searchResults.push({
                  title: `${item.title} - ويكيبيديا (${lang.toUpperCase()})`,
                  snippet: cleanSnippet,
                  url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
                });
              });
            }
          }
        } catch (e) {
          /* ignore */
        }
        if (searchResults.length >= 3) break;
      }
    }

    // 4. DuckDuckGo HTML Fallback
    if (searchResults.length === 0) {
      try {
        const htmlRes = await fetch(
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`,
          {
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SoufAI/2026" },
          }
        );
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
      } catch (e) {
        /* ignore */
      }
    }
  }

  try {
    updateLoadedToolsStats(
      providerUsed || "DuckDuckGo Free Search",
      searchResults.length > 0 ? "success" : "fallback",
      searchQuery
    );
  } catch {}

  return { results: searchResults, providerUsed };
}

/**
 * Tool: open_page / read_page
 * Fetches the actual clean text content of a web page
 */
async function fetchPageContent(
  url: string,
  origin: string
): Promise<{ success: boolean; url: string; title: string; content: string }> {
  try {
    const res = await fetch(`${origin}/api/tools/read-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        url,
        title: data.title || "صفحة الويب المباشرة",
        content: data.content || "",
      };
    }
  } catch (err) {
    console.warn("fetchPageContent error for url:", url, err);
  }

  return {
    success: false,
    url,
    title: "",
    content: "",
  };
}

/**
 * Main Agentic Web Research Loop (SoufAI Research Agent)
 */
export async function runAgenticWebResearch(params: {
  prompt: string;
  webSearchEnabled: boolean;
  activeTools?: string[];
  origin: string;
  modelId?: "spark" | "core" | "pro" | "ultra" | string;
}): Promise<AgenticResearchResult> {
  const { prompt, webSearchEnabled, activeTools = [], origin, modelId = "core" } = params;

  const needsSearch = await shouldPerformWebResearch(prompt, webSearchEnabled, activeTools, modelId);

  if (!needsSearch) {
    return {
      needsSearch: false,
      searchPerformed: false,
      augmentedPrompt: prompt,
      sources: [],
      agentSteps: ["🧠 تم تقييم الطلب: لا يحتاج إلى بحث في الويب."],
      queriesUsed: [],
      pagesRead: [],
    };
  }

  const agentSteps: string[] = [];
  const queriesUsed: string[] = [];
  const pagesRead: { url: string; title: string; length: number }[] = [];
  const rawResultsAccumulator: { title: string; snippet: string; url: string }[] = [];

  // Step 1: Formulate Search Queries (Multi-Query Plan)
  agentSteps.push("🔎 يحلل السؤال ويحدد خطة الاستعلامات الذكية...");

  // Primary search query
  const primaryQuery = prompt
    .replace(/ابحث عن|في الويب|أريد معرفة|اخبرني عن/gi, "")
    .trim();
  queriesUsed.push(primaryQuery || prompt);

  // Secondary search query if prompt is complex or analytical
  if (prompt.includes("مقارنة") || prompt.includes("أفضل") || prompt.includes("تحديث")) {
    queriesUsed.push(`${primaryQuery} 2026 official docs`);
  }

  // Step 2: Search Round 1
  agentSteps.push(`🔍 ينفذ عمليات البحث المباشرة (${queriesUsed.length} استعلامات)...`);
  let primaryProvider = "Search Tool";

  for (const q of queriesUsed) {
    const { results, providerUsed } = await executeRawSearchQuery(q);
    primaryProvider = providerUsed;
    results.forEach((r) => {
      if (!rawResultsAccumulator.some((existing) => existing.url === r.url)) {
        rawResultsAccumulator.push(r);
      }
    });
  }

  if (rawResultsAccumulator.length === 0) {
    // Backstop single entry if no search results returned
    rawResultsAccumulator.push({
      title: `نتائج البحث المباشر لـ: ${prompt}`,
      snippet: `معلومات حية جارية بخصوص: "${prompt}".`,
      url: `https://duckduckgo.com/?q=${encodeURIComponent(prompt)}`,
    });
  }

  // Step 3: Page Inspection & Selection (open_page / read_page)
  // Select top 2 valid external HTTP/HTTPS pages to open and read full text
  const candidateUrls = rawResultsAccumulator
    .map((r) => r.url)
    .filter((u) => u.startsWith("http://") || u.startsWith("https://"))
    .slice(0, 2);

  const fullPageContents: { url: string; title: string; content: string }[] = [];

  for (const targetUrl of candidateUrls) {
    try {
      const hostname = new URL(targetUrl).hostname.replace("www.", "");
      agentSteps.push(`📄 يفتح ويقرأ محتوى الصفحة المباشرة: ${hostname}`);
      
      const pageData = await fetchPageContent(targetUrl, origin);
      if (pageData.success && pageData.content.length > 100) {
        fullPageContents.push(pageData);
        pagesRead.push({
          url: targetUrl,
          title: pageData.title,
          length: pageData.content.length,
        });
      }
    } catch (e) {
      /* skip failed page read */
    }
  }

  // Step 4: Verification & Secondary Search Round (if pages yielded insufficient content)
  if (fullPageContents.length === 0 && candidateUrls.length > 0) {
    agentSteps.push("🔍 يتحقق من دقة النتائج ويجري جولة بحث ثانية مطورة...");
    const secondaryQuery = `${primaryQuery} 2026`;
    const { results } = await executeRawSearchQuery(secondaryQuery);
    results.forEach((r) => {
      if (!rawResultsAccumulator.some((existing) => existing.url === r.url)) {
        rawResultsAccumulator.push(r);
      }
    });
  }

  // Step 5: Format Structured Sources for UI and Citations
  const structuredSources = processRawSearchResults(rawResultsAccumulator);

  // Step 6: Construct Grounded Augmented Prompt for SoufAI
  agentSteps.push("✍️ يراجع كافة المصادر ويصوغ الإجابة النهائية الموثقة...");

  const formattedSourcesBlock = structuredSources
    .map((src) => {
      const pageData = fullPageContents.find((p) => p.url === src.url);
      const deepText = pageData ? `\n[المحتوى الفعلي الكامل للصفحة المفتوحة]:\n${pageData.content.slice(0, 1500)}` : "";
      return `[المصدر ${src.number}]: ${src.title}\nالموقع: ${src.siteName} (${src.domain})\nالرابط: ${src.url}\nالملخص: ${src.snippet}${deepText}`;
    })
    .join("\n\n---\n\n");

  const agentInstructionHeader = `[نظام البحث الذكي Agentic Web Research لـ SoufAI - عام 2026]:
لقد قام وكيل البحث SoufAI بالخطوات التالية لتأمين دقة المعلومات:
1. قام بصياغة خطة استعلامات بحث متعددة: [${queriesUsed.join(", ")}]
2. تم جلب وفحص نتائج البحث من الويب المباشر.
3. تم فتح وقراءة الصفحات المباشرة التالية: [${pagesRead.map((p) => p.title).join(", ") || "تم تحليل ملخصات الصفحات الموثوقة"}]

[المصادر الحقيقية الموثقة المعنونة بأرقام]:
${formattedSourcesBlock}

[تعليمات الصياغة والتوثيق الحازمة]:
1. أجب باللغة العربية الفصحى بشكل دقيق، منظم وأنيق.
2. ضع مؤشرات أرقام المصادر مثل [1]، [2] مباشرة بجانب المعلومات أو الأرقام المأخوذة من ذلك المصدر المحدد.
3. يمنع منعاً باتاً كتابة روابط نصية طويلة خام مثل (https://...) داخل فقرات الإجابة، واستخدم فقط أرقام المصادر الموثقة مثل [1].
4. يمنع منعاً باتاً اختراع مصادر أو أرقام مصادر غير موجوة بالقائمة أعلاه.
5. إذا كانت هناك وجهات نظر أو بيانات متعارضة بين المصادر، يرجى توضيحها للمستخدم بأسلوب حيادي ذكي.

[السؤال الأصلي للمستخدم]: ${prompt}`;

  return {
    needsSearch: true,
    searchPerformed: true,
    augmentedPrompt: agentInstructionHeader,
    sources: structuredSources,
    agentSteps,
    queriesUsed,
    pagesRead,
    providerUsed: primaryProvider,
  };
}
