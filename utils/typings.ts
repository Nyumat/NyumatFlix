/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Genre {
  id: number;
  name: string;
}

export interface Title {
  title: string;
  query: string;
}

export interface Actor {
  [x: string]: any;
  id: number;
  name: string;
  profile_path: string;
  character: string;
  popularity: number;
}

export interface Movie {
  [x: string]: any;
  results?: Movie[];
  title: string;
  backdrop_path: string;
  first_air_date: string;
  genre_ids: number[];
  id: number;
  name: string;
  origin_country: string[];
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path: string;
  vote_average: number;
  vote_count: number;
  adult: boolean;
  video: boolean;
  original_title: string;
}

export interface TvShow {
  [x: string]: any;
  backdrop_path: string;
  first_air_date: string;
  genre_ids: number[];
  id: number;
  name: string;
  origin_country: string[];
  overview: string;
  popularity: number;
  poster_path: string;
  vote_average: number;
  vote_count: number;
  original_language: string;
  original_name: string;
}

export interface Category {
  title: string;
  url: string;
  genreId?: number;
}

export interface TmdbResponse {
  [x: string]: any;
  page?: number;
  results?: Movie[] | TvShow[];
  total_pages?: number;
  total_results?: number;
}

export type CreditsReponse = {
  id: number;
  cast: Actor[];
  crew: Actor[];
};

export interface LayoutProps {
  children: React.ReactNode;
  isPathRoot: boolean;
}

const orderedGenreKeys: (keyof typeof MapGenreMovie)[] = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
  "Mystery",
  "Music",
  "Romance",
  "TV Movie",
  "Action & Adventure",
  "Kids",
  "News",
  "Reality",
  "Sci-Fi & Fantasy",
  "Soap",
  "Talk",
  "War & Politics",
];

const mapEnumToGenres = (enumObj: any): Genre[] => {
  return orderedGenreKeys.map((key) => ({
    id: enumObj[key].toString(),
    name: key,
  }));
};

export enum MapGenreMovie {
  Action = 28,
  Adventure = 12,
  Animation = 16,
  Comedy = 35,
  Crime = 80,
  Documentary = 99,
  Drama = 18,
  Family = 10751,
  Fantasy = 14,
  History = 36,
  Horror = 27,
  "Science Fiction" = 878,
  Thriller = 53,
  War = 10752,
  Western = 37,
  Mystery = 9648,
  Music = 10402,
  Romance = 10749,
  "TV Movie" = 10770,
  "Action & Adventure" = 10759,
  Kids = 10762,
  News = 10763,
  Reality = 10764,
  "Sci-Fi & Fantasy" = 10765,
  Soap = 10766,
  Talk = 10767,
  "War & Politics" = 10768,
}

export interface Genre {
  id: number;
  name: string;
}

export interface MediaItem {
  id: number;
  title: string;
  backdrop_path: string;
  poster_path: string;
  overview: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  original_language: string;
  genre_ids: number[];
  release_date?: string;
  adult?: boolean;
  media_type: "movie" | "tv" | "person";
  trailerUrl?: string | null;
  // Legacy support
  name?: string;
  first_air_date?: string;
  original_title?: string;
  original_name?: string;
  origin_country?: string[];
  video?: boolean;
}

export interface Movie extends Omit<MediaItem, "media_type"> {
  media_type: "movie";
  release_date: string;
  adult: boolean;
  video: boolean;
  original_title: string;
}

export interface TvShow extends Omit<MediaItem, "media_type" | "release_date"> {
  media_type: "tv";
  first_air_date: string;
  name: string;
  origin_country: string[];
  original_name: string;
}

export interface Category {
  title: string;
  url: string;
  genreId?: number;
}

export interface ContentCategory {
  title: string;
  items: MediaItem[];
  mediaType?: "movie" | "tv"; // Legacy support
  query: string;
}

export interface Title {
  title: string;
  query: string;
}

export interface CreditsResponse {
  id: number;
  cast: Actor[];
  crew: Actor[];
}

// Genre Types
export interface Genre {
  id: number;
  name: string;
}

export enum MediaGenre {
  // Movie Genres
  Action = 28,
  Adventure = 12,
  Animation = 16,
  Comedy = 35,
  Crime = 80,
  Documentary = 99,
  Drama = 18,
  Family = 10751,
  Fantasy = 14,
  History = 36,
  Horror = 27,
  "Science Fiction" = 878,
  Thriller = 53,
  War = 10752,
  Western = 37,
  Mystery = 9648,
  Music = 10402,
  Romance = 10749,
  "TV Movie" = 10770,

  // TV Show Genres
  "Action & Adventure" = 10759,
  Kids = 10762,
  News = 10763,
  Reality = 10764,
  "Sci-Fi & Fantasy" = 10765,
  Soap = 10766,
  Talk = 10767,
  "War & Politics" = 10768,
}

export interface LayoutProps {
  children: React.ReactNode;
  isPathRoot: boolean;
}

export const GENRE_ORDER = [
  "Action",
  "Adventure",
  "Animation",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Science Fiction",
  "Thriller",
  "War",
  "Western",
  "Mystery",
  "Music",
  "Romance",
  "TV Movie",
  "Action & Adventure",
  "Kids",
  "News",
  "Reality",
  "Sci-Fi & Fantasy",
  "Soap",
  "Talk",
  "War & Politics",
] as const;

export const genres = mapEnumToGenres(MediaGenre);

export const getGenreName = (id: number): string | undefined =>
  genres.find((genre) => genre.id === id)?.name;

export const isMovie = (item: MediaItem): item is Movie =>
  item.media_type === "movie";

export const isTvShow = (item: MediaItem): item is TvShow =>
  item.media_type === "tv";

export const CONTENT_TYPES = {
  movie: {
    titleField: "title",
    dateField: "release_date",
    routePrefix: "movies",
  },
  tv: {
    titleField: "name",
    dateField: "first_air_date",
    routePrefix: "tvshows",
  },
} as const;
