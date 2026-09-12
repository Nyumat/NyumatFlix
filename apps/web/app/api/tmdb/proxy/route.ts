import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { getCoalescingMemoryCache } from "@/lib/cache/coalescing-memory-cache";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { isTmdbNotFoundError } from "@/lib/tmdb-errors";
import { NextRequest, NextResponse } from "next/server";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const PROXY_CACHE_TTL_MS = 30 * 60 * 1000;

const proxyCache = getCoalescingMemoryCache("tmdb-proxy", {
  ttlMs: PROXY_CACHE_TTL_MS,
  maxEntries: 500,
});

type TmdbProxyRequestId =
  | "latestMovie"
  | "latestTv"
  | "popularMovie"
  | "popularTv"
  | "topRatedMovie"
  | "topRatedTv"
  | "filterMovie"
  | "filterTv"
  | "onTheAirTv"
  | "trending"
  | "trendingMovie"
  | "trendingTv"
  | "trendingMovieDay"
  | "trendingTvDay"
  | "searchMulti"
  | "searchKeyword"
  | "searchMovie"
  | "searchTv"
  | "movieData"
  | "tvData"
  | "personData"
  | "movieVideos"
  | "tvVideos"
  | "movieImages"
  | "tvImages"
  | "personImages"
  | "movieCasts"
  | "tvCasts"
  | "movieReviews"
  | "tvReviews"
  | "movieRelated"
  | "tvRelated"
  | "tvEpisodes"
  | "tvEpisodeDetail"
  | "movieSimilar"
  | "tvSimilar"
  | "personMovie"
  | "personTv"
  | "genresMovie"
  | "genresTv"
  | "countries"
  | "languages"
  | "collection"
  | "searchCollection"
  | "withKeywordsTv"
  | "withKeywordsMovie";

type TmdbProxyQuery = {
  requestID: TmdbProxyRequestId;
  id?: string;
  language?: string;
  page?: string;
  genreKeywords?: string;
  sortBy?: string;
  year?: string;
  country?: string;
  query?: string;
  season?: string;
  episode?: string;
};

const readQueryParam = (
  searchParams: URLSearchParams,
  key: keyof TmdbProxyQuery,
) => searchParams.get(key) ?? undefined;

const parseProxyQuery = (
  searchParams: URLSearchParams,
): TmdbProxyQuery | null => {
  const requestID = searchParams.get("requestID");
  if (!requestID) {
    return null;
  }

  return {
    requestID: requestID as TmdbProxyRequestId,
    id: readQueryParam(searchParams, "id"),
    language: readQueryParam(searchParams, "language"),
    page: readQueryParam(searchParams, "page"),
    genreKeywords: readQueryParam(searchParams, "genreKeywords"),
    sortBy: readQueryParam(searchParams, "sortBy"),
    year: readQueryParam(searchParams, "year"),
    country: readQueryParam(searchParams, "country"),
    query: readQueryParam(searchParams, "query"),
    season: readQueryParam(searchParams, "season"),
    episode: readQueryParam(searchParams, "episode"),
  };
};

const buildTmdbUrl = (query: TmdbProxyQuery): string | null => {
  const language = query.language ?? "en-US";
  const page = query.page ?? "1";
  const sortBy = query.sortBy ?? "popularity.desc";
  const id = query.id;
  const genreKeywords = query.genreKeywords ?? "";
  const year = query.year;
  const country = query.country;
  const searchQuery = query.query ?? "";
  const season = query.season;
  const episode = query.episode;
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const requests: Record<TmdbProxyRequestId, string | null> = {
    latestMovie: `${TMDB_BASE_URL}/movie/now_playing?language=${language}&page=${page}`,
    latestTv: `${TMDB_BASE_URL}/tv/airing_today?language=${language}&page=${page}`,
    popularMovie: `${TMDB_BASE_URL}/movie/popular?language=${language}&page=${page}&sort_by=${sortBy}`,
    popularTv: `${TMDB_BASE_URL}/tv/popular?language=${language}&page=${page}&sort_by=${sortBy}`,
    topRatedMovie: `${TMDB_BASE_URL}/movie/top_rated?language=${language}&page=${page}`,
    topRatedTv: `${TMDB_BASE_URL}/tv/top_rated?language=${language}&page=${page}`,
    filterMovie: `${TMDB_BASE_URL}/discover/movie?with_genres=${genreKeywords}&language=${language}&sort_by=${sortBy}${year ? `&year=${year}` : ""}${country ? `&with_origin_country=${country}` : ""}&page=${page}`,
    filterTv: `${TMDB_BASE_URL}/discover/tv?with_genres=${genreKeywords}&language=${language}&sort_by=${sortBy}${year ? `&first_air_date_year=${year}` : ""}${country ? `&with_origin_country=${country}` : ""}&page=${page}&with_runtime.gte=1`,
    onTheAirTv: `${TMDB_BASE_URL}/tv/on_the_air?language=${language}&page=${page}`,
    trending: `${TMDB_BASE_URL}/trending/all/day?language=${language}&page=${page}`,
    trendingMovie: `${TMDB_BASE_URL}/trending/movie/week?language=${language}&page=${page}`,
    trendingTv: `${TMDB_BASE_URL}/trending/tv/week?language=${language}&page=${page}`,
    trendingMovieDay: `${TMDB_BASE_URL}/trending/movie/day?language=${language}&page=${page}`,
    trendingTvDay: `${TMDB_BASE_URL}/trending/tv/day?language=${language}&page=${page}`,
    searchMulti: `${TMDB_BASE_URL}/search/multi?query=${encodeURIComponent(searchQuery)}&language=${language}&page=${page}`,
    searchKeyword: `${TMDB_BASE_URL}/search/keyword?query=${encodeURIComponent(searchQuery)}&language=${language}&page=${page}`,
    searchMovie: `${TMDB_BASE_URL}/search/movie?query=${encodeURIComponent(searchQuery)}&language=${language}&page=${page}`,
    searchTv: `${TMDB_BASE_URL}/search/tv?query=${encodeURIComponent(searchQuery)}&language=${language}&page=${page}`,
    movieData: id ? `${TMDB_BASE_URL}/movie/${id}?language=${language}` : null,
    tvData: id ? `${TMDB_BASE_URL}/tv/${id}?language=${language}` : null,
    personData: id
      ? `${TMDB_BASE_URL}/person/${id}?language=${language}`
      : null,
    movieVideos: id
      ? `${TMDB_BASE_URL}/movie/${id}/videos?language=${language}`
      : null,
    tvVideos: id
      ? `${TMDB_BASE_URL}/tv/${id}/videos?language=${language}`
      : null,
    movieImages: id ? `${TMDB_BASE_URL}/movie/${id}/images` : null,
    tvImages: id ? `${TMDB_BASE_URL}/tv/${id}/images` : null,
    personImages: id ? `${TMDB_BASE_URL}/person/${id}/images` : null,
    movieCasts: id
      ? `${TMDB_BASE_URL}/movie/${id}/credits?language=${language}`
      : null,
    tvCasts: id
      ? `${TMDB_BASE_URL}/tv/${id}/credits?language=${language}`
      : null,
    movieReviews: id
      ? `${TMDB_BASE_URL}/movie/${id}/reviews?language=${language}`
      : null,
    tvReviews: id
      ? `${TMDB_BASE_URL}/tv/${id}/reviews?language=${language}`
      : null,
    movieRelated: id
      ? `${TMDB_BASE_URL}/movie/${id}/recommendations?language=${language}&page=${page}`
      : null,
    tvRelated: id
      ? `${TMDB_BASE_URL}/tv/${id}/recommendations?language=${language}&page=${page}`
      : null,
    tvEpisodes:
      id && season
        ? `${TMDB_BASE_URL}/tv/${id}/season/${season}?language=${language}`
        : null,
    tvEpisodeDetail:
      id && season && episode
        ? `${TMDB_BASE_URL}/tv/${id}/season/${season}/episode/${episode}?language=${language}`
        : null,
    movieSimilar: id
      ? `${TMDB_BASE_URL}/movie/${id}/similar?language=${language}&page=${page}`
      : null,
    tvSimilar: id
      ? `${TMDB_BASE_URL}/tv/${id}/similar?language=${language}&page=${page}`
      : null,
    personMovie: id
      ? `${TMDB_BASE_URL}/person/${id}/movie_credits?language=${language}&page=${page}`
      : null,
    personTv: id
      ? `${TMDB_BASE_URL}/person/${id}/tv_credits?language=${language}&page=${page}`
      : null,
    genresMovie: `${TMDB_BASE_URL}/genre/movie/list?language=${language}`,
    genresTv: `${TMDB_BASE_URL}/genre/tv/list?language=${language}`,
    countries: `${TMDB_BASE_URL}/configuration/countries?language=${language}`,
    languages: `${TMDB_BASE_URL}/configuration/languages`,
    collection: id
      ? `${TMDB_BASE_URL}/collection/${id}?language=${language}`
      : null,
    searchCollection: `${TMDB_BASE_URL}/search/collection?query=${encodeURIComponent(searchQuery)}&language=${language}&page=${page}`,
    withKeywordsTv: `${TMDB_BASE_URL}/discover/tv?with_keywords=${genreKeywords}&language=${language}&sort_by=${sortBy}${year ? `&first_air_date_year=${year}` : ""}${country ? `&with_origin_country=${country}` : ""}&page=${page}&air_date.lte=${todayIso}${sortBy === "first_air_date.desc" ? "&with_runtime.gte=1" : ""}`,
    withKeywordsMovie: `${TMDB_BASE_URL}/discover/movie?with_keywords=${genreKeywords}&language=${language}&sort_by=${sortBy}${year ? `&first_air_date_year=${year}` : ""}${country ? `&with_origin_country=${country}` : ""}&page=${page}&release_date.lte=${todayIso}&with_runtime.gte=1`,
  };

  return requests[query.requestID] ?? null;
};

const fetchTmdbJson = async (url: string): Promise<unknown> => {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB API key is not configured");
  }

  const requestUrl = new URL(url);
  requestUrl.searchParams.set("api_key", apiKey);

  const response = await fetch(requestUrl, { cache: "no-store" });
  if (!response.ok) {
    throw Object.assign(new Error(`TMDB request failed: ${response.status}`), {
      status: response.status,
    });
  }

  return response.json();
};

export async function GET(request: NextRequest) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  const query = parseProxyQuery(request.nextUrl.searchParams);
  if (!query) {
    return NextResponse.json(
      { error: "requestID query parameter is required" },
      { status: 400 },
    );
  }

  const tmdbUrl = buildTmdbUrl(query);
  if (!tmdbUrl) {
    return NextResponse.json(
      { error: "Invalid request parameters for requestID" },
      { status: 400 },
    );
  }

  const cacheKey = JSON.stringify({
    ...query,
    tmdbUrl,
  });

  const cached = proxyCache.get(cacheKey);
  if (cached !== undefined) {
    return NextResponse.json(cached, { headers: catalogCacheHeaders() });
  }

  try {
    const result = await fetchTmdbJson(tmdbUrl);
    proxyCache.set(cacheKey, result);
    return NextResponse.json(result, { headers: catalogCacheHeaders() });
  } catch (error) {
    if (isTmdbNotFoundError(error)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("TMDB proxy request failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch TMDB data" },
      { status: 502 },
    );
  }
}
