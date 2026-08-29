import type { MetadataRoute } from "next";
import { pages } from "@/config/pages";
import { getSiteFlags } from "@/lib/flags/site-flags";
import { SITE_URL } from "@/lib/constants";

const staticRoutes: MetadataRoute.Sitemap = [
  {
    url: `${SITE_URL}/`,
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: `${SITE_URL}/movies`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}/tvshows`,
    changeFrequency: "daily",
    priority: 0.9,
  },
  {
    url: `${SITE_URL}${pages.anime.root.link}`,
    changeFrequency: "daily",
    priority: 0.85,
  },
  {
    url: `${SITE_URL}${pages.trending.root.link}`,
    changeFrequency: "hourly",
    priority: 0.85,
  },
  {
    url: `${SITE_URL}${pages.trending.movie.link}`,
    changeFrequency: "hourly",
    priority: 0.8,
  },
  {
    url: `${SITE_URL}${pages.trending.tv.link}`,
    changeFrequency: "hourly",
    priority: 0.8,
  },
  {
    url: `${SITE_URL}${pages.trending.people.link}`,
    changeFrequency: "daily",
    priority: 0.75,
  },
  {
    url: `${SITE_URL}${pages.people.popular.link}`,
    changeFrequency: "daily",
    priority: 0.75,
  },
  {
    url: `${SITE_URL}/search`,
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    url: `${SITE_URL}/privacy`,
    changeFrequency: "monthly",
    priority: 0.3,
  },
  {
    url: `${SITE_URL}/terms`,
    changeFrequency: "monthly",
    priority: 0.3,
  },
  {
    url: `${SITE_URL}/dmca`,
    changeFrequency: "monthly",
    priority: 0.3,
  },
  {
    url: `${SITE_URL}/cookie-policy`,
    changeFrequency: "monthly",
    priority: 0.3,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const flags = await getSiteFlags();
  const lastModified = new Date();
  const liveRoutes: MetadataRoute.Sitemap = flags.liveTvEnabled
    ? [
        {
          url: `${SITE_URL}/live`,
          changeFrequency: "daily",
          priority: 0.7,
        },
      ]
    : [];

  const routes = staticRoutes.filter(
    (entry) => entry.url !== `${SITE_URL}/live`,
  );

  return [...routes, ...liveRoutes].map((entry) => ({
    ...entry,
    lastModified,
  }));
}
