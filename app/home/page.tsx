import { PageBackground } from "@/components/layout/page-background";
import {
  getRecommendedRowsForPage,
  getRowConfig,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { Suspense } from "react";
import { fetchAndEnrichMediaItems, fetchTMDBData } from "../actions";
import {
  LazyContentRowsDynamic,
  StreamingMediaCarousel,
} from "./client-components";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Home | NyumatFlix",
  description:
    "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
  openGraph: {
    type: "website",
    url: "https://nyumatflix.com",
    title: "Home | NyumatFlix",
    description:
      "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
    images: [
      {
        url: "https://nyumatflix.com/og.webp",
        alt: "Home | NyumatFlix",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com",
    title: "Home |NyumatFlix",
    description:
      "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
    images: ["https://nyumatflix.com/og.webp"],
  },
};

async function getHeroCarouselData(): Promise<MediaItem[]> {
  const [fanFavoriteMoviesResponse, fanFavoriteTVShowsResponse] =
    await Promise.all([
      fetchTMDBData("/discover/movie", {
        with_genres: "16|10751|12|878|35|28|10765",
        sort_by: "popularity.desc",
        "vote_average.gte": "7.0",
        "release_date.gte": "2005-01-01",
        "release_date.lte": "2025-07-12",
        "vote_count.gte": "1500",
        include_adult: "false",
        language: "en-US",
        region: "US",
      }),
      fetchTMDBData("/discover/tv", {
        with_genres: "16|10751|12|878|35|28|10765",
        sort_by: "popularity.desc",
        "vote_average.gte": "7.0",
        "first_air_date.gte": "2005-01-01",
        "first_air_date.lte": "2025-07-12",
        "vote_count.gte": "1500",
        include_adult: "false",
        language: "en-US",
      }),
    ]);

  const fanFavoriteMovies = fanFavoriteMoviesResponse?.results ?? [];
  const fanFavoriteTVShows = fanFavoriteTVShowsResponse?.results ?? [];

  const moviesWithType = fanFavoriteMovies.map((item: MediaItem) => ({
    ...item,
    media_type: "movie" as const,
  }));

  const tvShowsWithType = fanFavoriteTVShows.map((item: MediaItem) => ({
    ...item,
    media_type: "tv" as const,
  }));

  const combinedFanFavorites = [...moviesWithType, ...tvShowsWithType];

  if (combinedFanFavorites.length === 0) {
    return [];
  }

  const seenIds = new Set<number>();
  const filteredFanFavoriteContent = combinedFanFavorites
    .filter((item: MediaItem) => {
      if (!item.poster_path) return false;
      if (seenIds.has(item.id)) return false;
      if (item.title === "28 Days Later" || item.name === "28 Days Later")
        return false;
      if (item.id === 986056) return false;
      seenIds.add(item.id);
      return true;
    })
    .sort((a, b) => b.vote_average - a.vote_average)
    .slice(1, 10);

  const moviesToEnrich = filteredFanFavoriteContent.filter(
    (item) => item.media_type === "movie",
  );
  const tvShowsToEnrich = filteredFanFavoriteContent.filter(
    (item) => item.media_type === "tv",
  );

  const [enrichedMovies, enrichedTVShows] = await Promise.all([
    moviesToEnrich.length > 0
      ? fetchAndEnrichMediaItems(moviesToEnrich, "movie")
      : Promise.resolve([]),
    tvShowsToEnrich.length > 0
      ? fetchAndEnrichMediaItems(tvShowsToEnrich, "tv")
      : Promise.resolve([]),
  ]);

  return [...enrichedMovies, ...enrichedTVShows].sort(
    (a, b) => b.vote_average - a.vote_average,
  );
}

export default async function Home() {
  const heroCarouselPromise = getHeroCarouselData();

  const recommendedRows = getRecommendedRowsForPage("home");

  const contentRowsConfig = recommendedRows
    .map((rowId) => {
      const config = getRowConfig(rowId);
      if (!config) return null;

      const customTitles: Record<string, string> = {
        "top-rated-movies": "Top Rated Movies",
        "top-rated-tvshows": "Top Rated TV Shows",
        "early-2000s-movies": "Early 2000s Movies",
        "popular-movies": "Popular Movies",
        "popular-tvshows": "Popular TV Shows",
        "nolan-films": "Christopher Nolan Films",
        "scifi-fantasy-movies": "Sci-Fi & Fantasy Movies",
        "binge-worthy-series": "Binge-Worthy Series",
        "comedy-movies": "Comedies",
        "a24-films": "A24 Films",
        "thriller-movies": "Edge of Your Seat Thrillers",
        "limited-series": "Limited Series",
        "drama-movies": "Dramas",
        "critically-acclaimed": "Critically Acclaimed",
        "eighties-movies": "80s Movies",
        "reality-tv": "Reality TV",
        "nineties-movies": "90s Movies",
        "romcom-movies": "Rom-Coms",
        docuseries: "Docuseries",
        "hidden-gems": "Hidden Gems",
        "marvel-mcu": "Marvel Studios",
        "horror-movies": "Spine Chilling Horror",
        "crime-movies": "Crime Movies",
        "mystery-movies": "Mystery Movies",
        "warner-bros": "Warner Bros. Films",
        "universal-films": "Universal Pictures",
        "spielberg-films": "Steven Spielberg Films",
        "scorsese-films": "Martin Scorsese Films",
        "fincher-films": "David Fincher Films",
        "villeneuve-films": "Denis Villeneuve Films",
        "blockbuster-hits": "Blockbuster Hits",
      };

      const generateHref = (config: {
        category: string;
        mediaType: string;
      }) => {
        const { category, mediaType } = config;
        const baseUrl = mediaType === "tv" ? "/tvshows" : "/movies";
        if (category.startsWith("genre-")) {
          return `${baseUrl}/browse?genre=${category.replace("genre-", "")}`;
        } else if (category.startsWith("director-")) {
          return `${baseUrl}/browse?type=${category}`;
        } else if (category.startsWith("studio-")) {
          return `${baseUrl}/browse?type=${category}`;
        } else if (category.startsWith("year-")) {
          return `${baseUrl}/browse?year=${category.replace("year-", "")}`;
        } else if (category.startsWith("tv-")) {
          return `${baseUrl}/browse?filter=${category}`;
        } else {
          return `${baseUrl}/browse?filter=${category}`;
        }
      };

      return {
        rowId,
        title:
          customTitles[rowId] ||
          rowId
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
        href: generateHref(config),
        variant:
          rowId === "top-rated-movies" || rowId === "top-rated-tvshows"
            ? ("ranked" as const)
            : undefined,
        enrich: rowId !== "marvel-mcu",
      };
    })
    .filter(Boolean) as Array<{
    rowId: string;
    title: string;
    href: string;
    variant?: "ranked";
    enrich?: boolean;
  }>;

  return (
    <div>
      <PageBackground imageUrl="/movie-banner.webp" title="Home" />
      <main>
        <Suspense
          fallback={
            <div className="relative h-[75vh] md:h-[85vh] lg:h-[92vh] overflow-hidden bg-black" />
          }
        >
          <StreamingMediaCarousel itemsPromise={heroCarouselPromise} />
        </Suspense>
        <div className="relative z-10 min-h-[200vh]">
          <LazyContentRowsDynamic
            rows={contentRowsConfig}
            initialCount={2}
            batchSize={1}
            rootMargin="100px"
          />
        </div>
      </main>
    </div>
  );
}
