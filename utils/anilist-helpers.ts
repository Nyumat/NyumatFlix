import { MediaItem } from "./typings";

export function getSearchTitle(media: MediaItem): string | null {
  if (!media) return null;

  if (media.media_type === "tv" || "name" in media) {
    return media.name || null;
  }

  return media.title || null;
}

export function isAnime(
  genres: Array<{ id: number; name?: string }> | number[],
): boolean {
  const animeGenreId = 16;

  if (!genres || genres.length === 0) {
    return false;
  }

  if (typeof genres[0] === "number") {
    return (genres as number[]).includes(animeGenreId);
  }

  return (genres as Array<{ id: number; name?: string }>).some(
    (genre) => genre.id === animeGenreId,
  );
}

export async function fetchAnilistId(
  searchTitle: string,
): Promise<number | null> {
  if (!searchTitle) return null;

  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
        }
      }
    `;

    const variables = {
      search: searchTitle,
    };

    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data?.data?.Media?.id) {
      return data.data.Media.id;
    }

    return null;
  } catch (error) {
    console.error("Error fetching Anilist ID:", error);
    return null;
  }
}

export async function getAnilistIdForMedia(
  media: MediaItem,
): Promise<number | null | undefined> {
  const searchTitle = getSearchTitle(media);
  const genres = media.genre_ids || media.genres || [];

  if (!searchTitle || !isAnime(genres)) {
    return undefined;
  }

  return await fetchAnilistId(searchTitle);
}
