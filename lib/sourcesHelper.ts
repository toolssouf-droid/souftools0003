/**
 * SoufSources — Helper utilities for classifying, deduplicating, and formatting web search sources.
 */

export type SourceType =
  | "website"
  | "article"
  | "documentation"
  | "github"
  | "news"
  | "academic"
  | "official"
  | "dataset"
  | "video";

export interface SearchSource {
  id: string;
  number: number;
  title: string;
  snippet: string;
  url: string;
  domain: string;
  siteName: string;
  isOfficial?: boolean;
  type: SourceType;
  imageUrl?: string;
  faviconUrl?: string;
  pubDate?: string;
  accessDate?: string;
  isSaved?: boolean;
}

const OFFICIAL_DOMAINS = [
  "gov",
  "edu",
  "mil",
  "org",
  "react.dev",
  "nextjs.org",
  "nodejs.org",
  "developer.mozilla.org",
  "github.com",
  "wikipedia.org",
  "python.org",
  "typescriptlang.org",
  "openai.com",
  "anthropic.com",
  "google.com",
  "ai.google.dev",
  "microsoft.com",
  "apple.com",
  "meta.com",
  "arxiv.org",
  "nature.com",
  "sciencedirect.com",
  "ieee.org",
  "w3.org",
  "w3schools.com",
];

const NEWS_DOMAINS = [
  "bbc.com",
  "cnn.com",
  "reuters.com",
  "aljazeera.net",
  "bloomberg.com",
  "techcrunch.com",
  "theverge.com",
  "wired.com",
  "nytimes.com",
  "theguardian.com",
  "asharq.com",
  "alarabiya.net",
];

export function extractDomain(urlStr: string): string {
  try {
    const urlObj = new URL(urlStr);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return urlStr;
  }
}

export function extractSiteName(domain: string): string {
  if (!domain) return "الويب";
  if (domain.includes("github.com")) return "GitHub";
  if (domain.includes("react.dev")) return "React Docs";
  if (domain.includes("nextjs.org")) return "Next.js Docs";
  if (domain.includes("wikipedia.org")) return "ويكيبيديا";
  if (domain.includes("google.com")) return "Google";
  if (domain.includes("youtube.com")) return "YouTube";
  if (domain.includes("openai.com")) return "OpenAI";
  if (domain.includes("anthropic.com")) return "Anthropic";
  if (domain.includes("arxiv.org")) return "arXiv Academic";
  if (domain.includes("techcrunch.com")) return "TechCrunch";
  if (domain.includes("theverge.com")) return "The Verge";
  if (domain.includes("developer.mozilla.org")) return "MDN Web Docs";

  const parts = domain.split(".");
  if (parts.length >= 2) {
    const name = parts[parts.length - 2];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return domain;
}

export function checkIsOfficial(domain: string, url: string): boolean {
  if (!domain) return false;
  const lowerDom = domain.toLowerCase();

  if (
    lowerDom.endsWith(".gov") ||
    lowerDom.includes(".gov.") ||
    lowerDom.endsWith(".edu") ||
    lowerDom.includes(".edu.") ||
    lowerDom.endsWith(".gov.sa") ||
    lowerDom.endsWith(".gov.ae")
  ) {
    return true;
  }

  return OFFICIAL_DOMAINS.some((d) => lowerDom === d || lowerDom.endsWith(`.${d}`));
}

export function classifySourceType(domain: string, url: string, title: string): SourceType {
  const lowerDom = domain.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();

  if (lowerDom.includes("github.com")) return "github";
  if (lowerDom.includes("youtube.com") || lowerDom.includes("vimeo.com")) return "video";
  if (lowerDom.includes("arxiv.org") || lowerDom.includes("ieee.org") || lowerDom.endsWith(".edu") || lowerDom.includes("sciencedirect")) return "academic";
  if (NEWS_DOMAINS.some((d) => lowerDom.includes(d))) return "news";
  if (
    lowerUrl.includes("/docs") ||
    lowerUrl.includes("/documentation") ||
    lowerDom.includes("react.dev") ||
    lowerDom.includes("nextjs.org") ||
    lowerDom.includes("developer.mozilla.org") ||
    lowerTitle.includes("documentation") ||
    lowerTitle.includes("توثيق")
  ) {
    return "documentation";
  }
  if (checkIsOfficial(domain, url)) return "official";
  if (lowerTitle.includes("dataset") || lowerDom.includes("kaggle.com")) return "dataset";
  if (lowerUrl.includes("/article") || lowerUrl.includes("/blog") || lowerUrl.includes("/news")) return "article";

  return "website";
}

export function getFaviconUrl(domain: string): string {
  if (!domain) return "https://www.google.com/s2/favicons?domain=google.com&sz=64";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

/**
 * Deduplicates raw search items and enhances them into structured SearchSource objects
 */
export function processRawSearchResults(rawResults: any[]): SearchSource[] {
  if (!Array.isArray(rawResults)) return [];

  const seenUrls = new Set<string>();
  const sources: SearchSource[] = [];

  for (const item of rawResults) {
    const rawUrl = item.url || item.link || "";
    if (!rawUrl) continue;

    // Normalize URL
    let cleanUrl = rawUrl.trim();
    try {
      const u = new URL(cleanUrl);
      cleanUrl = `${u.origin}${u.pathname}`.replace(/\/$/, "");
    } catch {
      // keep as is
    }

    if (seenUrls.has(cleanUrl.toLowerCase())) continue;
    seenUrls.add(cleanUrl.toLowerCase());

    const domain = extractDomain(rawUrl);
    const siteName = item.siteName || extractSiteName(domain);
    const title = item.title || `مصدر من ${siteName}`;
    const snippet = item.snippet || item.content || item.text || "";
    const isOfficial = item.isOfficial !== undefined ? item.isOfficial : checkIsOfficial(domain, rawUrl);
    const type = item.type || classifySourceType(domain, rawUrl, title);
    const faviconUrl = getFaviconUrl(domain);
    const accessDate = new Date().toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    sources.push({
      id: `src_${sources.length + 1}_${Math.random().toString(36).substring(2, 6)}`,
      number: sources.length + 1,
      title,
      snippet,
      url: rawUrl,
      domain,
      siteName,
      isOfficial,
      type,
      imageUrl: item.imageUrl || item.image || undefined,
      faviconUrl,
      pubDate: item.pubDate || item.date || undefined,
      accessDate,
      isSaved: false,
    });
  }

  return sources;
}
