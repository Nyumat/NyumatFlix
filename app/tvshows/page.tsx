import { ContentRowActual } from "@/components/content-row";
import { buildItemsWithCategories, fetchTMDBData } from "../actions";

export default async function TVShowsPage() {
  const [popularMovies, topRatedMovies] = await Promise.all([
    fetchTMDBData("/tv/popular"),
    fetchTMDBData("/tv/top_rated"),
  ]);

  const popularTVShowsWithCategories = await buildItemsWithCategories(
    popularMovies.results,
    "tv",
  );
  const topRatedTVShowsWithCategories = await buildItemsWithCategories(
    topRatedMovies.results,
    "tv",
  );

  return (
    <>
      <ContentRowActual
        title="Popular TV Shows"
        items={popularTVShowsWithCategories}
        href="/tvshows?sort=popular"
      />
      <ContentRowActual
        title="Top Rated TV Shows"
        items={topRatedTVShowsWithCategories}
        href="/tvshows?sort=top_rated"
      />
    </>
  );
}
