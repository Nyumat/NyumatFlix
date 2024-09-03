import { ContentRowActual } from "@/components/content-row";
import { fetchTMDBData, buildItemsWithCategories } from "../actions";

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
  const [popularMovies, topRatedMovies] = await Promise.all([
    fetchTMDBData("/movie/popular"),
    fetchTMDBData("/movie/top_rated"),
  ]);

  const popularMoviesWithCategories = await buildItemsWithCategories(
    popularMovies.results,
    "movie",
  );
  const topRatedMoviesWithCategories = await buildItemsWithCategories(
    topRatedMovies.results,
    "movie",
  );

  return (
    <>
      <ContentRowActual
        title="Popular Movies"
        items={popularMoviesWithCategories}
        href="/movies?sort=popular"
      />
      <ContentRowActual
        title="Top Rated Movies"
        items={topRatedMoviesWithCategories}
        href="/movies?sort=top_rated"
      />
    </>
  );
}
