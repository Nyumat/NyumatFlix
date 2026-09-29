import { buildCatalogCtaUrl } from "@/lib/catalog-query";
import { runInChunks } from "@/lib/server/chunked-parallel";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { makeEntityKey } from "@/lib/catalog-page-dedupe";
import { filterFamilySafeCatalogShowcaseItems } from "@/lib/catalog-showcase-family-safe";
import { filterWithPosterPath } from "@/lib/media-poster-path";
import { tmdb } from "@/tmdb/api";
import type { MediaItem } from "@/lib/domain/typings";

const MIN_PER_ROW = 20;
const CANDIDATE_POOL_SIZE = MIN_PER_ROW * 3;
const MAX_FETCH_PAGES = 4;

/** Animation rows reuse popular titles from other genres; skip global dedupe so the row stays populated. */
const SHOWCASE_ROWS_WITHOUT_CROSS_ROW_DEDUPE = new Set([
  "showcase-animation",
  "showcase-tv-animation",
]);

type DiscoverExtra = Record<string, string>;

type ShowcaseDef = {
  id: string;
  title: string;
  href: string;
  fetchPage: (
    region: string,
    page: string,
    latestReleaseDate: string,
    discoverExtra?: DiscoverExtra,
  ) => Promise<{ results?: Array<Record<string, unknown>> | null }>;
  mapItem: (raw: Record<string, unknown>) => MediaItem;
};

const movieGenre = (
  id: string,
  title: string,
  genreId: string,
  voteCount: string,
): ShowcaseDef => ({
  id,
  title,
  href: buildCatalogCtaUrl("movie", {
    view: "discover",
    mode: "results",
    extra: { with_genres: genreId },
  }),
  fetchPage: (region, page, latestReleaseDate, discoverExtra = {}) =>
    tmdb.discover.movie({
      watch_region: region,
      page,
      sort_by: "popularity.desc",
      with_genres: genreId,
      "vote_count.gte": voteCount,
      "primary_release_date.lte": latestReleaseDate,
      include_adult: false,
      ...discoverExtra,
    }),
  mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
});

const tvGenre = (
  id: string,
  title: string,
  genreId: string,
  voteCount: string,
): ShowcaseDef => ({
  id,
  title,
  href: buildCatalogCtaUrl("tv", {
    view: "discover",
    mode: "results",
    extra: { with_genres: genreId },
  }),
  fetchPage: (region, page, latestReleaseDate, discoverExtra = {}) =>
    tmdb.discover.tv({
      watch_region: region,
      page,
      sort_by: "popularity.desc",
      with_genres: genreId,
      "vote_count.gte": voteCount,
      "first_air_date.lte": latestReleaseDate,
      include_adult: false,
      ...discoverExtra,
    }),
  mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
});

const movieShowcase: ShowcaseDef[] = [
  movieGenre("showcase-action", "Action", "28", "50"),
  movieGenre("showcase-adventure", "Adventure", "12", "50"),
  movieGenre("showcase-animation", "Animation", "16", "40"),
  movieGenre("showcase-comedy", "Comedy", "35", "50"),
  movieGenre("showcase-crime", "Crime", "80", "50"),
  movieGenre("showcase-documentary", "Documentary", "99", "30"),
  movieGenre("showcase-drama", "Drama", "18", "80"),
  movieGenre("showcase-family", "Family", "10751", "40"),
  movieGenre("showcase-fantasy", "Fantasy", "14", "40"),
  movieGenre("showcase-history", "History", "36", "30"),
  movieGenre("showcase-horror", "Horror", "27", "40"),
  movieGenre("showcase-music", "Music", "10402", "25"),
  movieGenre("showcase-mystery", "Mystery", "9648", "40"),
  movieGenre("showcase-romance", "Romance", "10749", "40"),
  movieGenre("showcase-scifi", "Science Fiction", "878", "40"),
  movieGenre("showcase-thriller", "Thriller", "53", "40"),
  movieGenre("showcase-war", "War", "10752", "30"),
  movieGenre("showcase-western", "Western", "37", "25"),
];

const tvShowcase: ShowcaseDef[] = [
  tvGenre("showcase-tv-action", "Action & Adventure", "10759", "20"),
  tvGenre("showcase-tv-animation", "Animation", "16", "15"),
  tvGenre("showcase-tv-comedy", "Comedy", "35", "25"),
  tvGenre("showcase-tv-crime", "Crime", "80", "20"),
  tvGenre("showcase-tv-documentary", "Documentary", "99", "10"),
  tvGenre("showcase-tv-drama", "Drama", "18", "25"),
  tvGenre("showcase-tv-family", "Family", "10751", "15"),
  tvGenre("showcase-tv-kids", "Kids", "10762", "15"),
  tvGenre("showcase-tv-mystery", "Mystery", "9648", "15"),
  tvGenre("showcase-tv-reality", "Reality", "10764", "20"),
  tvGenre("showcase-tv-scifi", "Sci-Fi & Fantasy", "10765", "20"),
  tvGenre("showcase-tv-war", "War & Politics", "10768", "15"),
  tvGenre("showcase-tv-western", "Western", "37", "10"),
];

const fetchShowcaseRowsForDefs = async (
  defs: ShowcaseDef[],
  mediaType: "movie" | "tv",
  region: string,
  excludeIds: number[],
  discoverExtra: DiscoverExtra = {},
): Promise<
  Array<{ rowId: string; title: string; href: string; items: MediaItem[] }>
> => {
  const latestReleaseDate = getTodayIsoDateUtc();
  const globalSeen = new Set<string>(
    excludeIds.map((id) => makeEntityKey(id, mediaType)),
  );

  const rowsWithItems = await runInChunks(
    defs,
    async (def) => {
      const picked: MediaItem[] = [];

      for (
        let pageNum = 1;
        picked.length < CANDIDATE_POOL_SIZE && pageNum <= MAX_FETCH_PAGES;
        pageNum++
      ) {
        const raw = await def.fetchPage(
          region,
          String(pageNum),
          latestReleaseDate,
          discoverExtra,
        );
        if (!Array.isArray(raw?.results)) {
          break;
        }
        const base = raw.results.map((r) => def.mapItem(r));
        const released =
          mediaType === "movie"
            ? filterReleasedMovies(base)
            : filterReleasedTvShows(base);
        const withPoster = filterWithPosterPath(released);
        const familySafe = filterFamilySafeCatalogShowcaseItems(
          withPoster.map((item) => ({
            ...item,
            media_type: mediaType,
          })),
        );

        for (const item of familySafe) {
          picked.push(item);
          if (picked.length >= CANDIDATE_POOL_SIZE) break;
        }
      }

      return { def, picked };
    },
    4,
  );

  const out: Array<{
    rowId: string;
    title: string;
    href: string;
    items: MediaItem[];
  }> = [];

  for (const { def, picked } of rowsWithItems) {
    const deduped: MediaItem[] = [];
    const rowSeen = new Set<number>();
    const skipCrossRowDedupe = SHOWCASE_ROWS_WITHOUT_CROSS_ROW_DEDUPE.has(
      def.id,
    );

    for (const item of picked) {
      if (rowSeen.has(item.id)) continue;

      const key = makeEntityKey(item.id, mediaType);
      if (!skipCrossRowDedupe && globalSeen.has(key)) continue;

      rowSeen.add(item.id);
      globalSeen.add(key);
      deduped.push(item);
      if (deduped.length >= MIN_PER_ROW) break;
    }

    if (deduped.length > 0) {
      out.push({
        rowId: def.id,
        title: def.title,
        href: def.href,
        items: deduped,
      });
    }
  }

  return out;
};

export const fetchCatalogShowcaseRows = async (
  pageKey: "movies" | "tv",
  region: string,
  excludeIds: number[],
): Promise<
  Array<{ rowId: string; title: string; href: string; items: MediaItem[] }>
> => {
  const mediaType = pageKey === "movies" ? "movie" : "tv";
  const defs = pageKey === "movies" ? movieShowcase : tvShowcase;
  return fetchShowcaseRowsForDefs(defs, mediaType, region, excludeIds);
};

export const fetchProviderCatalogShowcaseRows = async (
  pageKey: "movies" | "tv",
  region: string,
  discoverExtra: DiscoverExtra,
  excludeIds: number[],
): Promise<
  Array<{ rowId: string; title: string; href: string; items: MediaItem[] }>
> => {
  const mediaType = pageKey === "movies" ? "movie" : "tv";
  const defs = pageKey === "movies" ? movieShowcase : tvShowcase;
  return fetchShowcaseRowsForDefs(
    defs,
    mediaType,
    region,
    excludeIds,
    discoverExtra,
  );
};
