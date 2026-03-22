import { pages } from "@/config/pages";
import type { MovieCatalogView, TvCatalogView } from "@/lib/catalog-query";

export const getMovieCatalogListCopy = (
  view: MovieCatalogView,
): { title: string; description: string } => {
  switch (view) {
    case "discover":
      return {
        title: pages.movie.discover.title,
        description: pages.movie.discover.description,
      };
    case "popular":
      return {
        title: pages.movie.popular.title,
        description: pages.movie.popular.description,
      };
    case "now_playing":
      return {
        title: pages.movie.nowPlaying.title,
        description: pages.movie.nowPlaying.description,
      };
    case "top_rated":
      return {
        title: pages.movie.topRated.title,
        description: pages.movie.topRated.description,
      };
    case "trending":
      return {
        title: pages.trending.movie.title,
        description: pages.trending.movie.description,
      };
    default:
      return {
        title: pages.movie.discover.title,
        description: pages.movie.discover.description,
      };
  }
};

export const getTvCatalogListCopy = (
  view: TvCatalogView,
): { title: string; description: string } => {
  switch (view) {
    case "discover":
      return {
        title: pages.tv.discover.title,
        description: pages.tv.discover.description,
      };
    case "popular":
      return {
        title: pages.tv.popular.title,
        description: pages.tv.popular.description,
      };
    case "on_the_air":
      return {
        title: pages.tv.onTheAir.title,
        description: pages.tv.onTheAir.description,
      };
    case "airing_today":
      return {
        title: pages.tv.airingToday.title,
        description: pages.tv.airingToday.description,
      };
    case "top_rated":
      return {
        title: pages.tv.topRated.title,
        description: pages.tv.topRated.description,
      };
    case "trending":
      return {
        title: pages.trending.tv.title,
        description: pages.trending.tv.description,
      };
    default:
      return {
        title: pages.tv.discover.title,
        description: pages.tv.discover.description,
      };
  }
};
