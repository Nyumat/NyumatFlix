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
  media_type?: string;
  release_date?: string;
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

export interface TmdbResponse {
  [x: string]: any;
  page?: number;
  results?: Movie[] | TvShow[]
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
}

