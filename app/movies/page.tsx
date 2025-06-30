import { ContentRow } from "@/components/content/content-row";
import { ContentRowLoader } from "@/components/content/content-row-loader";
import { TrendingHeroCarousel } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { AggressivePrefetchProvider } from "@/components/providers/aggressive-prefetch-provider";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";
import { Suspense } from "react";
import {
  buildItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchMovieCertification,
  fetchTMDBData,
} from "../actions";

export const metadata: Metadata = {
  title: "Movies | NyumatFlix",
  description:
    "Discover popular and top-rated movies. Stream your favorites instantly on NyumatFlix.",
  openGraph: {
    title: "Movies | NyumatFlix",
    description:
      "Discover popular and top-rated movies. Stream your favorites instantly on NyumatFlix.",
    type: "website",
    siteName: "NyumatFlix",
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
  // Fetch trending movies for hero carousel
  const trendingMoviesResponse = await fetchTMDBData("/trending/movie/week");
  const basicTrendingItems = trendingMoviesResponse.results?.slice(0, 10) || [];

  // Enrich these items with logos and full video details
  const enrichedTrendingItems = await fetchAndEnrichMediaItems(
    basicTrendingItems as MediaItem[],
    "movie",
  );

  const [popularMovies, topRatedMovies] = await Promise.all([
    fetchTMDBData("/movie/popular"),
    fetchTMDBData("/movie/top_rated"),
  ]);

  const popularMoviesWithCategories = await buildItemsWithCategories<MediaItem>(
    popularMovies.results ?? [],
    "movie",
  );
  const topRatedMoviesWithCategories =
    await buildItemsWithCategories<MediaItem>(
      topRatedMovies.results ?? [],
      "movie",
    );

  const certifications: Record<number, string | null> = {};

  const allMovies = [
    ...popularMoviesWithCategories,
    ...topRatedMoviesWithCategories,
  ];

  const processedIds = new Set<number>();
  const certificationPromises = allMovies.map(async (movie) => {
    if (processedIds.has(movie.id)) return;

    processedIds.add(movie.id);
    const cert = await fetchMovieCertification(movie.id);
    if (cert) {
      certifications[movie.id] = cert;
    }
  });

  await Promise.all(certificationPromises);

  return (
    <AggressivePrefetchProvider
      items={[
        ...enrichedTrendingItems,
        ...popularMoviesWithCategories,
        ...topRatedMoviesWithCategories,
      ]}
      enableImmediate={true}
    >
      {/* Hero carousel for trending movies */}
      <TrendingHeroCarousel items={enrichedTrendingItems.slice(0, 5)} />

      <ContentContainer>
        {/* Recent Releases - moved to top */}
        <Suspense>
          <ContentRowLoader
            rowId="recent-releases"
            title="New Releases"
            href="/movies/browse?year=2023"
          />
        </Suspense>

        {/* Upcoming Releases - new section */}
        <Suspense>
          <ContentRowLoader
            rowId="upcoming-movies"
            title="Coming Soon"
            href="/movies/browse?type=upcoming"
          />
        </Suspense>

        <ContentRow
          title="Popular Movies"
          items={popularMoviesWithCategories}
          href="/movies/browse?type=popular"
          variant="ranked"
          contentRating={certifications}
        />

        {/* Director Showcases */}
        <Suspense>
          <ContentRowLoader
            rowId="nolan-films"
            title="Christopher Nolan Films"
            href="/movies/browse?type=director-nolan"
          />
        </Suspense>

        {/* Genre-Based Categories */}
        <Suspense>
          <ContentRowLoader
            rowId="action-movies"
            title="Action-Packed Adventures"
            href="/movies/browse?genre=28"
          />
        </Suspense>

        {/* Studio Spotlights */}
        <Suspense>
          <ContentRowLoader
            rowId="a24-films"
            title="A24 Films"
            href="/movies/browse?type=studio-a24"
          />
        </Suspense>

        <ContentRow
          title="Top Rated Movies"
          items={topRatedMoviesWithCategories}
          href="/movies/browse?type=top-rated"
          contentRating={certifications}
        />

        <Suspense>
          <ContentRowLoader
            rowId="scifi-fantasy-movies"
            title="Sci-Fi & Fantasy Worlds"
            href="/movies/browse?genre=878,14"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="tarantino-films"
            title="Quentin Tarantino's Collection"
            href="/movies/browse?type=director-tarantino"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="comedy-movies"
            title="Laugh Out Loud (Comedies)"
            href="/movies/browse?genre=35"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="disney-magic"
            title="Disney Magic"
            href="/movies/browse?type=studio-disney"
          />
        </Suspense>

        {/* Curated Picks */}
        <Suspense>
          <ContentRowLoader
            rowId="critically-acclaimed"
            title="Critically Acclaimed"
            href="/movies/browse?filter=critically_acclaimed"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="thriller-movies"
            title="Edge-of-Your-Seat Thrillers"
            href="/movies/browse?genre=53"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="spielberg-films"
            title="Steven Spielberg Classics"
            href="/movies/browse?type=director-spielberg"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="pixar-animation"
            title="Pixar Animation"
            href="/movies/browse?type=studio-pixar"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="drama-movies"
            title="Heartfelt Dramas"
            href="/movies/browse?genre=18"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="scorsese-films"
            title="Martin Scorsese's Masterpieces"
            href="/movies/browse?type=director-scorsese"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="romcom-movies"
            title="Chill with Rom-Coms"
            href="/movies/browse?genre=10749,35"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="hidden-gems"
            title="Hidden Gems"
            href="/movies/browse?filter=hidden_gems"
          />
        </Suspense>

        {/* Time-Based Categories */}
        <Suspense>
          <ContentRowLoader
            rowId="eighties-movies"
            title="80s Throwbacks"
            href="/movies/browse?year=1980-1989"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="nineties-movies"
            title="90s Favorites"
            href="/movies/browse?year=1990-1999"
          />
        </Suspense>

        <Suspense>
          <ContentRowLoader
            rowId="early-2000s-movies"
            title="Early 2000s Nostalgia"
            href="/movies/browse?year=2000-2009"
          />
        </Suspense>
      </ContentContainer>
    </AggressivePrefetchProvider>
  );
}
