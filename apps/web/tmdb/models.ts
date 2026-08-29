export type MediaType = "tv" | "movie" | "person";
export type WithMediaType<T, K extends MediaType> = T & {
  media_type: K;
};

export type ProductionCountry = {
  iso_3166_1: string;
  name: string;
};

export type ProductionCompany = {
  id: number;
  logo_path: string;
  name: string;
  origin_country: string;
};

export type SpokenLanguage = {
  english_name: string;
  iso_639_1: string;
  name: string;
};

export type Genre = {
  id: number;
  name: string;
};

export type GetGenresResponse = {
  genres: Genre[];
};

export type Language =
  | "en-US"
  | "es-ES"
  | "fr-FR"
  | "de-DE"
  | "it-IT"
  | "pt-BR"
  | "ja-JP";

export type GetLanguagesResponse = Array<{
  english_name: string;
  iso_639_1: string;
  name: string;
}>;

export type Image = {
  aspect_ratio: number;
  file_path: string;
  height: number;
  iso_639_1: string;
  vote_average: number;
  vote_count: number;
  width: number;
};

export type GetImagesResponse = {
  id: number;
  backdrops: Image[];
  logos: Image[];
  posters: Image[];
  profiles: Image[];
};

export type Keyword = {
  name: string;
  id: number;
};

export type GetKeywordsResponse = {
  id: number;
  results?: Array<Keyword>;
  keywords?: Array<Keyword>;
};

export type BelongsToCollection = {
  id: number;
  name: string;
  poster_path: string;
  backdrop_path: string;
};

export type MovieDetails = {
  adult: boolean;
  backdrop_path: string;
  belongs_to_collection?: BelongsToCollection;
  budget: number;
  genres: Genre[];
  homepage: string;
  id: number;
  imdb_id: string;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path?: string;
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  release_date: string;
  revenue: number;
  runtime: number;
  spoken_languages: SpokenLanguage[];
  status: string;
  tagline: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
};

export type Movie = {
  id: number;
  poster_path: string;
  adult: boolean;
  overview: string;
  release_date: string;
  genre_ids: number[];
  original_title: string;
  original_language: string;
  title: string;
  backdrop_path?: string;
  popularity: number;
  vote_count: number;
  video: boolean;
  vote_average: number;
};

export type MovieWithMediaType = WithMediaType<Movie, "movie">;

export type TvShow = {
  poster_path: string;
  popularity: number;
  id: number;
  backdrop_path?: string;
  vote_average: number;
  overview: string;
  first_air_date: string;
  origin_country: string[];
  genre_ids: number[];
  original_language: string;
  vote_count: number;
  name: string;
  original_name: string;
};

export type TvShowWithMediaType = WithMediaType<TvShow, "tv">;

export type CreatedBy = {
  id: number;
  credit_id: string;
  name: string;
  gender: number;
  profile_path: string;
};

export type NextEpisodeToAir = {
  id: number;
  name: string;
  overview: string;
  vote_average: number;
  vote_count: number;
  air_date: string;
  episode_number: number;
  production_code: string;
  runtime: number;
  season_number: number;
  show_id: number;
  still_path: string;
};

export type LastEpisodeToAir = {
  air_date: string;
  episode_number: number;
  id: number;
  name: string;
  overview: string;
  production_code: string;
  season_number: number;
  still_path: string;
  vote_average: number;
  vote_count: number;
};

export type Network = {
  name: string;
  id: number;
  logo_path: string;
  origin_country: string;
};

export type Season = {
  air_date: string;
  episode_count: number;
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  season_number: number;
  vote_average: number;
};

export type TvShowDetails = {
  adult: boolean;
  backdrop_path: string;
  created_by: CreatedBy[];
  episode_run_time: number[];
  first_air_date: string;
  genres: Genre[];
  homepage: string;
  id: number;
  in_production: boolean;
  languages: string[];
  last_air_date: string;
  last_episode_to_air: LastEpisodeToAir;
  name: string;
  next_episode_to_air?: NextEpisodeToAir;
  networks: Network[];
  number_of_episodes: number;
  number_of_seasons: number;
  origin_country: string[];
  original_language: string;
  original_name: string;
  overview: string;
  popularity: number;
  poster_path: string;
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  seasons: Season[];
  spoken_languages: SpokenLanguage[];
  status: string;
  tagline: string;
  type: string;
  vote_average: number;
  vote_count: number;
};

export type Cast = {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string;
  cast_id: number;
  character: string;
  credit_id: string;
  order: number;
};

export type Crew = {
  adult: boolean;
  gender: number;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string;
  credit_id: string;
  department: string;
  job: string;
};

export type GuestStar = {
  credit_id: string;
  order: number;
  character: string;
  adult: boolean;
  gender: number | null;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
};

export type Credits = {
  id: number;
  cast: Cast[];
  crew: Crew[];
};

export type Episode = {
  air_date: string;
  episode_number: number;
  crew: Crew[];
  guest_stars: GuestStar[];
  id: number;
  name: string;
  overview: string;
  production_code: string;
  season_number: number;
  still_path: string;
  vote_average: number;
  vote_count: number;
  runtime: number;
  show_id: number;
};

export type SeasonDetails = {
  air_date: string;
  episodes: Episode[];
  name: string;
  overview: string;
  id: number;
  poster_path?: string;
  season_number: number;
  vote_average: number;
};

export type Person = {
  id: number;
  name: string;
  known_for: Array<MovieWithMediaType | TvShowWithMediaType>;
  profile_path: string;
  adult: boolean;
  known_for_department: string;
  gender: number;
  popularity: number;
  deathday?: string | null;
};

export type PersonWithMediaType = WithMediaType<Person, "person">;

export type PersonDetails = {
  adult: boolean;
  also_known_as: string[];
  birthday: string;
  biography: string;
  deathday?: string;
  gender: number;
  homepage?: string;
  id: number;
  imdb_id: string;
  known_for_department: string;
  name: string;
  place_of_birth: string;
  popularity: number;
  profile_path: string;
};

export type CombinedCredit = {
  id: number;
  adult: boolean;
  title: string;
  date: string;
  media_type: MediaType;
  role: string;
  vote_average: number;
  vote_count: number;
  backdrop_path?: string;
  department?: string;
};

export type RawMovieCredit = MovieWithMediaType &
  CombinedCredit & {
    character: string;
    release_date: string;
    order: number;
    department: string;
    job: string;
    credit_id: string;
  };

export type RawTvShowCredit = TvShowWithMediaType &
  CombinedCredit & {
    character: string;
    order: number;
    episode_count: number;
    first_air_date: string;
    job: string;
    department: string;
    credit_id: string;
  };

export type RawCombinedCredit = RawMovieCredit | RawTvShowCredit;

export type CombinedCreditsResponse = {
  cast: Array<RawCombinedCredit>;
  crew: Array<RawCombinedCredit>;
};

export type CombinedCredits = {
  cast: Array<CombinedCredit>;
  crew: Array<CombinedCredit>;
};

export type Collection = {
  id: number;
  backdrop_path: string;
  name: string;
  poster_path: string;
  adult: boolean;
  original_language: string;
  original_name: string;
  overview: string;
};

export type DetailedCollection = Collection & {
  parts: Movie[];
};

export type Video = {
  id: string;
  iso_639_1: string;
  iso_3166_1: string;
  key: string;
  name: string;
  site: string;
  size: number;
  type: string;
  official?: boolean;
  published_at?: string;
};

export type GetVideosResponse = {
  id: number;
  results: Video[];
};

export type Review = {
  id: string;
  author: string;
  author_details: AuthorDetails;
  content: string;
  created_at: string;
  updated_at: string;
  url: string;
};

export type AuthorDetails = {
  name: string;
  username: string;
  avatar_path: string;
  rating: number;
};

export type Flatrate = {
  display_priority: number;
  logo_path: string;
  provider_id: number;
  provider_name: string;
};

export type Rent = {
  display_priority: number;
  logo_path: string;
  provider_id: number;
  provider_name: string;
};

export type Buy = {
  display_priority: number;
  logo_path: string;
  provider_id: number;
  provider_name: string;
};

type WatchLocaleItem = {
  link: string;
  flatrate: Flatrate[];
  rent: Rent[];
  buy: Buy[];
};

type CountryCode =
  | "AR"
  | "AT"
  | "AU"
  | "BE"
  | "BR"
  | "CA"
  | "CH"
  | "CL"
  | "CO"
  | "CZ"
  | "DE"
  | "DK"
  | "EC"
  | "EE"
  | "ES"
  | "FI"
  | "FR"
  | "GB"
  | "GR"
  | "HU"
  | "ID"
  | "IE"
  | "IN"
  | "IT"
  | "JP"
  | "KR"
  | "LT"
  | "LV"
  | "MX"
  | "MY"
  | "NL"
  | "NO"
  | "NZ"
  | "PE"
  | "PH"
  | "PL"
  | "PT"
  | "RO"
  | "RU"
  | "SE"
  | "SG"
  | "TH"
  | "TR"
  | "US"
  | "VE"
  | "ZA";

export type WatchLocale = {
  [key in CountryCode]: WatchLocaleItem;
};

export type WatchProviders = {
  id: number;
  results: WatchLocale;
};

export type GetWatchProvidersResponse = {
  results: WatchProvider[];
};

export type GetAvailableRegionsResponse = {
  results: Array<{
    english_name: string;
    iso_3166_1: string;
    native_name: string;
  }>;
};

export type WatchProvider = {
  display_priorities: Record<string, number>;
  display_priority: number;
  logo_path: string;
  provider_name: string;
  provider_id: number;
};
