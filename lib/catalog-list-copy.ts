import { pages } from "@/config/pages";
import type { MovieCatalogView, TvCatalogView } from "@/lib/catalog-query";

export const getMovieCatalogListCopy = (
  view: MovieCatalogView,
): { title: string } => {
  switch (view) {
    case "discover":
      return {
        title: pages.movie.discover.title,
      };
    case "popular":
      return {
        title: pages.movie.popular.title,
      };
    case "now_playing":
      return {
        title: pages.movie.nowPlaying.title,
      };
    case "top_rated":
      return {
        title: pages.movie.topRated.title,
      };
    case "trending":
      return {
        title: pages.trending.movie.title,
      };
    default:
      return {
        title: pages.movie.discover.title,
      };
  }
};

export const getTvCatalogListCopy = (view: TvCatalogView): { title: string } => {
  switch (view) {
    case "discover":
      return {
        title: pages.tv.discover.title,
      };
    case "popular":
      return {
        title: pages.tv.popular.title,
      };
    case "on_the_air":
      return {
        title: pages.tv.onTheAir.title,
      };
    case "airing_today":
      return {
        title: pages.tv.airingToday.title,
      };
    case "top_rated":
      return {
        title: pages.tv.topRated.title,
      };
    case "trending":
      return {
        title: pages.trending.tv.title,
      };
    default:
      return {
        title: pages.tv.discover.title,
      };
  }
};
