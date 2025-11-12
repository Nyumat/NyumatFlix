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
      console.error("Anilist API error:", response.status, response.statusText);
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
