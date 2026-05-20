import {
  getAniListTitle,
  getAniListYear,
  mapAniListMediaToMediaItem,
  type AniListMedia,
} from "@/lib/anilist";
import { fetchIdsMoeMappingByAniListId } from "@/lib/ids-moe";
import { api, tmdb, type WithImages } from "@/tmdb/api";
import type {
  Image,
  MovieDetails,
  MovieWithMediaType,
  TvShowDetails,
  TvShowWithMediaType,
} from "@/tmdb/models";
import type { MediaItem } from "@/utils/typings";
import { unstable_cache } from "next/cache";

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
  const containsTitle = normalizedTitles.some(
    (title) =>
      title &&
      (normalizedCandidate.includes(title) ||
        title.includes(normalizedCandidate)),
  );
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
  if (exactTitle) score += 40;
  else if (containsTitle) score += 20;
  if (yearDelta === 0) score += 15;
  else if (yearDelta <= 1) score += 8;
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

    if (!best || best.score < 35) continue;

    return await fetchTmdbMappedItem(
      best.candidate.id,
      best.candidate.media_type,
      fallback,
      item.id,
    );
  }

  return null;
};

const ANIME_ENRICHMENT_REVALIDATE_SECONDS = 60 * 60 * 24;

const enrichOneUncached = async (item: AniListMedia): Promise<MediaItem> => {
  const fallback = {
    ...mapAniListMediaToMediaItem(item),
    sourceAnilistId: item.id,
    isAniListFallback: true,
  } as MediaItem;
  const mapping = await fetchIdsMoeMappingByAniListId(item.id);

  try {
    if (mapping?.themoviedb) {
      return await fetchTmdbMappedItem(
        mapping.themoviedb,
        mapping.themoviedb_type,
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

const enrichOne = unstable_cache(enrichOneUncached, ["anilist-tmdb-item"], {
  revalidate: ANIME_ENRICHMENT_REVALIDATE_SECONDS,
});

export const enrichAniListMediaItemsWithTmdb = async (
  items: AniListMedia[],
  maxLookups = 10,
): Promise<MediaItem[]> => {
  const head = items.slice(0, maxLookups);
  const tail = items.slice(maxLookups).map(
    (item) =>
      ({
        ...mapAniListMediaToMediaItem(item),
        sourceAnilistId: item.id,
        isAniListFallback: true,
      }) as MediaItem,
  );
  const enrichedHead = await Promise.all(head.map(enrichOne));
  return [...enrichedHead, ...tail];
};
