import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: "/login/verify/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: "/terms/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: "/dmca/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: "/cookie-policy/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: "/privacy/",
      },
    ],
    sitemap: "https://nyumatflix.com/sitemap.xml",
  };
}
