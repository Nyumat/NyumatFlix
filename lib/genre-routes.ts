const ANILIST_GENRE_BY_TMDB_NAME: Record<string, string> = {
  action: "Action",
  "action adventure": "Action",
  adventure: "Adventure",
  comedy: "Comedy",
  drama: "Drama",
  fantasy: "Fantasy",
  horror: "Horror",
  music: "Music",
  mystery: "Mystery",
  romance: "Romance",
  "science fiction": "Sci-Fi",
  "sci fi fantasy": "Sci-Fi",
  "sci-fi fantasy": "Sci-Fi",
  "slice of life": "Slice of Life",
  sports: "Sports",
  supernatural: "Supernatural",
  thriller: "Thriller",
};

const normalizeGenreName = (genreName: string) =>
  genreName
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const getAniListGenreFromTmdbName = (genreName: string) =>
  ANILIST_GENRE_BY_TMDB_NAME[normalizeGenreName(genreName)];

export const buildAnimeGenreUrl = (genreName: string) => {
  const anilistGenre = getAniListGenreFromTmdbName(genreName);
  if (!anilistGenre) return "/anime?mode=results";

  const search = new URLSearchParams({
    genres: anilistGenre,
    mode: "results",
  });
  return `/anime?${search.toString()}`;
};

export const buildGenreBrowseUrl = (
  genre: { id: number; name: string },
  mediaType: "movie" | "tv",
  isAnime = false,
) => {
  if (isAnime) {
    return buildAnimeGenreUrl(genre.name);
  }

  return `/browse/genre/${genre.id}?type=${mediaType}`;
};
