import { buildCatalogCtaUrl } from "@/lib/catalog-query";

const movie = {
  root: {
    title: "Movies",
    link: "/movies",
  },
  catalog: {
    title: "Movies",
    link: "/movies",
    resultsLink: buildCatalogCtaUrl("movie", {
      mode: "results",
      extra: { view: "discover" },
    }),
  },
  discover: {
    title: "Movies",
    link: "/movies",
  },
  discoverResults: {
    title: "Most Popular",
  },
  popular: {
    title: "Popular Movies",
    link: buildCatalogCtaUrl("movie", { view: "popular", mode: "results" }),
    discoverHubLink: buildCatalogCtaUrl("movie", {
      mode: "results",
      extra: { sort_by: "vote_count.desc" },
    }),
  },
  topRated: {
    title: "Top Rated Movies",
    link: buildCatalogCtaUrl("movie", { view: "top_rated", mode: "results" }),
  },
  nowPlaying: {
    title: "Now Playing",
    link: buildCatalogCtaUrl("movie", { view: "now_playing", mode: "results" }),
  },
};

const tv = {
  root: {
    title: "TV Shows",
    link: "/tvshows",
  },
  catalog: {
    title: "TV Shows",
    link: "/tvshows",
    resultsLink: buildCatalogCtaUrl("tv", {
      mode: "results",
      extra: { view: "discover" },
    }),
  },
  discover: {
    title: "TV Shows",
    link: "/tvshows",
  },
  discoverResults: {
    title: "Most Popular",
  },
  popular: {
    title: "Popular TV Shows",
    link: buildCatalogCtaUrl("tv", { view: "popular", mode: "results" }),
    discoverHubLink: buildCatalogCtaUrl("tv", {
      mode: "results",
      extra: { sort_by: "vote_count.desc" },
    }),
  },
  topRated: {
    title: "Top Rated TV Shows",
    link: buildCatalogCtaUrl("tv", { view: "top_rated", mode: "results" }),
  },
  airingToday: {
    title: "Airing Today",
    link: buildCatalogCtaUrl("tv", { view: "airing_today", mode: "results" }),
  },
  onTheAir: {
    title: "On The Air",
    link: buildCatalogCtaUrl("tv", { view: "on_the_air", mode: "results" }),
  },
};

const people = {
  root: {
    title: "People",
    link: "/people/popular",
  },
  popular: {
    title: "Popular People",
    link: "/people/popular",
  },
  search: {
    title: "Search People",
    link: "/search",
  },
  popularActors: {
    title: "Popular Actors",
    link: "/people/popular?department=Acting&gender=2",
  },
  popularActresses: {
    title: "Popular Actresses",
    link: "/people/popular?department=Acting&gender=1",
  },
  popularDirectors: {
    title: "Popular Directors",
    link: "/people/popular?department=Directing",
  },
};

const trending = {
  root: {
    title: "Trending",
    link: "/trending",
  },
  movie: {
    title: "Trending Movies",
    link: buildCatalogCtaUrl("movie", { view: "trending", mode: "results" }),
  },
  tv: {
    title: "Trending TV Shows",
    link: buildCatalogCtaUrl("tv", { view: "trending", mode: "results" }),
  },
  people: {
    title: "Trending People",
    link: "/trending/people",
  },
};

const anime = {
  root: {
    title: "Anime",
    link: "/anime",
  },
  trendingAnime: {
    title: "Trending Anime",
    link: "/anime/browse",
  },
  popularAnime: {
    title: "Popular Anime",
    link: "/anime/browse?sort=POPULARITY_DESC",
  },
  topAnime: {
    title: "Top Rated Anime",
    link: "/anime/browse?sort=SCORE_DESC",
  },
  releasingAnime: {
    title: "Releasing Anime",
    link: "/anime/browse?sort=POPULARITY_DESC&status=RELEASING",
  },
  actionAnime: {
    title: "Action Anime",
    link: "/anime/browse?sort=POPULARITY_DESC&genres=Action",
  },
  romanceAnime: {
    title: "Romance Anime",
    link: "/anime/browse?sort=POPULARITY_DESC&genres=Romance",
  },
};

const collection = {
  root: {
    title: "Collections",
    link: "/search",
  },
};

const search = {
  title: "Search",
  link: "/search",
};

const person = {
  detail: {
    title: "Person",
    link: "/person",
  },
};

export const pages = {
  movie,
  tv,
  people,
  trending,
  anime,
  collection,
  search,
  person,
};
