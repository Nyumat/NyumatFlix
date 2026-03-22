import { buildCatalogCtaUrl } from "@/lib/catalog-query";
import {
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import { makeEntityKey } from "@/lib/catalog-page-dedupe";
import { filterWithPosterPath } from "@/lib/media-poster-path";
import { tmdb } from "@/tmdb/api";
import type { MediaItem } from "@/utils/typings";

const MIN_PER_ROW = 20;
const MAX_FETCH_PAGES = 5;

type ShowcaseDef = {
  id: string;
  title: string;
  href: string;
  fetchPage: (
    region: string,
    page: string,
  ) => Promise<{ results: Array<Record<string, unknown>> }>;
  mapItem: (raw: Record<string, unknown>) => MediaItem;
};

const movieShowcase: ShowcaseDef[] = [
  {
    id: "showcase-action",
    title: "Action picks",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "28" },
    }),
    fetchPage: (region, page) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "28",
        "vote_count.gte": "50",
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-comedy",
    title: "Comedy night",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "35" },
    }),
    fetchPage: (region, page) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "35",
        "vote_count.gte": "50",
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-scifi",
    title: "Sci‑Fi & fantasy",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "878" },
    }),
    fetchPage: (region, page) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "878",
        "vote_count.gte": "40",
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-drama",
    title: "Drama spotlight",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "18" },
    }),
    fetchPage: (region, page) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "18",
        "vote_count.gte": "80",
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-thriller",
    title: "Thrillers",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "53" },
    }),
    fetchPage: (region, page) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "53",
        "vote_count.gte": "40",
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
  {
    id: "showcase-horror",
    title: "Horror corner",
    href: buildCatalogCtaUrl("movie", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "27" },
    }),
    fetchPage: (region, page) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "27",
        "vote_count.gte": "40",
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
    fetchPage: (region, page) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "80",
        "vote_count.gte": "40",
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
    fetchPage: (region, page) =>
      tmdb.discover.movie({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "16",
        "vote_count.gte": "40",
      }),
    mapItem: (raw) => ({ ...raw, media_type: "movie" as const }) as MediaItem,
  },
];

const tvShowcase: ShowcaseDef[] = [
  {
    id: "showcase-tv-drama",
    title: "Drama series",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "18" },
    }),
    fetchPage: (region, page) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "18",
        "vote_count.gte": "25",
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
  {
    id: "showcase-tv-comedy",
    title: "Comedy series",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "35" },
    }),
    fetchPage: (region, page) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "35",
        "vote_count.gte": "25",
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
  {
    id: "showcase-tv-scifi",
    title: "Sci‑Fi & fantasy TV",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "10765" },
    }),
    fetchPage: (region, page) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "10765",
        "vote_count.gte": "20",
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
    fetchPage: (region, page) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "10759",
        "vote_count.gte": "20",
      }),
    mapItem: (raw) => ({ ...raw, media_type: "tv" as const }) as MediaItem,
  },
  {
    id: "showcase-tv-crime",
    title: "Crime TV",
    href: buildCatalogCtaUrl("tv", {
      view: "discover",
      mode: "results",
      extra: { with_genres: "80" },
    }),
    fetchPage: (region, page) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "80",
        "vote_count.gte": "20",
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
    fetchPage: (region, page) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "9648",
        "vote_count.gte": "15",
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
    fetchPage: (region, page) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "16",
        "vote_count.gte": "15",
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
    fetchPage: (region, page) =>
      tmdb.discover.tv({
        watch_region: region,
        page,
        sort_by: "popularity.desc",
        with_genres: "99",
        "vote_count.gte": "10",
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
  const seen = new Set<string>(
    excludeIds.map((id) => makeEntityKey(id, mediaType)),
  );

  const out: Array<{
    rowId: string;
    title: string;
    href: string;
    items: MediaItem[];
  }> = [];

  for (const def of defs) {
    const picked: MediaItem[] = [];

    for (
      let pageNum = 1;
      picked.length < MIN_PER_ROW && pageNum <= MAX_FETCH_PAGES;
      pageNum++
    ) {
      const raw = await def.fetchPage(region, String(pageNum));
      const base = raw.results.map((r) => def.mapItem(r));
      const released =
        mediaType === "movie"
          ? filterReleasedMovies(base)
          : filterReleasedTvShows(base);
      const withPoster = filterWithPosterPath(released);

      for (const item of withPoster) {
        const key = makeEntityKey(item.id, mediaType);
        if (seen.has(key)) continue;
        seen.add(key);
        picked.push(item);
        if (picked.length >= MIN_PER_ROW) break;
      }
    }

    if (picked.length > 0) {
      out.push({
        rowId: def.id,
        title: def.title,
        href: def.href,
        items: picked,
      });
    }
  }

  return out;
};
