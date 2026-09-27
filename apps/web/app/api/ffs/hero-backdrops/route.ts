import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  type HeroBackdropCandidate,
  type HeroBackdropOption,
} from "@/lib/flags/hero-backdrop-candidates";
import { mergeHeroBackdropCandidates } from "@/lib/flags/hero-backdrop-merge";
import type { HeroBackdropOverrideSource } from "@/lib/flags/hero-backdrop-overrides";
import { fetchAniListGraphql } from "@/lib/anilist-graphql";
import { fetchJikanAnimeByMalId } from "@/lib/jikan/client";
import { assertFfsHost } from "@/lib/ffs/require-ffs-host";
import { tmdb } from "@/tmdb/api";
import type { Image } from "@/tmdb/models";
import { tmdbImage } from "@/tmdb/utils";

const MAX_TMDB_RESULTS = 5;
const MAX_ANIME_RESULTS = 6;
const MAX_BACKDROPS_PER_CANDIDATE = 15;

const ANILIST_SEARCH_QUERY = `
  query FfsHeroBackdropSearch($search: String, $perPage: Int) {
    Page(page: 1, perPage: $perPage) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        idMal
        format
        seasonYear
        title {
          english
          romaji
        }
        bannerImage
        coverImage {
          extraLarge
          large
        }
      }
    }
  }
`;

type AniListSearchItem = {
  id: number;
  idMal: number | null;
  format: string | null;
  seasonYear: number | null;
  title: { english: string | null; romaji: string | null };
  bannerImage: string | null;
  coverImage: { extraLarge: string | null; large: string | null } | null;
};

type AniListSearchPayload = {
  Page?: { media?: AniListSearchItem[] };
};

type AniListByIdPayload = {
  Media?: AniListSearchItem | null;
};

const ANILIST_BY_ID_QUERY = `
  query FfsHeroBackdropById($id: Int, $idMal: Int) {
    Media(id: $id, idMal: $idMal, type: ANIME) {
      id
      idMal
      format
      seasonYear
      title {
        english
        romaji
      }
      bannerImage
      coverImage {
        extraLarge
        large
      }
    }
  }
`;

type PinnedBackdropLookup = {
  mediaType: "movie" | "tv" | "anime";
  title: string;
  tmdbId: number | null;
  anilistId: number | null;
  malId: number | null;
};

const titleFromSearchResult = (result: unknown): string => {
  if (!result || typeof result !== "object") return "";
  const raw = result as { title?: string; name?: string };
  return raw.title ?? raw.name ?? "";
};

const yearFromSearchResult = (result: unknown): string | null => {
  if (!result || typeof result !== "object") return null;
  const raw = result as { release_date?: string; first_air_date?: string };
  const date = raw.release_date ?? raw.first_air_date ?? "";
  return typeof date === "string" && date.length >= 4 ? date.slice(0, 4) : null;
};

const posterFromSearchResult = (result: unknown): string | null => {
  if (!result || typeof result !== "object") return null;
  const path = (result as { poster_path?: string | null }).poster_path;
  return path ? tmdbImage.poster(path, "w342") : null;
};

const toTmdbBackdropOption = (image: Image): HeroBackdropOption | null => {
  if (!image.file_path || !image.width || !image.height) return null;
  if (image.width < 1000) return null;
  const language = image.iso_639_1?.trim();
  const languageLabel = language ? language.toUpperCase() : "Textless";
  return {
    path: image.file_path,
    previewUrl: tmdbImage.backdrop(image.file_path, "w780"),
    label: `TMDB · ${image.width}×${image.height} · ${languageLabel}`,
    source: "tmdb",
    width: image.width,
    height: image.height,
  };
};

const anilistOptionBackdrops = async (
  item: AniListSearchItem,
): Promise<HeroBackdropOption[]> => {
  const backdrops: HeroBackdropOption[] = [];

  if (item.bannerImage) {
    backdrops.push({
      path: item.bannerImage,
      previewUrl: item.bannerImage,
      label: "AniList · banner",
      source: "anilist",
      width: null,
      height: null,
    });
  }

  const cover = item.coverImage?.extraLarge ?? item.coverImage?.large ?? null;
  if (cover) {
    backdrops.push({
      path: cover,
      previewUrl: cover,
      label: "AniList · cover",
      source: "anilist",
      width: null,
      height: null,
    });
  }

  if (item.idMal) {
    try {
      const jikan = await fetchJikanAnimeByMalId(item.idMal);
      const malImage =
        jikan?.images?.jpg?.large_image_url ??
        jikan?.images?.webp?.large_image_url ??
        null;
      if (malImage) {
        backdrops.push({
          path: malImage,
          previewUrl: malImage,
          label: "MAL · cover",
          source: "mal",
          width: null,
          height: null,
        });
      }
    } catch {
      void 0;
    }
  }

  return backdrops;
};

const exactNormalizedTitle = (left: string, right: string) => {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return Boolean(
    normalizedLeft && normalizedRight && normalizedLeft === normalizedRight,
  );
};

const probeTmdbTitle = async (
  id: number,
  mediaType: "movie" | "tv",
): Promise<{ mediaType: "movie" | "tv"; title: string } | null> => {
  try {
    if (mediaType === "movie") {
      const detail = await tmdb.movie.detail({ id });
      return { mediaType, title: detail.title };
    }
    const detail = await tmdb.tv.detail({ id });
    return { mediaType, title: detail.name };
  } catch {
    return null;
  }
};

const fetchTmdbBackdropsForPin = async (
  lookup: PinnedBackdropLookup,
): Promise<HeroBackdropOption[]> => {
  if (!lookup.tmdbId) return [];

  if (lookup.mediaType === "movie" || lookup.mediaType === "tv") {
    return fetchTmdbBackdrops(lookup.tmdbId, lookup.mediaType);
  }

  const [tvProbe, movieProbe] = await Promise.all([
    probeTmdbTitle(lookup.tmdbId, "tv"),
    probeTmdbTitle(lookup.tmdbId, "movie"),
  ]);
  const tvMatch = Boolean(
    tvProbe && exactNormalizedTitle(tvProbe.title, lookup.title),
  );
  const movieMatch = Boolean(
    movieProbe && exactNormalizedTitle(movieProbe.title, lookup.title),
  );

  let resolved: "movie" | "tv" | null = null;
  if (tvMatch) resolved = "tv";
  else if (movieMatch) resolved = "movie";
  else if (tvProbe && !movieProbe) resolved = "tv";
  else if (movieProbe && !tvProbe) resolved = "movie";

  if (!resolved) return [];
  return fetchTmdbBackdrops(lookup.tmdbId, resolved);
};

const fetchAniListForPin = async (
  lookup: PinnedBackdropLookup,
): Promise<AniListSearchItem | null> => {
  if (!lookup.anilistId && !lookup.malId) return null;

  const variables: { id?: number; idMal?: number } = {};
  if (lookup.anilistId) variables.id = lookup.anilistId;
  else if (lookup.malId) variables.idMal = lookup.malId;

  try {
    const payload = await fetchAniListGraphql<AniListByIdPayload>({
      query: ANILIST_BY_ID_QUERY,
      variables,
    });
    return payload.data?.Media ?? null;
  } catch {
    return null;
  }
};

const dedupeBackdropOptions = (options: readonly HeroBackdropOption[]) => {
  const seen = new Set<string>();
  const unique: HeroBackdropOption[] = [];
  for (const option of options) {
    if (seen.has(option.path)) continue;
    seen.add(option.path);
    unique.push(option);
  }
  return unique;
};

const loadPinnedBackdropOptions = async (
  lookup: PinnedBackdropLookup,
): Promise<HeroBackdropOption[]> => {
  const [tmdbBackdrops, anilistItem] = await Promise.all([
    fetchTmdbBackdropsForPin(lookup),
    fetchAniListForPin(lookup),
  ]);
  const anilistBackdrops = anilistItem
    ? await anilistOptionBackdrops(anilistItem)
    : [];
  const ordered =
    lookup.mediaType === "anime"
      ? [...anilistBackdrops, ...tmdbBackdrops]
      : [...tmdbBackdrops, ...anilistBackdrops];

  return dedupeBackdropOptions(ordered).slice(0, MAX_BACKDROPS_PER_CANDIDATE);
};

const positiveSearchParam = (value: string | null): number | null => {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
};

const mediaTypeSearchParam = (
  value: string | null,
): PinnedBackdropLookup["mediaType"] | null => {
  if (value === "movie" || value === "tv" || value === "anime") return value;
  return null;
};

const fetchTmdbBackdrops = async (
  id: number,
  mediaType: "movie" | "tv",
): Promise<HeroBackdropOption[]> => {
  try {
    const images =
      mediaType === "movie"
        ? await tmdb.movie.images({ id, langs: "en,null" })
        : await tmdb.tv.images({ id, langs: "en,null" });

    return (images.backdrops ?? [])
      .map(toTmdbBackdropOption)
      .filter((option): option is HeroBackdropOption => Boolean(option))
      .sort((left, right) => (right.width ?? 0) - (left.width ?? 0))
      .slice(0, MAX_BACKDROPS_PER_CANDIDATE);
  } catch {
    return [];
  }
};

const buildTmdbCandidates = async (
  query: string,
): Promise<HeroBackdropCandidate[]> => {
  try {
    const { results } = await tmdb.search.multi({ query, adult: false });
    const usable = (results ?? []).filter(
      (result) =>
        "media_type" in result &&
        (result.media_type === "movie" || result.media_type === "tv"),
    );

    return await Promise.all(
      usable.slice(0, MAX_TMDB_RESULTS).map(async (result) => {
        const mediaType = (result as { media_type: "movie" | "tv" }).media_type;
        const title = titleFromSearchResult(result) || "Untitled";
        const backdropOptions = await fetchTmdbBackdrops(result.id, mediaType);
        const primaryBackdrop =
          "backdrop_path" in result && result.backdrop_path
            ? result.backdrop_path
            : (backdropOptions[0]?.path ?? null);

        const backdrops = [...backdropOptions];
        if (
          primaryBackdrop &&
          !backdrops.some((o) => o.path === primaryBackdrop)
        ) {
          backdrops.unshift({
            path: primaryBackdrop,
            previewUrl: tmdbImage.backdrop(primaryBackdrop, "w780"),
            label: "TMDB · default",
            source: "tmdb" as HeroBackdropOverrideSource,
            width: null,
            height: null,
          });
        }

        return {
          id: `${mediaType}-${result.id}`,
          mediaType,
          title,
          year: yearFromSearchResult(result),
          tmdbId: result.id,
          anilistId: null,
          malId: null,
          posterUrl: posterFromSearchResult(result),
          subtitle: "TMDB",
          backdrops,
        } satisfies HeroBackdropCandidate;
      }),
    );
  } catch {
    return [];
  }
};

const buildAniListCandidates = async (
  query: string,
): Promise<HeroBackdropCandidate[]> => {
  let media: AniListSearchItem[] = [];
  try {
    const payload = await fetchAniListGraphql<AniListSearchPayload>({
      query: ANILIST_SEARCH_QUERY,
      variables: { search: query, perPage: MAX_ANIME_RESULTS },
    });
    media = payload.data?.Page?.media ?? [];
  } catch {
    media = [];
  }

  const candidates = await Promise.all(
    media.map(async (item): Promise<HeroBackdropCandidate | null> => {
      const title = item.title.english ?? item.title.romaji ?? "Untitled";
      const backdrops = (await anilistOptionBackdrops(item)).slice(
        0,
        MAX_BACKDROPS_PER_CANDIDATE,
      );
      const cover =
        item.coverImage?.extraLarge ?? item.coverImage?.large ?? null;

      if (backdrops.length === 0) {
        return null;
      }

      return {
        id: `anime-${item.id}`,
        mediaType: "anime",
        title,
        year: item.seasonYear ? String(item.seasonYear) : null,
        tmdbId: null,
        anilistId: item.id,
        malId: item.idMal,
        posterUrl: cover,
        subtitle: item.format ?? "AniList",
        backdrops,
      } satisfies HeroBackdropCandidate;
    }),
  );

  return candidates.filter((candidate): candidate is HeroBackdropCandidate =>
    Boolean(candidate && candidate.backdrops.length > 0),
  );
};

export async function GET(request: NextRequest) {
  if (!assertFfsHost(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (request.nextUrl.searchParams.get("options") === "1") {
    const mediaType = mediaTypeSearchParam(
      request.nextUrl.searchParams.get("mediaType"),
    );
    const tmdbId = positiveSearchParam(
      request.nextUrl.searchParams.get("tmdbId"),
    );
    const anilistId = positiveSearchParam(
      request.nextUrl.searchParams.get("anilistId"),
    );
    const malId = positiveSearchParam(
      request.nextUrl.searchParams.get("malId"),
    );
    const title = request.nextUrl.searchParams.get("title")?.trim() ?? "";

    if (!mediaType || (!tmdbId && !anilistId && !malId)) {
      return NextResponse.json({ backdrops: [] });
    }

    const backdrops = await loadPinnedBackdropOptions({
      mediaType,
      title: title.slice(0, 200),
      tmdbId,
      anilistId,
      malId,
    });
    return NextResponse.json({ backdrops });
  }

  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ query, results: [] });
  }

  const [tmdbCandidates, animeCandidates] = await Promise.all([
    buildTmdbCandidates(query),
    buildAniListCandidates(query),
  ]);

  return NextResponse.json({
    query,
    results: mergeHeroBackdropCandidates(tmdbCandidates, animeCandidates).slice(
      0,
      10,
    ),
  });
}
