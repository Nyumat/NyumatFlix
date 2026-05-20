const IDS_MOE_BASE_URL = "https://api.ids.moe";

export type IdsMoeMapping = {
  title: string;
  anilist: number | null;
  myanimelist: number | null;
  imdb: string | null;
  themoviedb: number | null;
  themoviedb_type?: "movie" | "tv" | null;
  themoviedb_season?: number | null;
  trakt: number | null;
  trakt_type?: "movies" | "shows" | null;
  trakt_season?: number | null;
};

const getIdsMoeApiKey = () => process.env.ID_MOE_API_KEY?.trim();

export const fetchIdsMoeMappingByAniListId = async (
  anilistId: number,
): Promise<IdsMoeMapping | null> => {
  const apiKey = getIdsMoeApiKey();
  if (!apiKey) return null;

  const url = new URL(`/ids/${anilistId}`, IDS_MOE_BASE_URL);
  url.searchParams.set("platform", "anilist");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      accept: "application/json",
    },
    next: { revalidate: 60 * 60 * 24 },
  });

  if (response.status === 404) return null;
  if (!response.ok) return null;

  return (await response.json()) as IdsMoeMapping;
};
