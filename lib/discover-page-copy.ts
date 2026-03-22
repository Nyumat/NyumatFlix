import { getGenreName } from "@/components/content/genre-helpers";
import { pages } from "@/config/pages";
import { getCatalogLayoutState } from "@/lib/catalog-page-state";
import {
  getDiscoverSlugTitle,
  getYearDiscoverTitle,
} from "@/lib/discover-copy-titles";
import { parseMovieView, parseTvView } from "@/lib/catalog-query";

const titleFromWithGenres = (
  raw: string,
  mediaType: "movie" | "tv",
): string | null => {
  const ids = raw
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  const names = ids
    .map((id) => getGenreName(id, mediaType))
    .filter((n) => n !== "Unknown" && n !== "N/A");
  if (names.length === 0) return null;
  return names.join(" · ");
};

export const getDiscoverCatalogCopy = (
  sp: Record<string, string>,
  mediaType: "movie" | "tv",
): { title: string; description: string } | null => {
  const view =
    mediaType === "movie" ? parseMovieView(sp.view) : parseTvView(sp.view);
  if (view !== "discover") {
    return null;
  }

  const typeParam = sp.type?.trim();
  const filterParam = sp.filter?.trim();
  const yearParam = sp.year?.trim();
  const layoutState = getCatalogLayoutState(sp, view);

  const rootTitle =
    mediaType === "movie" ? pages.movie.root.title : pages.tv.root.title;

  if (typeParam) {
    const t = getDiscoverSlugTitle(typeParam);
    if (t) return { title: t, description: "" };
    return { title: rootTitle, description: "" };
  }

  if (filterParam) {
    const t = getDiscoverSlugTitle(filterParam);
    if (t) return { title: t, description: "" };
    return { title: rootTitle, description: "" };
  }

  if (yearParam) {
    return {
      title: getYearDiscoverTitle(yearParam, mediaType),
      description: "",
    };
  }

  const withGenresRaw = sp.with_genres?.trim();
  if (withGenresRaw) {
    const genreTitle = titleFromWithGenres(withGenresRaw, mediaType);
    if (genreTitle) {
      return { title: genreTitle, description: "" };
    }
  }

  if (!layoutState.isHubLayout) {
    return { title: rootTitle, description: "" };
  }

  return null;
};
