import { buildCatalogCtaUrl } from "@/lib/catalog-query";
import { runInChunks } from "@/lib/server/chunked-parallel";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
  getTodayIsoDateUtc,
} from "@/lib/released-media";
import { makeEntityKey } from "@/lib/catalog-page-dedupe";
import { filterWithPosterPath } from "@/lib/media-poster-path";
import { tmdb } from "@/tmdb/api";
import type { MediaItem } from "@/lib/domain/typings";

const MIN_PER_ROW = 20;
const CANDIDATE_POOL_SIZE = MIN_PER_ROW * 3;
const MAX_FETCH_PAGES = 4;

type ShowcaseDef = {
  id: string;
  title: string;
  href: string;
  fetchPage: (
    region: string,
    page: string,
    latestReleaseDate: string,
  ) => Promise<{ results: Array<Record<string, unknown>> }>;
  mapItem: (raw: Record<string, unknown>) => MediaItem;
};

const movieShowcase: ShowcaseDef[] = [
  {
    id: "showcase-action",
    title: "Action",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "28" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "28",
        "vote_count.gte": "50",
        "primary_release_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-comedy",
    title: "Comedy",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "35" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "35",
        "vote_count.gte": "50",
        "primary_release_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-scifi",
    title: "Sci-Fi & Fantasy",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "878" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "878",
        "vote_count.gte": "40",
        "primary_release_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-drama",
    title: "Drama",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "18" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "18",
        "vote_count.gte": "80",
        "primary_release_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-thriller",
    title: "Thriller",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "53" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "53",
        "vote_count.gte": "40",
        "primary_release_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-horror",
    title: "Horror",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "27" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "27",
        "vote_count.gte": "40",
        "primary_release_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-crime",
    title: "Crime stories",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "80" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "80",
        "vote_count.gte": "40",
        "primary_release_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-animation",
    title: "Animation",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "16" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "16",
        "vote_count.gte": "40",
        "primary_release_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
];

const tvShowcase: ShowcaseDef[] = [
  {
    id: "showcase-tv-drama",
    title: "Drama",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "18" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "18",
        "vote_count.gte": "25",
        "first_air_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
  {
    id: "showcase-tv-comedy",
    title: "Comedy",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "35" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "35",
        "vote_count.gte": "25",
        "first_air_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
  {
    id: "showcase-tv-scifi",
    title: "Sci-Fi & Fantasy",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "10765" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "10765",
        "vote_count.gte": "20",
        "first_air_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
  {
    id: "showcase-tv-action",
    title: "Action & adventure",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "10759" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "10759",
        "vote_count.gte": "20",
        "first_air_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
  {
    id: "showcase-tv-crime",
    title: "Crime",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "80" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "80",
        "vote_count.gte": "20",
        "first_air_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
  {
    id: "showcase-tv-mystery",
    title: "Mystery",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "9648" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "9648",
        "vote_count.gte": "15",
        "first_air_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
  {
    id: "showcase-tv-animation",
    title: "Animation",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "16" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "16",
        "vote_count.gte": "15",
        "first_air_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
  {
    id: "showcase-tv-documentary",
    title: "Documentary",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "99" },
    }),
    fetchPage: (region, page, latestReleaseDate) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "99",
        "vote_count.gte": "10",
        "first_air_date.lte": latestReleaseDate,
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
];

export const fetchCatalogShowcaseRows = async (
  pageKey: "movies" | "tv",
  region: string,
  excludeIds: number[],
): Promise<
  Array<{ rowId: string; title: string; href: string; items: MediaItem[] }>
> => {
  const mediaType = pageKey === "movies" ? "movie" : "tv";
  const defs = pageKey === "movies" ? movieShowcase : tvShowcase;
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
        );
        const base = raw.results.map((r) => def.mapItem(r));
        const released =
          mediaType === "movie"
            ? filterReleasedMovies(base)
            : filterReleasedTvShows(base);
        const withPoster = filterWithPosterPath(released);

        for (const item of withPoster) {
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

    for (const item of picked) {
      const key = makeEntityKey(item.id, mediaType);
      if (globalSeen.has(key)) continue;
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
