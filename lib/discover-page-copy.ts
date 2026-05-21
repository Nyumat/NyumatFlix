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
import {
  DEFAULT_DISCOVER_SORT,
  getEffectiveDiscoverSort,
  hasActiveDiscoverFilters,
} from "@/lib/discover-query-state";
import { parseMovieView, parseTvView } from "@/lib/catalog-query";

const resolveCatalogFromCopy = (
  sp: Record<string, string>,
  mediaType: "movie" | "tv",
): { title: string; description?: string } | null => {
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

export const getDiscoverCatalogCopy = (
  sp: Record<string, string>,
  mediaType: "movie" | "tv",
): { title: string; description?: string } | null => {
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
    if (t) return { title: t };
    return { title: rootTitle };
  }

  if (filterParam) {
    const t = getDiscoverSlugTitle(filterParam);
    if (t) return { title: t };
    return { title: rootTitle };
  }

  if (yearParam) {
    return {
      title: getYearDiscoverTitle(yearParam, mediaType),
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
    };
  }

  const withGenresRaw = sp.with_genres?.trim();
  if (withGenresRaw) {
    const fromCopy = resolveCatalogFromCopy(sp, mediaType);
    if (fromCopy) return fromCopy;
    return { title: rootTitle };
  }

  if (!layoutState.isHubLayout) {
    const fromCopy = resolveCatalogFromCopy(sp, mediaType);
    if (fromCopy) return fromCopy;
    if (getEffectiveDiscoverSort(sp.sort_by) !== DEFAULT_DISCOVER_SORT) {
      return { title: rootTitle };
    }
    if (hasActiveDiscoverFilters(sp)) {
      return { title: rootTitle };
    }
    return { title: rootTitle };
  }

  return null;
};
