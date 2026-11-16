import { MetadataRoute } from "next";
import { SITE_DOMAIN } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const locales = ["en", "zh-CN", "hi", "es", "ar", "fr", "bn", "pt", "ru", "id", "ur", "de"];
  const allowedPaths = ["/"];

  locales.forEach((loc) => {
    allowedPaths.push(
      `/${loc}`,
      `/${loc}/about`,
      `/${loc}/pricing`,
      `/${loc}/privacy`,
      `/${loc}/terms`,
      `/${loc}/tools`,
      `/${loc}/tools/*`
    );
  });

  return {
    rules: [
      {
        userAgent: "*",
        allow: allowedPaths,
        disallow: [
          "/admin",
          "/admin/*",
          "/*/admin",
          "/*/admin/*",
          "/chat",
          "/chat/*",
          "/*/chat",
          "/*/chat/*",
          "/history",
          "/*/history",
          "/memory",
          "/*/memory",
          "/settings",
          "/*/settings",
          "/login",
          "/*/login",
          "/api/*",
          "/private/*",
        ],
      },
    ],
    sitemap: `${SITE_DOMAIN}/sitemap.xml`,
  };
}
