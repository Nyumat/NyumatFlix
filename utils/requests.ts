import { Category, MediaItem } from "@utils/typings";
import axios from "axios";

export const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const VPS = process.env.NYUMATFLIX_VPS;
const VPS2 = process.env.NYUMATFLIX_VPS2;
export const BASE_URL = "https://api.themoviedb.org/3";

const defaultQueryParams =
  "language=en-US&include_adult=false&with_original_language=en";

export const CONTENT_CATEGORIES = {
  movie: {
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
  },
  tv: {
    popular: {
      title: "Popular TV Shows",
      url: `${BASE_URL}/tv/popular?api_key=${API_KEY}&${defaultQueryParams}`,
    },
    top_rated: {
      title: "Top Rated TV Shows",
      url: `${BASE_URL}/tv/top_rated?api_key=${API_KEY}&${defaultQueryParams}`,
    },
    airing_today: {
      title: "Airing Today",
      url: `${BASE_URL}/tv/airing_today?api_key=${API_KEY}&${defaultQueryParams}`,
    },
    on_the_air: {
      title: "Currently Airing",
      url: `${BASE_URL}/tv/on_the_air?api_key=${API_KEY}&${defaultQueryParams}`,
    },
    action_adventure: {
      title: "Action & Adventure TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10759`,
      genreId: 10759,
    },
    animation: {
      title: "Animation TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=16`,
      genreId: 16,
    },
    comedy: {
      title: "Comedy TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=35`,
      genreId: 35,
    },
    crime: {
      title: "Crime TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=80`,
      genreId: 80,
    },
    documentary: {
      title: "Documentary TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=99`,
      genreId: 99,
    },
    drama: {
      title: "Drama TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=18`,
      genreId: 18,
    },
    family: {
      title: "Family TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10751`,
      genreId: 10751,
    },
    kids: {
      title: "Kids TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10762`,
      genreId: 10762,
    },
    mystery: {
      title: "Mystery TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=9648`,
      genreId: 9648,
    },
    news: {
      title: "News TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10763`,
      genreId: 10763,
    },
    reality: {
      title: "Reality TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10764`,
      genreId: 10764,
    },
    sci_fi_fantasy: {
      title: "Sci-Fi & Fantasy TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10765`,
      genreId: 10765,
    },
    soap: {
      title: "Soap TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10766`,
      genreId: 10766,
    },
    talk: {
      title: "Talk TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10767`,
      genreId: 10767,
    },
    war_politics: {
      title: "War & Politics TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=10768`,
      genreId: 10768,
    },
    western: {
      title: "Western TV Shows",
      url: `${BASE_URL}/discover/tv?api_key=${API_KEY}&${defaultQueryParams}&with_genres=37`,
      genreId: 37,
    },
  },
} as const;

export const requests = {
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

// TODO: There's duplication (search for "filterContent")
export const filterContent = async (
  items: MediaItem[],
  mediaType: "movie" | "tv",
): Promise<MediaItem[]> => {
  if (!Array.isArray(items)) return [];

  const filteredItems = items.filter((item) => {
    if (!item || typeof item !== "object") return false;
    if (!item.poster_path) return false;
    if (item.adult) return false;
    if (item.original_language !== "en") return false;
    if (item.vote_average < 5) return false;
    return true;
  });

  const itemsWithTrailer = await Promise.all(
    filteredItems.map(async (item) => {
      const trailerUrl = (await fetchTrailerUrl(mediaType, item.id)) || ""; // Handle undefined; not serializable
      return {
        id: item.id,
        title: mediaType === "movie" ? item.title : item.name || "Untitled", // TODO: TypeScript is unhappy about this
        backdrop_path: item.backdrop_path,
        poster_path: item.poster_path,
        overview: item.overview,
        popularity: item.popularity,
        vote_average: item.vote_average,
        vote_count: item.vote_count,
        original_language: item.original_language,
        genre_ids: item.genre_ids,
        release_date:
          mediaType === "movie" ? item.release_date : item.first_air_date,
        adult: item.adult,
        media_type: mediaType,
        trailerUrl,
      };
    }),
  );

  return itemsWithTrailer;
};

export async function fetchContentUntilCount(
  categoryKey: string,
  category: Category,
  mediaType: "movie" | "tv",
  targetCount: number = 20,
): Promise<MediaItem[]> {
  let allItems: MediaItem[] = [];
  let page = 1;
  const maxPages = 5;

  while (allItems.length < targetCount && page <= maxPages) {
    const url = `${category.url}&page=${page}`;
    const response = await axios.get(url);
    const filteredItems = await filterContent(response.data.results, mediaType);
    allItems = [...allItems, ...filteredItems];
    if (response.data.results.length === 0) break;
    page++;
  }

  return allItems.slice(0, targetCount);
}

export const fetchTrailerUrl = async (
  mediaType: "movie" | "tv",
  id: number,
): Promise<string | undefined> => {
  try {
    const response = await axios.get(
      `${BASE_URL}/${mediaType}/${id}/videos?api_key=${API_KEY}`,
    );
    const trailer = response.data.results.find(
      (video: { type: string; site: string }) =>
        video.type === "Trailer" && video.site === "YouTube",
    );
    return trailer ? `https://www.youtube.com/embed/${trailer.key}` : undefined;
  } catch (error) {
    console.error("Error fetching trailer:", error);
    return undefined;
  }
};

export default requests;
