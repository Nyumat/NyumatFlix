import { getGenreName } from "@/components/content/genre-helpers";
import { pages } from "@/config/pages";
import {
  getMovieCatalogListCopy,
  getTvCatalogListCopy,
} from "@/lib/catalog-list-copy";
import { getCatalogLayoutState } from "@/lib/catalog-page-state";
import {
  getDiscoverSlugTitle,
  getYearDiscoverTitle,
} from "@/lib/discover-copy-titles";
import { parseMovieView, parseTvView } from "@/lib/catalog-query";

const resolveCatalogFromCopy = (
  sp: Record<string, string>,
  mediaType: "movie" | "tv",
): { title: string; description: string } | null => {
  const raw = sp.catalog_from?.trim();
  if (!raw) return null;
  if (mediaType === "movie") {
    const v = parseMovieView(raw);
    if (v === "discover") return null;
    return getMovieCatalogListCopy(v);
  }
  const v = parseTvView(raw);
  if (v === "discover") return null;
  return getTvCatalogListCopy(v);
};

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
  const discoverResultsTitle =
    mediaType === "movie"
      ? pages.movie.discoverResults.title
      : pages.tv.discoverResults.title;
  const discoverResultsDescription =
    mediaType === "movie"
      ? pages.movie.discoverResults.description
      : pages.tv.discoverResults.description;

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

  const withCompaniesRaw = sp.with_companies?.trim();
  if (withCompaniesRaw) {
    const companyName = sp.company_name?.trim();
    if (companyName) {
      return {
        title: companyName,
        description:
          mediaType === "movie"
            ? `Movies produced by ${companyName}.`
            : `TV shows produced by ${companyName}.`,
      };
    }
    return {
      title: mediaType === "movie" ? "Movies by studio" : "TV shows by studio",
      description: "",
    };
  }

  const withNetworksRaw = sp.with_networks?.trim();
  if (withNetworksRaw && mediaType === "tv") {
    const networkName = sp.network_name?.trim();
    if (networkName) {
      return {
        title: networkName,
        description: `TV shows on ${networkName}.`,
      };
    }
    return {
      title: "TV shows by network",
      description: "",
    };
  }

  const withGenresRaw = sp.with_genres?.trim();
  if (withGenresRaw) {
    const genreTitle = titleFromWithGenres(withGenresRaw, mediaType);
    if (genreTitle) {
      const fromCopy = resolveCatalogFromCopy(sp, mediaType);
      if (fromCopy) return fromCopy;
      return { title: genreTitle, description: "" };
    }
  }

  if (!layoutState.isHubLayout) {
    const fromCopy = resolveCatalogFromCopy(sp, mediaType);
    if (fromCopy) return fromCopy;
    return {
      title: discoverResultsTitle,
      description: discoverResultsDescription,
    };
  }

  return null;
};
