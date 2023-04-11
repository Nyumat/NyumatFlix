const API_KEY = process.env.API_KEY;
const VPS = process.env.NYUMATFLIX_VPS;
const BASE_URL = "https://api.themoviedb.org/3";

const requests = {
      fetchMoviePlayer: `${VPS}`,
      fetchTrendingMovies: `${BASE_URL}/trending/movie/week?api_key=${API_KEY}&language=en-US`,
      fetchTrendingTvShows: `${BASE_URL}/trending/tv/week?api_key=${API_KEY}&language=en-US`,
      fetchTopRatedMovies: `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&language=en-US`,
      fetchPopularMovies: `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=en-US`,
      fetchUpcomingMovies: `${BASE_URL}/movie/upcoming?api_key=${API_KEY}&language=en-US`,
      fetchNowPlayingMovies: `${BASE_URL}/movie/now_playing?api_key=${API_KEY}&language=en-US`,
      fetchActionMovies: `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=28`,
      fetchComedyMovies: `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=35`,
      fetchHorrorMovies: `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=27`,
      fetchRomanceMovies: `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=10749`,
      fetchDocumentaries: `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=en-US&with_genres=99`,
};

export default requests;
