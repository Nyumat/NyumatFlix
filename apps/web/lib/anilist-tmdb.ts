import "server-only";

import {
  getAniListTitle,
  getAniListYear,
  mapAniListMediaToMediaItem,
  requiresAdultAniListContent,
  type AniListMedia,
} from "@/lib/anilist-shared";
import {
  isJikanFallbackId,
  jikanFallbackIdToMalId,
} from "@/lib/anime-jikan-fallback";
import {
  isKitsuFallbackId,
  kitsuFallbackIdToKitsuId,
} from "@/lib/anime-kitsu-fallback";
import { fetchIdsMoeMappingByAniListId } from "@/lib/ids-moe";
import {
  getFribbMapping,
  getTmdbIdFromFribb,
  resolveFribbTmdbMapping,
  type FribbTmdbEntry,
} from "@/lib/fribb-mapping";
import { api, tmdb, type WithImages } from "@/tmdb/api";
import type {
  Image,
  MovieDetails,
  MovieWithMediaType,
  TvShowDetails,
  TvShowWithMediaType,
} from "@/tmdb/models";
import type { MediaItem } from "@/lib/domain/typings";
import {
  withAnimePageHref,
  withAnimePageHrefs,
} from "@/lib/anilist-page-hrefs";
import {
  applyHeroBackdropOverride,
  getHeroBackdropOverrides,
} from "@/lib/flags/hero-backdrop-overrides-server";
import { runInChunks } from "@/lib/server/chunked-parallel";
import { enrichAnimeHubCatalogVisuals } from "@/lib/server/enrich-catalog-backdrops";

type TmdbFindResponse = {
  movie_results?: Array<{ id: number }>;
  tv_results?: Array<{ id: number }>;
};

const selectLogo = (logos: Image[] | undefined) =>
  logos?.find((logo) => logo.iso_639_1 === "en") ?? logos?.[0];

const withFallbackMeta = (
  item: MediaItem,
  fallback: MediaItem,
  anilistId: number,
): MediaItem => ({
  ...item,
  content_rating: item.content_rating ?? fallback.content_rating,
  sourceAnilistId: anilistId,
});

const mapMovieDetail = (
  detail: MovieDetails & WithImages,
  fallback: MediaItem,
  anilistId: number,
): MediaItem =>
  withFallbackMeta(
    {
      ...detail,
      media_type: "movie" as const,
      genre_ids: detail.genres.map((genre) => genre.id),
      logo: selectLogo(detail.images?.logos),
    } as MediaItem,
    fallback,
    anilistId,
  );

const mapTvDetail = (
  detail: TvShowDetails & WithImages,
  fallback: MediaItem,
  anilistId: number,
): MediaItem =>
  withFallbackMeta(
    {
      ...detail,
      media_type: "tv" as const,
      genre_ids: detail.genres.map((genre) => genre.id),
      logo: selectLogo(detail.images?.logos),
    } as MediaItem,
    fallback,
    anilistId,
  );

const findTmdbByImdbId = async (imdbId: string) =>
  api.fetcher<TmdbFindResponse>({
    endpoint: `find/${imdbId}`,
    params: { external_source: "imdb_id" },
  });

const fetchTmdbMappedItem = async (
  tmdbId: number,
  type: "movie" | "tv" | null | undefined,
  fallback: MediaItem,
  anilistId: number,
) => {
  if (type === "movie") {
    const detail = await tmdb.movie.detail<WithImages>({
      id: tmdbId,
      append: "images",
    });
    return mapMovieDetail(detail, fallback, anilistId);
  }

  if (type === "tv") {
    const detail = await tmdb.tv.detail<WithImages>({
      id: tmdbId,
      append: "images",
    });
    return mapTvDetail(detail, fallback, anilistId);
  }

  try {
    const detail = await tmdb.tv.detail<WithImages>({
      id: tmdbId,
      append: "images",
    });
    return mapTvDetail(detail, fallback, anilistId);
  } catch {
    const detail = await tmdb.movie.detail<WithImages>({
      id: tmdbId,
      append: "images",
    });
    return mapMovieDetail(detail, fallback, anilistId);
  }
};

const normalizeTitle = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getCandidateTitles = (item: AniListMedia) =>
  [
    item.title.english,
    item.title.romaji,
    item.title.native,
    getAniListTitle(item),
  ].filter((title): title is string => Boolean(title?.trim()));

const scoreSearchCandidate = (
  candidate: MovieWithMediaType | TvShowWithMediaType,
  titles: string[],
  year: number | undefined,
) => {
  const candidateTitle =
    "name" in candidate
      ? candidate.name
      : "title" in candidate
        ? candidate.title
        : "";
  const normalizedCandidate = normalizeTitle(candidateTitle);
  const normalizedTitles = titles.map(normalizeTitle);
  const exactTitle = normalizedTitles.some(
    (title) => title && title === normalizedCandidate,
  );
  const containsTitle = normalizedTitles.some((title) => {
    if (!title || title.length < 4) return false;
    return (
      normalizedCandidate.includes(title) || title.includes(normalizedCandidate)
    );
  });
  const candidateYear = Number.parseInt(
    ("first_air_date" in candidate
      ? candidate.first_air_date
      : "release_date" in candidate
        ? candidate.release_date
        : ""
    )?.slice(0, 4) ?? "",
    10,
  );
  const yearDelta =
    year && Number.isInteger(candidateYear)
      ? Math.abs(candidateYear - year)
      : 99;

  let score = 0;
  if (candidate.media_type === "tv") score += 20;
  if (candidate.genre_ids?.includes(16)) score += 20;
  if (
    candidate.original_language === "ja" ||
    candidate.original_language === "ko"
  ) {
    score += 10;
  }
  if (exactTitle) score += 50;
  else if (containsTitle) score += 15;
  if (yearDelta === 0) score += 20;
  else if (yearDelta <= 1) score += 10;
  else if (yearDelta > 2) score -= 15;
  score += Math.min(candidate.popularity ?? 0, 50) / 10;

  return score;
};

const fetchTmdbSearchMappedItem = async (
  item: AniListMedia,
  fallback: MediaItem,
) => {
  const titles = getCandidateTitles(item);
  const year = getAniListYear(item);

  for (const title of titles) {
    const results = await tmdb.search.multi({ query: title, adult: false });
    const candidates = (results.results ?? []).filter(
      (result): result is MovieWithMediaType | TvShowWithMediaType =>
        result.media_type === "tv" || result.media_type === "movie",
    );
    const best = candidates
      .map((candidate) => ({
        candidate,
        score: scoreSearchCandidate(candidate, titles, year),
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 45) continue;

    return await fetchTmdbMappedItem(
      best.candidate.id,
      best.candidate.media_type,
      fallback,
      item.id,
    );
  }

  return null;
};

const ENRICH_CHUNK_SIZE = 6;

const toAniListFallbackMediaItem = (item: AniListMedia): MediaItem => {
  // Negative sentinel ids (TMDB / Kitsu / Jikan fallbacks) are not AniList
  // ids — keep them out of sourceAnilistId so href resolution falls through
  // to the provider namespaces in anilist-page-hrefs.
  const fallback = mapAniListMediaToMediaItem(item);
  if (item.id > 0) {
    return {
      ...fallback,
      sourceAnilistId: item.id,
      isAniListFallback: true,
    } as MediaItem;
  }
  return {
    ...fallback,
    isAniListFallback: true,
  } as MediaItem;
};

const getProviderFallbackId = (item: AniListMedia): number | null => {
  if (!Number.isInteger(item.id) || item.id > 0) return null;
  if (isKitsuFallbackId(item.id) || isJikanFallbackId(item.id)) {
    return item.id;
  }
  // Legacy TMDB fallback sentinels (-id / -1000000-id) stay internal-only.
  return null;
};

const getAniListTitleFromMediaItem = (item: MediaItem) => {
  const title =
    ("title" in item && typeof item.title === "string" && item.title) ||
    ("name" in item && typeof item.name === "string" && item.name) ||
    "";
  return title.trim() || undefined;
};

const applyTmdbMapping = (
  fallback: MediaItem,
  tmdbId: number,
  type: "movie" | "tv",
  imdbId?: string | null,
): MediaItem => {
  const displayTitle =
    getAniListTitleFromMediaItem(fallback) ||
    fallback.name ||
    ("title" in fallback && typeof fallback.title === "string"
      ? fallback.title
      : "") ||
    "";

  return {
    ...fallback,
    id: tmdbId,
    media_type: type,
    isAniListFallback: false,
    name: displayTitle,
    title: displayTitle,
    original_name: fallback.original_name || displayTitle,
    original_title:
      ("original_title" in fallback && fallback.original_title) || displayTitle,
    ...(typeof imdbId === "string" && imdbId.startsWith("tt")
      ? { imdb_id: imdbId }
      : {}),
  } as MediaItem;
};

const resolveIdsMoeMapping = (
  mapping: Awaited<ReturnType<typeof fetchIdsMoeMappingByAniListId>>,
  format?: string | null,
): { id: number; type: "movie" | "tv" } | null => {
  if (!mapping?.themoviedb) return null;

  if (mapping.themoviedb_type === "movie" || mapping.themoviedb_type === "tv") {
    return { id: mapping.themoviedb, type: mapping.themoviedb_type };
  }

  if (format === "MOVIE") {
    return { id: mapping.themoviedb, type: "movie" };
  }

  return { id: mapping.themoviedb, type: "tv" };
};

const applyLightweightMappings = (
  item: AniListMedia,
  fribbMap: Record<number, FribbTmdbEntry> | null,
): MediaItem => {
  const fallback = toAniListFallbackMediaItem(item);

  if (item.tmdbFallback) {
    return applyTmdbMapping(
      fallback,
      item.tmdbFallback.id,
      item.tmdbFallback.type,
    );
  }

  // Kitsu/Jikan fallbacks whose mappings resolved to a canonical AniList id
  // are already real AniList ids; negative sentinels need no mapping lookup.
  if (item.id <= 0) {
    return fallback;
  }

  const fribbMapping = resolveFribbTmdbMapping(
    fribbMap?.[item.id],
    item.format,
  );
  if (fribbMapping) {
    return applyTmdbMapping(fallback, fribbMapping.id, fribbMapping.type);
  }

  return fallback;
};

const enrichBatchLightweight = async (
  items: AniListMedia[],
): Promise<MediaItem[]> => {
  let fribbMap: Record<number, FribbTmdbEntry> | null = null;

  try {
    fribbMap = await getFribbMapping();
  } catch (error) {
    console.error("Failed to load Fribb mapping:", error);
  }

  const results: MediaItem[] = [];
  const needsIdsMoe: Array<{ index: number; anilistId: number }> = [];

  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!item) continue;

    const mapped = applyLightweightMappings(item, fribbMap);
    results.push(mapped);
    // Negative sentinel ids (Kitsu/Jikan/TMDB fallbacks) have no AniList
    // mapping row — skip the ids.moe lookup for them.
    if (mapped.isAniListFallback && item.id > 0) {
      needsIdsMoe.push({ index, anilistId: item.id });
    }
  }

  if (needsIdsMoe.length === 0) return results;

  const idsMoeResults = await runInChunks(
    needsIdsMoe,
    async ({ anilistId }) => fetchIdsMoeMappingByAniListId(anilistId),
    ENRICH_CHUNK_SIZE,
  );

  for (let i = 0; i < needsIdsMoe.length; i++) {
    const mapping = idsMoeResults[i];
    const targetIndex = needsIdsMoe[i]?.index;
    if (targetIndex === undefined) continue;

    const resolved = resolveIdsMoeMapping(mapping, items[targetIndex]?.format);

    const current = results[targetIndex];
    if (!current?.isAniListFallback) continue;

    if (resolved) {
      results[targetIndex] = applyTmdbMapping(
        current,
        resolved.id,
        resolved.type,
        mapping?.imdb,
      );
      continue;
    }

    // No TMDB match, but ids.moe knows the IMDb id: keep the AniList fallback
    // id and attach IMDb so card hover can still resolve a trailer stream.
    if (mapping?.imdb?.startsWith("tt")) {
      results[targetIndex] = {
        ...current,
        imdb_id: mapping.imdb,
      } as MediaItem;
    }
  }

  return results;
};

const enrichOneHeroUncached = async (
  item: AniListMedia,
): Promise<MediaItem> => {
  const fallback = toAniListFallbackMediaItem(item);

  if (item.tmdbFallback) {
    return fetchTmdbMappedItem(
      item.tmdbFallback.id,
      item.tmdbFallback.type,
      fallback,
      item.id,
    );
  }

  // Negative sentinel ids have no mapping row — return the provider fallback.
  if (item.id <= 0) {
    return fallback;
  }

  try {
    const fribbMapping = await getTmdbIdFromFribb(item.id, item.format);
    if (fribbMapping) {
      return fetchTmdbMappedItem(
        fribbMapping.id,
        fribbMapping.type,
        fallback,
        item.id,
      );
    }

    const mapping = await fetchIdsMoeMappingByAniListId(item.id);
    const resolved = resolveIdsMoeMapping(mapping, item.format);
    if (resolved) {
      return fetchTmdbMappedItem(resolved.id, resolved.type, fallback, item.id);
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const enrichOneUncached = async (item: AniListMedia): Promise<MediaItem> => {
  // Kitsu/Jikan sentinel: keep the provider-backed fallback item as-is.
  // Canonical AniList/MAL/TMDB routes are resolved by withAnimePageHref
  // (real AniList ids from provider mappings, else mal-/tmdb- slugs).
  if (getProviderFallbackId(item) !== null) {
    return toAniListFallbackMediaItem(item);
  }

  const fallback = toAniListFallbackMediaItem(item);

  if (item.tmdbFallback) {
    return fetchTmdbMappedItem(
      item.tmdbFallback.id,
      item.tmdbFallback.type,
      fallback,
      item.id,
    );
  }

  try {
    const fribbMapping = await getTmdbIdFromFribb(item.id, item.format);
    if (fribbMapping) {
      return await fetchTmdbMappedItem(
        fribbMapping.id,
        fribbMapping.type,
        fallback,
        item.id,
      );
    }

    const mapping = await fetchIdsMoeMappingByAniListId(item.id);
    const resolved = resolveIdsMoeMapping(mapping, item.format);

    if (resolved) {
      return await fetchTmdbMappedItem(
        resolved.id,
        resolved.type,
        fallback,
        item.id,
      );
    }

    if (mapping?.imdb) {
      const found = await findTmdbByImdbId(mapping.imdb);
      const movieId = found.movie_results?.[0]?.id;
      if (movieId) {
        return await fetchTmdbMappedItem(movieId, "movie", fallback, item.id);
      }

      const tvId = found.tv_results?.[0]?.id;
      if (tvId) return await fetchTmdbMappedItem(tvId, "tv", fallback, item.id);
    }

    return (await fetchTmdbSearchMappedItem(item, fallback)) ?? fallback;
  } catch {
    return fallback;
  }
};

export const enrichAniListMediaItemsWithTmdb = async (
  items: AniListMedia[],
  maxLookups = 10,
  chunkSize = ENRICH_CHUNK_SIZE,
): Promise<MediaItem[]> => {
  const head = items.slice(0, maxLookups);
  const tail = items.slice(maxLookups).map(toAniListFallbackMediaItem);
  const enrichedHead = await runInChunks(head, enrichOneUncached, chunkSize);
  return withAnimePageHrefs([...enrichedHead, ...tail]);
};

export const enrichAniListMediaItemsLightweight = async (
  items: AniListMedia[],
  maxLookups = 24,
): Promise<MediaItem[]> => {
  const head = items.slice(0, maxLookups);
  const tail = items.slice(maxLookups).map(toAniListFallbackMediaItem);
  const enrichedHead = await enrichAnimeHubCatalogVisuals(
    await enrichBatchLightweight(head),
  );
  return withAnimePageHrefs([...enrichedHead, ...tail]);
};

const isAdultAniListSearchItem = (item: AniListMedia): boolean =>
  item.isAdult === true || requiresAdultAniListContent(item.genres ?? []);

/** Search catalog: keep adult titles on AniList routes instead of weak TMDB mappings. */
export const enrichAniListSearchCatalogItems = async (
  items: AniListMedia[],
  maxLookups = 24,
): Promise<MediaItem[]> => {
  const adultItems = items.filter(isAdultAniListSearchItem);
  const mainstreamItems = items.filter(
    (item) => !isAdultAniListSearchItem(item),
  );

  const head = mainstreamItems.slice(0, maxLookups);
  const tailMainstream = mainstreamItems
    .slice(maxLookups)
    .map(toAniListFallbackMediaItem);
  const enrichedHead = await enrichAnimeHubCatalogVisuals(
    await enrichBatchLightweight(head),
  );
  const adultFallback = adultItems.map(toAniListFallbackMediaItem);

  return withAnimePageHrefs([
    ...enrichedHead,
    ...tailMainstream,
    ...adultFallback,
  ]);
};

type AnimeHubFeatureItem = MediaItem & {
  sourceAnilistId?: number;
  isAniListFallback?: boolean;
};

const mappedFeatureTmdbId = (item: AnimeHubFeatureItem): number | null => {
  if (item.isAniListFallback) return null;
  if (item.media_type !== "movie" && item.media_type !== "tv") return null;
  if (!Number.isInteger(item.id) || item.id <= 0) return null;

  const anilistId = item.sourceAnilistId;
  if (
    typeof anilistId === "number" &&
    Number.isInteger(anilistId) &&
    anilistId > 0 &&
    anilistId === item.id
  ) {
    return null;
  }

  if (
    typeof anilistId !== "number" ||
    !Number.isInteger(anilistId) ||
    anilistId <= 0
  ) {
    return null;
  }

  return item.id;
};

/** AniList media → hub feature item, using the same TMDB mapping as catalog heroes. */
export const resolveAnimeFeaturedMediaItem = async (
  media: AniListMedia,
): Promise<MediaItem> => withAnimePageHref(await enrichOneHeroUncached(media));

/** Hub hero: keep AniList copy, swap in TMDB poster/backdrop when mapped. */
export const enrichAnimeHubFeatureTmdbImages = async (
  item: MediaItem,
): Promise<MediaItem> => {
  const tagged = item as AnimeHubFeatureItem;
  const anilistId = tagged.sourceAnilistId;
  const tmdbId = mappedFeatureTmdbId(tagged);

  const overrides = await getHeroBackdropOverrides();
  const withOverride = (value: MediaItem) =>
    applyHeroBackdropOverride(value, overrides, {
      mediaType: "anime",
      tmdbId,
      anilistId:
        typeof anilistId === "number" &&
        Number.isInteger(anilistId) &&
        anilistId > 0
          ? anilistId
          : null,
    });

  if (!tmdbId || typeof anilistId !== "number") {
    return withOverride(item);
  }

  try {
    const enriched = await fetchTmdbMappedItem(
      tmdbId,
      tagged.media_type === "movie" ? "movie" : "tv",
      item,
      anilistId,
    );

    return withOverride(
      withAnimePageHref({
        ...item,
        backdrop_path: enriched.backdrop_path ?? item.backdrop_path,
        poster_path: enriched.poster_path ?? item.poster_path,
        logo: enriched.logo ?? item.logo,
        images: enriched.images ?? item.images,
      }),
    );
  } catch {
    return withOverride(item);
  }
};

export const enrichAniListHubRow = async (
  items: AniListMedia[],
  {
    fullEnrichCount = 0,
    lightweightCount = 24,
    chunkSize = ENRICH_CHUNK_SIZE,
    heroEnrichment = "full",
  }: {
    fullEnrichCount?: number;
    lightweightCount?: number;
    chunkSize?: number;
    heroEnrichment?: "full" | "fast";
  } = {},
): Promise<MediaItem[]> => {
  const fullSlice = items.slice(0, fullEnrichCount);
  const lightSlice = items.slice(fullEnrichCount, lightweightCount);
  const tail = items.slice(lightweightCount).map(toAniListFallbackMediaItem);
  const enrichHero =
    heroEnrichment === "fast" ? enrichOneHeroUncached : enrichOneUncached;

  const [fullResults, lightResults] = await Promise.all([
    runInChunks(fullSlice, enrichHero, chunkSize),
    enrichAnimeHubCatalogVisuals(await enrichBatchLightweight(lightSlice)),
  ]);

  return withAnimePageHrefs([...fullResults, ...lightResults, ...tail]);
};
