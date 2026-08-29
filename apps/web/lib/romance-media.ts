const ROMANCE_GENRE_ID = 10749;
const HIGH_RATING_THRESHOLD = 7.5;
const HIGH_POPULARITY_THRESHOLD = 1000;

export const shouldAllowRomanceContent = (item: {
  genre_ids?: number[];
  genres?: { id: number }[];
  vote_average?: number;
  vote_count?: number;
}): boolean => {
  const hasRomanceGenre =
    item.genre_ids?.includes(ROMANCE_GENRE_ID) ||
    item.genres?.some((genre) => genre.id === ROMANCE_GENRE_ID);

  if (!hasRomanceGenre) {
    return true;
  }

  const isHighlyRated = (item.vote_average || 0) >= HIGH_RATING_THRESHOLD;
  const isPopular = (item.vote_count || 0) >= HIGH_POPULARITY_THRESHOLD;

  return isHighlyRated && isPopular;
};

export const addRomanceFiltering = (
  params: Record<string, string>,
): Record<string, string> => {
  const updatedParams = { ...params };

  if (updatedParams.without_genres) {
    const existingGenres = updatedParams.without_genres.split(",");
    if (!existingGenres.includes(ROMANCE_GENRE_ID.toString())) {
      updatedParams.without_genres = `${updatedParams.without_genres},${ROMANCE_GENRE_ID}`;
    }
  } else {
    updatedParams.without_genres = ROMANCE_GENRE_ID.toString();
  }

  return updatedParams;
};

export const filterRomanceContent = <
  T extends {
    genre_ids?: number[];
    genres?: { id: number }[];
    vote_average?: number;
    vote_count?: number;
  },
>(
  items: T[],
): T[] => items.filter(shouldAllowRomanceContent);
