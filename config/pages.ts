const home = {
  title: "Home",
  description:
    "Browse trending and popular movies and TV on NyumatFlix — open, free, and ad-free.",
  link: "/home",
};

const movie = {
  root: {
    title: "Movies",
    description:
      "Discover films to watch next — from new releases to celebrated favorites.",
    link: "/movies",
  },
  catalog: {
    title: "Movies",
    description: "Browse and filter movies.",
    link: "/movies",
  },
  discover: {
    title: "Discover Movies",
    description: "Filter and explore movies by genre, year, rating, and more.",
    link: "/movies",
  },
  popular: {
    title: "Popular Movies",
    description: "What audiences are watching right now in your region.",
    link: "/movies?view=popular",
  },
  topRated: {
    title: "Top Rated Movies",
    description: "Highly rated films worth your time.",
    link: "/movies?view=top_rated",
  },
  upcoming: {
    title: "Upcoming Movies",
    description: "Coming soon to theaters and streaming.",
    link: "/movies?view=upcoming",
  },
  nowPlaying: {
    title: "Now Playing",
    description: "Currently in theaters.",
    link: "/movies?view=now_playing",
  },
};

const tv = {
  root: {
    title: "TV Shows",
    description: "Binge-worthy series, new episodes, and timeless classics.",
    link: "/tvshows",
  },
  catalog: {
    title: "TV Shows",
    description: "Browse and filter TV series.",
    link: "/tvshows",
  },
  discover: {
    title: "Discover TV Shows",
    description:
      "Find your next series with filters tailored to how you watch.",
    link: "/tvshows",
  },
  popular: {
    title: "Popular TV Shows",
    description: "Shows people are talking about.",
    link: "/tvshows?view=popular",
  },
  topRated: {
    title: "Top Rated TV Shows",
    description: "Critically acclaimed television.",
    link: "/tvshows?view=top_rated",
  },
  airingToday: {
    title: "Airing Today",
    description: "Episodes airing today.",
    link: "/tvshows?view=airing_today",
  },
  onTheAir: {
    title: "On The Air",
    description: "Shows currently releasing new episodes.",
    link: "/tvshows?view=on_the_air",
  },
};

const people = {
  root: {
    title: "People",
    description: "Actors, directors, and crew behind the titles you love.",
    link: "/people/popular",
  },
  popular: {
    title: "Popular People",
    description: "The most visible people on TMDB’s popular list.",
    link: "/people/popular",
  },
  search: {
    title: "Search people",
    description: "Look up actors, directors, and crew by name.",
    link: "/search",
  },
  popularActors: {
    title: "Popular actors",
    description: "Male performers on TMDB’s popular people list.",
    link: "/people/popular?department=Acting&gender=2",
  },
  popularActresses: {
    title: "Popular actresses",
    description: "Female performers on TMDB’s popular people list.",
    link: "/people/popular?department=Acting&gender=1",
  },
  popularDirectors: {
    title: "Popular directors",
    description: "Directors on TMDB’s popular people list.",
    link: "/people/popular?department=Directing",
  },
};

const trending = {
  root: {
    title: "Trending",
    description: "What’s hot in movies and TV today.",
    link: "/trending",
  },
  movie: {
    title: "Trending Movies",
    description: "Films gaining momentum right now.",
    link: "/trending/movie",
  },
  tv: {
    title: "Trending TV Shows",
    description: "Series people can’t stop watching.",
    link: "/trending/tv",
  },
  people: {
    title: "Trending People",
    description: "Names in the spotlight.",
    link: "/trending/people",
  },
};

const collection = {
  root: {
    title: "Collections",
    description: "Curated lists from TMDB.",
    link: "/search",
  },
};

const search = {
  title: "Search",
  description: "Find movies, TV shows, and people.",
  link: "/search",
};

const person = {
  detail: {
    title: "Person",
    link: "/person",
  },
};

export const pages = {
  home,
  movie,
  tv,
  people,
  trending,
  collection,
  search,
  person,
};
