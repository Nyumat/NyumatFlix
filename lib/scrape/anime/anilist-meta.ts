import { scrapeFetch } from "../fetch";

type AniListTitleResponse = {
  data?: {
    Media?: {
      title?: {
        romaji?: string | null;
        english?: string | null;
      };
    };
  };
};

const titleCache = new Map<number, string>();

export const fetchAnilistSearchQuery = async (
  anilistId: number,
): Promise<string | null> => {
  const cached = titleCache.get(anilistId);
  if (cached) {
    return cached;
  }

  try {
    const response = await scrapeFetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query { Media(id: ${anilistId}) { title { romaji english } } }`,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as AniListTitleResponse;
    const title =
      payload.data?.Media?.title?.english?.trim() ||
      payload.data?.Media?.title?.romaji?.trim() ||
      null;

    if (title) {
      titleCache.set(anilistId, title);
    }

    return title;
  } catch {
    return null;
  }
};

export const resolveAnimeSearchQuery = async (input: {
  anilistId: number;
  query?: string;
}): Promise<string> => {
  if (input.query?.trim()) {
    return input.query.trim();
  }

  const fromAnilist = await fetchAnilistSearchQuery(input.anilistId);
  if (fromAnilist) {
    return fromAnilist;
  }

  throw new Error(
    `Unable to resolve search title for AniList ${input.anilistId}`,
  );
};
