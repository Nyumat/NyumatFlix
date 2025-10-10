import { ProgressiveContentLoader } from "@/components/layout/progressive-content-loader";
import { fetchMultipleContentRows } from "@/lib/content-row-fetcher";
import {
  getRecommendedRowsForPage,
  getRowConfig,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { fetchAndEnrichMediaItems, fetchTMDBData } from "../actions";
import { DynamicMediaCarousel } from "./client-components";

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

export default async function Home() {
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
    return null;
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

  const fanFavoriteContentProcessedForHero = [
    ...enrichedMovies,
    ...enrichedTVShows,
  ].sort((a, b) => b.vote_average - a.vote_average);

  const recommendedRows = getRecommendedRowsForPage("home");

  const contentRowsConfig = recommendedRows
    .map((rowId) => {
      const config = getRowConfig(rowId);
      if (!config) return null;

      const customTitles: Record<string, string> = {
        "top-rated-movies": "Top Rated Movies",
        "early-2000s-movies": "Early 2000s Nostalgia",
        "popular-movies": "Popular Movies",
        "popular-tvshows": "Popular TV Shows",
        "nolan-films": "Christopher Nolan Films",
        "scifi-fantasy-movies": "Sci-Fi & Fantasy Worlds",
        "binge-worthy-series": "Binge-Worthy Series",
        "comedy-movies": "Laugh Out Loud (Comedies)",
        "a24-films": "A24 Films",
        "thriller-movies": "Edge-of-Your-Seat Thrillers",
        "limited-series": "Limited Series That Hit Hard",
        "drama-movies": "Heartfelt Dramas",
        "critically-acclaimed": "Critically Acclaimed",
        "eighties-movies": "80s Throwbacks",
        "reality-tv": "Reality TV Picks",
        "nineties-movies": "90s Favorites",
        "romcom-movies": "Chill with Rom-Coms",
        docuseries: "Docuseries You Can't Miss",
        "hidden-gems": "Hidden Gems",
        "marvel-mcu": "Marvel Cinematic Universe",
        "horror-movies": "Spine-Chilling Horror",
        "crime-movies": "Crime & Justice",
        "mystery-movies": "Mind-Bending Mysteries",
        "warner-bros": "Warner Bros. Classics",
        "universal-films": "Universal Pictures",
        "spielberg-films": "Steven Spielberg Masterpieces",
        "scorsese-films": "Martin Scorsese Classics",
        "fincher-films": "David Fincher Thrillers",
        "villeneuve-films": "Denis Villeneuve Epics",
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
        variant: rowId === "top-rated-movies" ? ("ranked" as const) : undefined,
        enrich: true, // Enable content rating enrichment for all rows
      };
    })
    .filter(Boolean) as Array<{
    rowId: string;
    title: string;
    href: string;
    variant?: "ranked";
    enrich?: boolean;
  }>;

  // Load only the first row initially for progressive loading
  const initialRowCount = 1;
  const initialRowsConfig = contentRowsConfig.slice(0, initialRowCount);
  const remainingRowsConfig = contentRowsConfig.slice(initialRowCount);

  // Load initial row data
  const initialContentRowResults = await fetchMultipleContentRows(
    initialRowsConfig.map((config) => ({
      rowId: config.rowId,
      minCount: 20,
    })),
  );

  const initialContentRowsData = initialRowsConfig.map((config) => {
    const result = initialContentRowResults.find(
      (r) => r.rowId === config.rowId,
    );
    const filteredItems =
      result?.items.filter((item) => Boolean(item.poster_path)) || [];

    return {
      ...config,
      items: filteredItems,
    };
  });

  // Create server action to load next batch of rows
  const getNextRows = async (
    remainingRows: typeof contentRowsConfig,
    batchSize: number = 1,
  ): Promise<typeof contentRowsConfig> => {
    "use server";
    if (remainingRows.length === 0) return [];

    // Load next batch of rows
    const nextBatch = remainingRows.slice(
      0,
      Math.min(batchSize, remainingRows.length),
    );

    const nextRowResults = await fetchMultipleContentRows(
      nextBatch.map((config) => ({
        rowId: config.rowId,
        minCount: 20,
      })),
    );

    return nextBatch.map((config) => {
      const result = nextRowResults.find((r) => r.rowId === config.rowId);
      const filteredItems =
        result?.items.filter((item) => Boolean(item.poster_path)) || [];

      return {
        ...config,
        items: filteredItems,
      };
    });
  };

  return (
    <div>
      <PageBackground imageUrl="/movie-banner.webp" title="Home" />
      <main>
        <DynamicMediaCarousel items={fanFavoriteContentProcessedForHero} />
        <div className="relative">
          <div className="absolute inset-0 w-full h-full z-0">
            <div
              className="w-full h-full bg-repeat bg-center"
              style={{
                backgroundImage: "url('/movie-banner.webp')",
                filter: "blur(8px)",
                opacity: 0.3,
              }}
            />
          </div>
          <div className="relative z-10 min-h-[200vh]">
            <ProgressiveContentLoader
              initialRows={initialContentRowsData}
              remainingRowsConfig={remainingRowsConfig}
              getNextRows={getNextRows}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
