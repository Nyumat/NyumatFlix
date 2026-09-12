import "server-only";

import { fetchTmdbAnimeFallbackPage } from "@/lib/anime-tmdb-fallback";
import type { AniListPage, AniListSearchParams } from "@/lib/anilist-shared";
import { enrichAniListSearchCatalogItems } from "@/lib/anilist-tmdb";
import type { MediaItem } from "@/lib/domain/typings";
import {
  CatalogProviderError,
  type CatalogProvider,
} from "@/lib/server/catalog-effect";
import { Effect } from "effect";

type FallbackInput = {
  page: number;
  perPage: number;
  params: AniListSearchParams;
  reason?: string;
};

type PageProvider = (
  input: FallbackInput,
) => Effect.Effect<AniListPage | null, CatalogProviderError>;

export type AnimeCatalogFallbackProviders = {
  kitsu: PageProvider;
  tmdb: PageProvider;
  jikan: PageProvider;
};

export type AnimeSearchFallbackProviders = Pick<
  AnimeCatalogFallbackProviders,
  "kitsu" | "jikan"
>;

export type AnimeCatalogSearchResult = {
  items: MediaItem[];
  page: number;
  totalPages: number;
  totalResults: number;
};

const emptyPage = (page: number, perPage: number): AniListPage => ({
  pageInfo: {
    currentPage: page,
    lastPage: page,
    hasNextPage: false,
    total: 0,
    perPage,
  },
  media: [],
});

const emptySearch = (page: number): AnimeCatalogSearchResult => ({
  items: [],
  page,
  totalPages: 1,
  totalResults: 0,
});

const providerFailure = (
  provider: CatalogProvider,
  message: string,
  cause: unknown,
) =>
  new CatalogProviderError({
    provider,
    kind: "transport",
    message,
    cause,
  });

const loadLiveFallbackProviders = Effect.tryPromise({
  try: async () => {
    const [
      { fetchKitsuAnimeFallbackPageEffect },
      { fetchJikanAnimeFallbackPageEffect },
    ] = await Promise.all([
      import("@/lib/anime-kitsu-fallback"),
      import("@/lib/anime-jikan-fallback"),
    ]);
    return {
      kitsu: fetchKitsuAnimeFallbackPageEffect,
      jikan: fetchJikanAnimeFallbackPageEffect,
    };
  },
  catch: (cause) =>
    providerFailure("kitsu", "Anime fallback providers could not load", cause),
});

const tmdbProvider: PageProvider = (input) =>
  Effect.tryPromise({
    try: () => fetchTmdbAnimeFallbackPage(input),
    catch: (cause) =>
      providerFailure("tmdb", "TMDB anime fallback failed", cause),
  });

const warn = (message: string, error?: CatalogProviderError) =>
  Effect.sync(() => {
    if (error) console.warn(message, error.message);
    else console.warn(message);
  });

const attemptProvider = (
  provider: PageProvider,
  input: FallbackInput,
  warning: string,
): Effect.Effect<AniListPage | null> =>
  provider(input).pipe(
    Effect.catchAll((error) =>
      warn(warning, error).pipe(Effect.as<AniListPage | null>(null)),
    ),
  );

export const resolveAnimeCatalogFallbackEffect = (
  input: FallbackInput,
  providers?: AnimeCatalogFallbackProviders,
): Effect.Effect<AniListPage, CatalogProviderError> =>
  Effect.gen(function* () {
    if (input.params.genres.includes("Hentai")) {
      return emptyPage(input.page, input.perPage);
    }

    const live = providers ? null : yield* loadLiveFallbackProviders;
    const selected: AnimeCatalogFallbackProviders =
      providers ??
      ({
        kitsu: live!.kitsu,
        tmdb: tmdbProvider,
        jikan: live!.jikan,
      } satisfies AnimeCatalogFallbackProviders);

    const reason = input.reason ? ` (${input.reason})` : "";
    const kitsu = yield* attemptProvider(
      selected.kitsu,
      input,
      `Kitsu anime fallback empty${reason}; continuing to TMDB fallback.`,
    );
    if (kitsu?.media.length) return kitsu;

    const tmdb = yield* attemptProvider(
      selected.tmdb,
      input,
      `TMDB anime fallback failed${reason}; continuing to Jikan fallback.`,
    );
    if (tmdb?.media.length) return tmdb;

    const jikan = yield* attemptProvider(
      selected.jikan,
      input,
      `Jikan anime fallback empty${reason}; no further fallbacks.`,
    );
    if (jikan?.media.length) return jikan;

    return emptyPage(input.page, input.perPage);
  });

const enrichFallback = (
  provider: CatalogProvider,
  page: AniListPage,
): Effect.Effect<AnimeCatalogSearchResult | null, CatalogProviderError> =>
  Effect.tryPromise({
    try: async () => {
      const enriched = await enrichAniListSearchCatalogItems(
        page.media,
        page.media.length,
      );
      const items = enriched.filter((item) => Boolean(item.poster_path));
      if (items.length === 0) return null;
      return {
        items,
        page: page.pageInfo.currentPage,
        totalPages: page.pageInfo.lastPage,
        totalResults: page.pageInfo.total,
      };
    },
    catch: (cause) =>
      providerFailure(
        provider,
        `${provider} fallback enrichment failed`,
        cause,
      ),
  });

export const resolveAnimeSearchFallbackEffect = (
  input: FallbackInput,
  providers?: AnimeSearchFallbackProviders,
): Effect.Effect<AnimeCatalogSearchResult, CatalogProviderError> =>
  Effect.gen(function* () {
    if (input.params.genres.includes("Hentai")) {
      return emptySearch(input.page);
    }

    const selected = providers ?? (yield* loadLiveFallbackProviders);
    const reason = input.reason ? ` (${input.reason})` : "";

    const kitsuPage = yield* attemptProvider(
      selected.kitsu,
      input,
      `Kitsu anime fallback empty${reason}; continuing to Jikan fallback.`,
    );
    if (kitsuPage?.media.length) {
      const kitsu = yield* enrichFallback("kitsu", kitsuPage).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      );
      if (kitsu) return kitsu;
    }

    const jikanPage = yield* attemptProvider(
      selected.jikan,
      input,
      `Jikan anime fallback empty${reason}; no further fallbacks.`,
    );
    if (jikanPage?.media.length) {
      const jikan = yield* enrichFallback("jikan", jikanPage).pipe(
        Effect.catchAll(() => Effect.succeed(null)),
      );
      if (jikan) return jikan;
    }

    return emptySearch(input.page);
  });
