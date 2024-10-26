export const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const VPS = process.env.NYUMATFLIX_VPS;
const VPS2 = process.env.NYUMATFLIX_VPS2;
export const BASE_URL = "https://api.themoviedb.org/3";

const defaultQueryParams =
  "language=en-US&include_adult=false&with_original_language=en";

export const MOVIE_CATEGORIES = {
  popular: {
    title: "Popular Movies",
    url: `${BASE_URL}/movie/popular?api_key=${API_KEY}&${defaultQueryParams}`,
  },
  top_rated: {
    title: "Top Rated Movies",
    url: `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&${defaultQueryParams}`,
  },
  upcoming: {
    title: "Upcoming Movies",
    url: `${BASE_URL}/movie/upcoming?api_key=${API_KEY}&${defaultQueryParams}`,
  },
  now_playing: {
    title: "Now Playing Movies",
    url: `${BASE_URL}/movie/now_playing?api_key=${API_KEY}&${defaultQueryParams}`,
  },
  action: {
    title: "Action Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=28`,
    genreId: 28,
  },
  adventure: {
    title: "Adventure Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=12`,
    genreId: 12,
  },
  animation: {
    title: "Animation Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=16`,
    genreId: 16,
  },
  comedy: {
    title: "Comedy Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=35`,
    genreId: 35,
  },
  crime: {
    title: "Crime Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=80`,
    genreId: 80,
  },
  documentary: {
    title: "Documentary Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=99`,
    genreId: 99,
  },
  drama: {
    title: "Drama Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=18`,
    genreId: 18,
  },
  family: {
    title: "Family Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10751`,
    genreId: 10751,
  },
  fantasy: {
    title: "Fantasy Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=14`,
    genreId: 14,
  },
  history: {
    title: "History Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=36`,
    genreId: 36,
  },
  horror: {
    title: "Horror Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=27`,
    genreId: 27,
  },
  music: {
    title: "Music Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10402`,
    genreId: 10402,
  },
  mystery: {
    title: "Mystery Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=9648`,
    genreId: 9648,
  },
  romance: {
    title: "Romance Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10749`,
    genreId: 10749,
  },
  science_fiction: {
    title: "Science Fiction Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=878`,
    genreId: 878,
  },
  thriller: {
    title: "Thriller Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=53`,
    genreId: 53,
  },
  war: {
    title: "War Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10752`,
    genreId: 10752,
  },
  western: {
    title: "Western Movies",
    url: `${BASE_URL}/discover/movie?api_key=${API_KEY}&${defaultQueryParams}&with_genres=37`,
    genreId: 37,
  },
};

const requests = {
  fetchMoviePlayer: `${VPS}`,
  fetchTelevisionPlayer: `${VPS2}`,
  fetchTrendingMovies: `${BASE_URL}/trending/movie/week?api_key=${API_KEY}&${defaultQueryParams}`,
  fetchTrendingTvShows: `${BASE_URL}/trending/tv/week?api_key=${API_KEY}&${defaultQueryParams}`,
  fetchTopTvShows: `${BASE_URL}/tv/top_rated?api_key=${API_KEY}&${defaultQueryParams}`,
  fetchPopularTvShows: `${BASE_URL}/tv/popular?api_key=${API_KEY}&${defaultQueryParams}`,
  fetchAiringTodayTvShows: `${BASE_URL}/tv/airing_today?api_key=${API_KEY}&${defaultQueryParams}`,
  fetchTopRatedTvShows: `${BASE_URL}/tv/top_rated?api_key=${API_KEY}&${defaultQueryParams}`,
  fetchOnTheAirTvShows: `${BASE_URL}/tv/on_the_air?api_key=${API_KEY}&${defaultQueryParams}`,
};

export default requests;
