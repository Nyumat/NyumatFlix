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
  const trendingMoviesResponse = await fetchTMDBData("/trending/movie/week");
  const basicTrendingItems = trendingMoviesResponse.results?.slice(0, 5) || [];

  const enrichedTrendingItems = await fetchAndEnrichMediaItems(
    basicTrendingItems as MediaItem[],
    "movie",
  );

  return (
    <>
      <MediaCarousel items={enrichedTrendingItems} />
      <div className="relative">
        <div className="absolute inset-0 w-full h-full z-0">
          <div
            className="w-full h-full bg-repeat bg-center"
            style={{
              backgroundImage: "url('/movie-banner.jpg')",
              filter: "blur(8px)",
              opacity: 0.3,
            }}
          />
        </div>
        <div className="relative z-10 min-h-[200vh]">
          <ContentContainer>
            <SuspenseContentRow
              rowId="top-rated-movies"
              title="Top Rated Movies"
              href="/movies/browse?type=top-rated"
              variant="ranked"
            />

            <SuspenseContentRow
              rowId="drama-movies"
              title="Drama Movies"
              href="/movies/browse?genre=18"
            />

            <SuspenseContentRow
              rowId="disney-magic"
              title="Disney Movies"
              href="/movies/browse?type=studio-disney"
            />

            <SuspenseContentRow
              rowId="nineties-movies"
              title="90s Movies"
              href="/movies/browse?year=1990-1999"
            />

            <SuspenseContentRow
              rowId="scifi-fantasy-movies"
              title="Sci-Fi & Fantasy Movies"
              href="/movies/browse?genre=878,14"
            />

            <SuspenseContentRow
              rowId="recent-releases"
              title="New Releases"
              href="/movies/browse?year=2023"
            />

            <SuspenseContentRow
              rowId="spielberg-films"
              title="Steven Spielberg Movies"
              href="/movies/browse?type=director-spielberg"
            />

            <SuspenseContentRow
              rowId="hidden-gems"
              title="Hidden Gems"
              href="/movies/browse?filter=hidden_gems"
            />

            <SuspenseContentRow
              rowId="comedy-movies"
              title="Comedy Movies"
              href="/movies/browse?genre=35"
            />

            <SuspenseContentRow
              rowId="early-2000s-movies"
              title="2000s Movies"
              href="/movies/browse?year=2000-2009"
            />

            <SuspenseContentRow
              rowId="nolan-films"
              title="Christopher Nolan Movies"
              href="/movies/browse?type=director-nolan"
            />

            <SuspenseContentRow
              rowId="pixar-animation"
              title="Pixar Movies"
              href="/movies/browse?type=studio-pixar"
            />

            <SuspenseContentRow
              rowId="upcoming-movies"
              title="Upcoming Movies"
              href="/movies/browse?type=upcoming"
            />
            <SuspenseContentRow
              rowId="scorsese-films"
              title="Martin Scorsese Movies"
              href="/movies/browse?type=director-scorsese"
            />

            <SuspenseContentRow
              rowId="a24-films"
              title="A24 Movies"
              href="/movies/browse?type=studio-a24"
            />

            <SuspenseContentRow
              rowId="eighties-movies"
              title="80s Movies"
              href="/movies/browse?year=1980-1989"
            />
            <SuspenseContentRow
              rowId="popular-movies"
              title="Popular Movies"
              href="/movies/browse?type=popular"
              variant="standard"
            />

            <SuspenseContentRow
              rowId="critically-acclaimed"
              title="Critically Acclaimed Movies"
              href="/movies/browse?filter=critically_acclaimed"
            />

            <SuspenseContentRow
              rowId="action-movies"
              title="Action Movies"
              href="/movies/browse?genre=28"
            />

            <SuspenseContentRow
              rowId="tarantino-films"
              title="Quentin Tarantino Movies"
              href="/movies/browse?type=director-tarantino"
            />

            <SuspenseContentRow
              rowId="thriller-movies"
              title="Thriller Movies"
              href="/movies/browse?genre=53"
            />

            <SuspenseContentRow
              rowId="romcom-movies"
              title="Romantic Comedies"
              href="/movies/browse?genre=10749,35"
            />
          </ContentContainer>
        </div>
      </div>
    </>
  );
}
