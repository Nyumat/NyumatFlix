import { MediaCarousel } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { ProgressiveContentLoader } from "@/components/layout/progressive-content-loader";
import { fetchMultipleContentRows } from "@/lib/content-row-fetcher";
import {
  getRecommendedRowsForPage,
  getRowConfig,
} from "@/utils/content-filters";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";
import { fetchAndEnrichMediaItems, fetchTMDBData } from "../actions";
import { LazyContentRowsDynamic } from "./client-components";

export const metadata: Metadata = {
  title: "Movies | NyumatFlix",
  description: "Discover popular and top-rated movies on NyumatFlix.",
  openGraph: {
    title: "Movies | NyumatFlix",
    description: "Discover popular and top-rated movies on NyumatFlix.",
    type: "website",
    siteName: "NyumatFlix",
  },
  twitter: {
    title: "Movies | NyumatFlix",
    description: "Discover popular and top-rated movies on NyumatFlix.",
  },
  alternates: {
    canonical: "https://nyumatflix.com/movies",
  },
};

export interface Movie {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  categories?: string[];
}

export default async function MoviesPage() {
  const trendingMoviesResponse = await fetchTMDBData("/discover/movie", {
    sort_by: "popularity.desc",
    with_genres: "28|12|16|35|878|10749|10751|10765",
    "release_date.gte": "2023-01-01",
    "release_date.lte": "2025-07-12",
    "vote_count.gte": "100",
    include_adult: "false",
    language: "en-US",
    region: "US",
  });

  const basicTrendingItems =
    trendingMoviesResponse.results
      ?.filter(
        (movie): movie is Movie =>
          typeof movie === "object" &&
          movie !== null &&
          "id" in movie &&
          typeof movie.id === "number" &&
          movie.id !== 1011477,
      )
      .slice(0, 10) || [];

  const enrichedTrendingItems = await fetchAndEnrichMediaItems(
    basicTrendingItems as MediaItem[],
    "movie",
  );

  const recommendedRows = getRecommendedRowsForPage("movies");

  const contentRowsConfig = recommendedRows
    .map((rowId) => {
      const config = getRowConfig(rowId);
      if (!config) return null;

      const customTitles: Record<string, string> = {
        "top-rated-movies": "Top Rated Movies",
        "drama-movies": "Drama Movies",
        "disney-magic": "Disney Movies",
        "nineties-movies": "90s Movies",
        "scifi-fantasy-movies": "Sci-Fi & Fantasy Movies",
        "recent-releases": "Just Dropped",
        "spielberg-films": "Steven Spielberg Movies",
        "hidden-gems": "Hidden Gems",
        "comedy-movies": "Comedy Movies",
        "early-2000s-movies": "2000s Movies",
        "nolan-films": "Christopher Nolan Movies",
        "pixar-animation": "Pixar Movies",
        "upcoming-movies": "Upcoming Movies",
        "scorsese-films": "Martin Scorsese Movies",
        "a24-films": "A24 Movies",
        "eighties-movies": "80s Movies",
        "popular-movies": "Popular Movies",
        "critically-acclaimed": "Critically Acclaimed Movies",
        "action-movies": "Action Movies",
        "tarantino-films": "Quentin Tarantino Movies",
        "thriller-movies": "Thriller Movies",
        "romcom-movies": "Romantic Comedies",
        "horror-movies": "Horror Movies",
        "crime-movies": "Crime Movies",
        "mystery-movies": "Mystery Movies",
        "romance-movies": "Romance Movies",
        "warner-bros": "Warner Bros. Pictures",
        "universal-films": "Universal Pictures",
        "dreamworks-films": "DreamWorks Pictures",
        "fincher-films": "David Fincher Movies",
        "villeneuve-films": "Denis Villeneuve Movies",
        "wes-anderson-films": "Wes Anderson Movies",
      };

      const generateHref = (config: { category: string }) => {
        const { category } = config;
        if (category.startsWith("genre-")) {
          const genreMap: Record<string, string> = {
            "genre-action": "28",
            "genre-comedy": "35",
            "genre-drama": "18",
            "genre-thriller": "53",
            "genre-scifi-fantasy": "878,14",
            "genre-romcom": "10749,35",
            "genre-horror": "27",
            "genre-crime": "80",
            "genre-mystery": "9648",
            "genre-romance": "10749",
          };
          return `/movies/browse?genre=${genreMap[category] || category.replace("genre-", "")}`;
        } else if (category.startsWith("director-")) {
          return `/movies/browse?type=${category}`;
        } else if (category.startsWith("studio-")) {
          return `/movies/browse?type=${category}`;
        } else if (category.startsWith("year-")) {
          const yearMap: Record<string, string> = {
            "year-80s": "1980-1989",
            "year-90s": "1990-1999",
            "year-2000s": "2000-2009",
            "year-2010s": "2010-2019",
          };
          return `/movies/browse?year=${yearMap[category] || category.replace("year-", "")}`;
        } else if (
          ["upcoming", "popular", "top-rated", "now-playing"].includes(category)
        ) {
          return category === "popular"
            ? "/movies/browse"
            : `/movies/browse?type=${category}`;
        } else {
          return `/movies/browse?filter=${category.replace(/^(critically-|hidden-|blockbuster-|award-|cult-|indie-)/, "")}`;
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
      };
    })
    .filter(Boolean) as Array<{
    rowId: string;
    title: string;
    href: string;
    variant?: "ranked";
  }>;

  const heroIds = new Set(enrichedTrendingItems.map((item) => item.id));

  // Load only the first 2 rows initially for progressive loading
  const initialRowCount = 2;
  const initialRowsConfig = contentRowsConfig.slice(0, initialRowCount);
  const remainingRowsConfig = contentRowsConfig.slice(initialRowCount);

  // Load initial rows data
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
      result?.items.filter((item) => !heroIds.has(item.id)) || [];

    return {
      ...config,
      items: filteredItems,
    };
  });

  // Create server action to load next batch of rows
  const getNextRows = async (
    remainingRows: typeof contentRowsConfig,
    batchSize: number = 3,
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
        result?.items.filter((item) => Boolean(item.poster_path)) || []; // Only filter by poster_path

      return {
        ...config,
        items: filteredItems,
      };
    });
  };

  return (
    <>
      <PageBackground imageUrl="/movie-banner.webp" title="Movies" />
      <MediaCarousel items={enrichedTrendingItems} />
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
        <div className="relative z-10 min-h-[300vh] pb-32">
          <ContentContainer>
            <ProgressiveContentLoader
              initialRows={initialContentRowsData}
              remainingRowsConfig={remainingRowsConfig}
              getNextRows={getNextRows}
            />
          </ContentContainer>
        </div>
      </div>
    </>
  );
}
