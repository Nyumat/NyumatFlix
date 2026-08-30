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

export const fetchTvShowDetailClient = async (
  contentId: number,
  options?: { expectedTitle?: string; catalog?: "anime" | null },
): Promise<FetchedTvShowDetail | null> => {
  const expected = options?.expectedTitle;

  if (options?.catalog === "anime") {
    const anilist = await readTvDetail(`/api/anime/${contentId}`);
    return anilist ? { detail: anilist, catalog: "anime" } : null;
  }

  const tmdb = await readTvDetail(`/api/tv/${contentId}`);
  if (tmdb && tvDetailTitleMatches(tmdb.name, expected)) {
    return { detail: tmdb, catalog: null };
  }

  const anilist = await readTvDetail(`/api/anime/${contentId}`);
  if (anilist && tvDetailTitleMatches(anilist.name, expected)) {
    return { detail: anilist, catalog: "anime" };
  }

  if (tmdb) {
    return { detail: tmdb, catalog: null };
  }

  return anilist ? { detail: anilist, catalog: "anime" } : null;
};
