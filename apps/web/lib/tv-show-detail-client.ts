export type TvShowDetailClientPayload = {
  id?: number;
  name?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: Array<{ id: number; name?: string }>;
  status?: string | null;
  last_episode_to_air?: unknown;
  next_episode_to_air?: unknown;
};

export type FetchedTvShowDetail = {
  detail: TvShowDetailClientPayload;
  catalog: "anime" | null;
};

export type FetchTvShowDetailOptions = {
  expectedTitle?: string;
  catalog?: "anime" | null;
  anilistId?: number;
};

const normalizeTitleKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const tvDetailTitleMatches = (
  actual: string | undefined,
  expected: string | undefined,
): boolean => {
  if (!expected?.trim()) return true;
  if (!actual?.trim()) return false;
  const left = normalizeTitleKey(actual);
  const right = normalizeTitleKey(expected);
  return left === right || left.startsWith(right) || right.startsWith(left);
};

const readTvDetail = async (
  path: string,
): Promise<TvShowDetailClientPayload | null> => {
  const response = await fetch(path);
  if (!response.ok) return null;
  return (await response.json()) as TvShowDetailClientPayload;
};

const readAnilistTvDetail = async (
  anilistId: number,
): Promise<TvShowDetailClientPayload | null> =>
  readTvDetail(`/api/anime/${anilistId}`);

const readTmdbTvDetail = async (
  contentId: number,
): Promise<TvShowDetailClientPayload | null> => {
  const params = new URLSearchParams({
    requestID: "tvData",
    id: String(contentId),
    language: "en-US",
  });
  const response = await fetch(`/api/tmdb/proxy?${params.toString()}`);
  if (!response.ok) return null;
  return (await response.json()) as TvShowDetailClientPayload;
};

const pickParallelTvDetail = (
  tmdb: TvShowDetailClientPayload | null,
  anilist: TvShowDetailClientPayload | null,
  expected?: string,
): FetchedTvShowDetail | null => {
  if (tmdb && tvDetailTitleMatches(tmdb.name, expected)) {
    return { detail: tmdb, catalog: null };
  }

  if (anilist && tvDetailTitleMatches(anilist.name, expected)) {
    return { detail: anilist, catalog: "anime" };
  }

  if (tmdb) {
    return { detail: tmdb, catalog: null };
  }

  return anilist ? { detail: anilist, catalog: "anime" } : null;
};

const shouldProbeAnilistAfterTmdb = (
  tmdb: TvShowDetailClientPayload | null,
  expected: string | undefined,
  explicitAnilistId: number | undefined,
): boolean => {
  if (explicitAnilistId != null) {
    return true;
  }

  if (!tmdb) {
    return true;
  }

  return !tvDetailTitleMatches(tmdb.name, expected);
};

export const fetchTvShowDetailClient = async (
  contentId: number,
  options?: FetchTvShowDetailOptions,
): Promise<FetchedTvShowDetail | null> => {
  const expected = options?.expectedTitle;
  const explicitAnilistId = options?.anilistId;

  if (options?.catalog === "anime") {
    const anilist = await readAnilistTvDetail(explicitAnilistId ?? contentId);
    return anilist ? { detail: anilist, catalog: "anime" } : null;
  }

  if (options?.catalog === null) {
    const tmdb = await readTmdbTvDetail(contentId);
    return tmdb ? { detail: tmdb, catalog: null } : null;
  }

  const tmdb = await readTmdbTvDetail(contentId);

  if (tmdb && !shouldProbeAnilistAfterTmdb(tmdb, expected, explicitAnilistId)) {
    return { detail: tmdb, catalog: null };
  }

  if (!shouldProbeAnilistAfterTmdb(tmdb, expected, explicitAnilistId)) {
    return null;
  }

  const anilist = await readAnilistTvDetail(explicitAnilistId ?? contentId);
  return pickParallelTvDetail(tmdb, anilist, expected);
};
