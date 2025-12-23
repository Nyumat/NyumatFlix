export interface AnilistMedia {
  id: number;
  title: {
    english: string | null;
  };
}

export interface AnilistResponse {
  data: {
    Media: AnilistMedia | null;
  };
}

export interface MediaWithTitle {
  title?: {
    english?: string | null;
    original_name?: string | null;
  } | null;
  original_title?: string | null;
  name?: string | null;
  original_name?: string | null;
}

export const fetchAnilistId = async (title: string): Promise<number | null> => {
  console.log("Fetching Anilist ID for title:", title);
  try {
    const query = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          title {
            english
          }
        }
      }
    `;

    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { search: title },
      }),
    });

    if (!response.ok) {
      // 404 is expected when content doesn't exist on Anilist
      if (response.status === 404) {
        console.warn(
          `Anilist API: Content not found for title "${title}" (${response.statusText})`,
        );
      } else {
        // Log actual errors (5xx, etc.) as errors
        console.error(
          "Anilist API error:",
          response.status,
          response.statusText,
        );
      }
      return null;
    }

    const data: AnilistResponse = await response.json();

    if (!data.data.Media) {
      console.warn(`No anime found for title: ${title}`);
      return null;
    }

    return data.data.Media.id;
  } catch (error) {
    console.error("Error fetching Anilist ID:", error);
    return null;
  }
};

export const isAnime = (
  genres: number[] | { id: number }[] | undefined,
): boolean => {
  if (!genres) return false;

  // Handle both genre_ids array and genres array with objects
  if (Array.isArray(genres)) {
    return genres.some((genre) =>
      typeof genre === "number" ? genre === 16 : genre.id === 16,
    );
  }

  return false;
};

export const getSearchTitle = (media: MediaWithTitle): string => {
  return (
    media.title?.english ||
    media.title?.original_name ||
    media.original_title ||
    media.name ||
    media.original_name ||
    ""
  ).trim();
};
