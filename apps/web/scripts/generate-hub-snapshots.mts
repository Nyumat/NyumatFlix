import { mkdir, rename, writeFile } from "node:fs/promises";

const TMDB_URL = "https://api.themoviedb.org/3";
const OUTPUT_DIR = new URL("../data/hubs/", import.meta.url);
const HOME_OUTPUT = new URL("./home.json", OUTPUT_DIR);
const WARM_PATHS_OUTPUT = new URL("./warm-paths.json", OUTPUT_DIR);

const apiKey = process.env.TMDB_API_KEY;
if (!apiKey) {
  throw new Error("TMDB_API_KEY is required");
}

type TmdbImage = {
  file_path?: string | null;
  iso_639_1?: string | null;
  width?: number;
  height?: number;
  aspect_ratio?: number;
};

type TmdbGenre = {
  id: number;
  name: string;
};

type TmdbMedia = {
  id: number;
  media_type?: "movie" | "tv";
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  genres?: TmdbGenre[] | null;
};

type TmdbMediaWithImages = TmdbMedia & {
  images?: {
    logos?: TmdbImage[] | null;
  } | null;
};

const tmdbFetch = async <T,>(path: string): Promise<T> => {
  const response = await fetch(
    `${TMDB_URL}${path}${path.includes("?") ? "&" : "?"}api_key=${apiKey}`,
  );
  if (!response.ok) {
    throw new Error(`TMDB ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
};

const toMovieCard = (movie: TmdbMedia) => ({
  id: movie.id,
  media_type: "movie" as const,
  title: movie.title ?? "",
  overview: movie.overview ?? "",
  poster_path: movie.poster_path ?? "",
  backdrop_path: movie.backdrop_path ?? undefined,
  release_date: movie.release_date ?? "",
  vote_average: movie.vote_average ?? 0,
  vote_count: movie.vote_count,
});

const toTvCard = (show: TmdbMedia) => {
  const title = show.name ?? show.title ?? "";
  return {
    id: show.id,
    media_type: "tv" as const,
    name: title,
    title,
    overview: show.overview ?? "",
    poster_path: show.poster_path ?? "",
    backdrop_path: show.backdrop_path ?? undefined,
    first_air_date: show.first_air_date ?? show.release_date ?? "",
    vote_average: show.vote_average ?? 0,
    vote_count: show.vote_count,
  };
};

const selectLogo = (logos: TmdbImage[] | null | undefined) =>
  logos?.find((logo) => logo.iso_639_1 === "en" && logo.file_path) ??
  logos?.find((logo) => !logo.iso_639_1 && logo.file_path) ??
  logos?.find((logo) => logo.file_path) ??
  null;

const toHeroGenres = (genres: TmdbGenre[] | null | undefined) =>
  (genres ?? []).flatMap((genre) =>
    typeof genre.id === "number" && genre.name
      ? [{ id: genre.id, name: genre.name }]
      : [],
  );

const toHeroItem = (item: TmdbMediaWithImages, mediaType: "movie" | "tv") => {
  const logo = selectLogo(item.images?.logos);
  const genres = toHeroGenres(item.genres);
  return {
    id: item.id,
    media_type: mediaType,
    title: item.title ?? null,
    name: item.name ?? null,
    overview: item.overview ?? null,
    backdrop_path: item.backdrop_path ?? null,
    poster_path: item.poster_path ?? null,
    vote_average: item.vote_average ?? null,
    release_date: item.release_date ?? null,
    first_air_date: item.first_air_date ?? null,
    genres,
    genre_ids: genres.map((genre) => genre.id),
    logo: logo?.file_path
      ? {
          file_path: logo.file_path,
          iso_639_1: logo.iso_639_1 ?? null,
          width: logo.width,
          height: logo.height,
          aspect_ratio: logo.aspect_ratio,
        }
      : null,
  };
};

const enrichHeroItem = async (item: TmdbMedia, mediaType: "movie" | "tv") => {
  const detail = await tmdbFetch<TmdbMediaWithImages>(
    `/${mediaType}/${item.id}?append_to_response=images`,
  );
  return toHeroItem(detail, mediaType);
};

const discoverMovies = async () => {
  const data = await tmdbFetch<{ results: TmdbMedia[] }>(
    "/discover/movie?watch_region=US&with_origin_country=US&sort_by=popularity.desc&page=1",
  );
  return (data.results ?? []).map(toMovieCard);
};

const discoverPopularMovies = async (excludeIds: Set<number>) => {
  const data = await tmdbFetch<{ results: TmdbMedia[] }>(
    "/discover/movie?watch_region=US&with_origin_country=US&sort_by=vote_count.desc&page=1",
  );
  return (data.results ?? [])
    .filter((item) => !excludeIds.has(item.id))
    .map(toMovieCard);
};

const discoverTv = async () => {
  const data = await tmdbFetch<{ results: TmdbMedia[] }>(
    "/discover/tv?watch_region=US&with_origin_country=US&sort_by=popularity.desc&page=1",
  );
  return (data.results ?? []).map(toTvCard);
};

const discoverPopularTv = async (excludeIds: Set<number>) => {
  const data = await tmdbFetch<{ results: TmdbMedia[] }>(
    "/discover/tv?watch_region=US&with_origin_country=US&sort_by=vote_count.desc&page=1",
  );
  return (data.results ?? [])
    .filter((item) => !excludeIds.has(item.id))
    .map(toTvCard);
};

const trendingTop10 = async () => {
  const data = await tmdbFetch<{ results: TmdbMedia[] }>("/trending/all/day");
  return (data.results ?? [])
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 10)
    .map((item) =>
      item.media_type === "tv" ? toTvCard(item) : toMovieCard(item),
    );
};

const buildWarmPaths = (movieIds: number[], tvIds: number[]) => {
  const paths = [
    "/",
    "/movies",
    "/tvshows",
    "/trending",
    "/anime",
    "/collections",
  ];
  for (const id of movieIds.slice(0, 100)) {
    paths.push(`/movies/${id}`);
  }
  for (const id of tvIds.slice(0, 100)) {
    paths.push(`/tvshows/${id}`);
  }
  return paths;
};

const main = async () => {
  const [trendingMovies, trendingTv, top10] = await Promise.all([
    discoverMovies(),
    discoverTv(),
    trendingTop10(),
  ]);

  const [popularMovies, popularTv] = await Promise.all([
    discoverPopularMovies(new Set(trendingMovies.map((item) => item.id))),
    discoverPopularTv(new Set(trendingTv.map((item) => item.id))),
  ]);

  const heroCandidates = trendingMovies.slice(0, 5);
  const featured = heroCandidates[0];
  const heroItems = featured
    ? await Promise.all(
        heroCandidates.map((item) => enrichHeroItem(item, "movie")),
      )
    : [];
  const homeHero = featured
    ? {
        items: heroItems,
        backdrop: featured.backdrop_path
          ? {
              imageUrl: `https://image.tmdb.org/t/p/original${featured.backdrop_path}`,
              alt: featured.title,
              priority: true,
            }
          : null,
      }
    : null;

  const staticMovieIds = [
    ...new Set([
      ...trendingMovies.slice(0, 100).map((item) => item.id),
      ...popularMovies.slice(0, 100).map((item) => item.id),
      ...top10
        .filter((item) => item.media_type === "movie")
        .map((item) => item.id),
    ]),
  ].slice(0, 500);

  const staticTvIds = [
    ...new Set([
      ...trendingTv.slice(0, 100).map((item) => item.id),
      ...popularTv.slice(0, 100).map((item) => item.id),
      ...top10
        .filter((item) => item.media_type === "tv")
        .map((item) => item.id),
    ]),
  ].slice(0, 500);

  const warmPaths = buildWarmPaths(staticMovieIds, staticTvIds);

  const homeSnapshot = {
    generatedAt: new Date().toISOString(),
    top10,
    trendingMovies: trendingMovies.slice(0, 22),
    popularMovies: popularMovies.slice(0, 22),
    trendingTv: trendingTv.slice(0, 22),
    popularTv: popularTv.slice(0, 22),
    homeHero,
    warmPaths,
    staticMovieIds,
    staticTvIds,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const homeTmp = new URL("./home.json.tmp", OUTPUT_DIR);
  await writeFile(
    homeTmp,
    `${JSON.stringify(homeSnapshot, null, 2)}\n`,
    "utf8",
  );
  await rename(homeTmp, HOME_OUTPUT);
  await writeFile(
    WARM_PATHS_OUTPUT,
    `${JSON.stringify({ paths: warmPaths }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `wrote hub snapshots (${top10.length} top10, ${staticMovieIds.length} movie ids, ${staticTvIds.length} tv ids)`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
