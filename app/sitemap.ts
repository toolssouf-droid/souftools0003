import { MetadataRoute } from "next";
import { SITE_DOMAIN, TOOLS_DIRECTORY } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ["en", "zh-CN", "hi", "es", "ar", "fr", "bn", "pt", "ru", "id", "ur", "de"];
  const staticPages = [
    "",
    "/about",
    "/pricing",
    "/privacy",
    "/terms",
    "/tools",
  ];

  const currentDate = new Date().toISOString();
  const sitemapEntries: MetadataRoute.Sitemap = [];

  // Static Pages for both locales
  locales.forEach((loc) => {
    staticPages.forEach((pagePath) => {
      sitemapEntries.push({
        url: `${SITE_DOMAIN}/${loc}${pagePath}`,
        lastModified: currentDate,
        changeFrequency: pagePath === "" || pagePath === "/tools" ? "daily" : "weekly",
        priority: pagePath === "" ? 1.0 : pagePath === "/tools" ? 0.9 : 0.8,
      });
    });

    // Tools detail pages
    TOOLS_DIRECTORY.forEach((tool) => {
      sitemapEntries.push({
        url: `${SITE_DOMAIN}/${loc}/tools/${tool.slug}`,
        lastModified: currentDate,
        changeFrequency: "daily",
        priority: 0.9,
      });
    });
  });

  return sitemapEntries;
}
