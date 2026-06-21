import { SITE_NAME, SITE_OG_HEADLINE } from "@/lib/constants";
import { tmdb } from "@/tmdb/api";
import { tmdbImageUrl } from "./constants";

export type SiteOgImageProps = {
  title: string;
  headline: string;
  posterUrls: string[];
  bannerUrl: string;
};

export const getSiteOgImageProps = async (
  bannerUrl: string,
): Promise<SiteOgImageProps> => {
  const data = await tmdb.discover.movie({
    sort_by: "popularity.desc",
    with_origin_country: "US",
    "vote_count.gte": "50",
    include_adult: false,
  });

  const posterUrls = data.results
    .slice(0, 5)
    .map((m) => tmdbImageUrl(m.poster_path, "w500"))
    .filter((url): url is string => Boolean(url));

  return {
    title: SITE_NAME,
    headline: SITE_OG_HEADLINE,
    posterUrls,
    bannerUrl,
  };
};
