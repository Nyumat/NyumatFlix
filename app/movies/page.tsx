import { SuspenseContentRow } from "@/components/content/suspense-content-row";
import { MediaCarousel } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";
import { fetchAndEnrichMediaItems, fetchTMDBData } from "../actions";

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

  return (
    <>
      {/* Hero carousel for trending movies */}
      <MediaCarousel items={enrichedTrendingItems.slice(0, 5)} />

      {/* Content rows section with background */}
      <div className="relative min-h-screen">
        <div className="absolute inset-0 w-full min-h-full z-0">
          <div
            className="w-full min-h-full bg-repeat bg-center"
            style={{
              backgroundImage: "url('/movie-banner.jpg')",
              filter: "blur(8px)",
              opacity: 0.3,
            }}
          />
        </div>
        <div className="relative z-10">
          <ContentContainer>
            {/* Recent Releases - moved to top */}
            <SuspenseContentRow
              rowId="recent-releases"
              title="New Releases"
              href="/movies/browse?year=2023"
            />

            {/* Upcoming Releases - new section */}
            <SuspenseContentRow
              rowId="upcoming-movies"
              title="Coming Soon"
              href="/movies/browse?type=upcoming"
            />

            {/* Convert static Popular Movies to ContentRowLoader */}
            <SuspenseContentRow
              rowId="popular-movies"
              title="Popular Movies"
              href="/movies/browse?type=popular"
              variant="standard"
            />

            {/* Director Showcases */}
            <SuspenseContentRow
              rowId="nolan-films"
              title="Christopher Nolan Films"
              href="/movies/browse?type=director-nolan"
            />

            {/* Genre-Based Categories */}
            <SuspenseContentRow
              rowId="action-movies"
              title="Action-Packed Adventures"
              href="/movies/browse?genre=28"
            />

            {/* Studio Spotlights */}
            <SuspenseContentRow
              rowId="a24-films"
              title="A24 Films"
              href="/movies/browse?type=studio-a24"
            />

            {/* Convert static Top Rated Movies to ContentRowLoader */}
            <SuspenseContentRow
              rowId="top-rated-movies"
              title="Top Rated Movies"
              href="/movies/browse?type=top-rated"
              variant="ranked"
            />

            <SuspenseContentRow
              rowId="scifi-fantasy-movies"
              title="Sci-Fi & Fantasy Worlds"
              href="/movies/browse?genre=878,14"
            />

            <SuspenseContentRow
              rowId="tarantino-films"
              title="Quentin Tarantino's Collection"
              href="/movies/browse?type=director-tarantino"
            />

            <SuspenseContentRow
              rowId="comedy-movies"
              title="Laugh Out Loud (Comedies)"
              href="/movies/browse?genre=35"
            />

            <SuspenseContentRow
              rowId="disney-magic"
              title="Disney Magic"
              href="/movies/browse?type=studio-disney"
            />

            {/* Curated Picks */}
            <SuspenseContentRow
              rowId="critically-acclaimed"
              title="Critically Acclaimed"
              href="/movies/browse?filter=critically_acclaimed"
            />

            <SuspenseContentRow
              rowId="thriller-movies"
              title="Edge-of-Your-Seat Thrillers"
              href="/movies/browse?genre=53"
            />

            <SuspenseContentRow
              rowId="spielberg-films"
              title="Steven Spielberg Classics"
              href="/movies/browse?type=director-spielberg"
            />

            <SuspenseContentRow
              rowId="pixar-animation"
              title="Pixar Animation"
              href="/movies/browse?type=studio-pixar"
            />

            <SuspenseContentRow
              rowId="drama-movies"
              title="Heartfelt Dramas"
              href="/movies/browse?genre=18"
            />

            <SuspenseContentRow
              rowId="scorsese-films"
              title="Martin Scorsese's Masterpieces"
              href="/movies/browse?type=director-scorsese"
            />

            <SuspenseContentRow
              rowId="romcom-movies"
              title="Chill with Rom-Coms"
              href="/movies/browse?genre=10749,35"
            />

            <SuspenseContentRow
              rowId="hidden-gems"
              title="Hidden Gems"
              href="/movies/browse?filter=hidden_gems"
            />

            {/* Time-Based Categories */}
            <SuspenseContentRow
              rowId="eighties-movies"
              title="80s Throwbacks"
              href="/movies/browse?year=1980-1989"
            />

            <SuspenseContentRow
              rowId="nineties-movies"
              title="90s Favorites"
              href="/movies/browse?year=1990-1999"
            />

            <SuspenseContentRow
              rowId="early-2000s-movies"
              title="Early 2000s Nostalgia"
              href="/movies/browse?year=2000-2009"
            />
          </ContentContainer>
        </div>
      </div>
    </>
  );
}
