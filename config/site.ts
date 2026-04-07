import { pages } from "@/config/pages";

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "NyumatFlix",
  description:
    "Nyumatflix is an open-source, no-cost, and ad-free movie and TV stream aggregator.",
  mainNav: [
    {
      title: "Home",
      href: "/",
    },
  ],
  links: {
    github: "https://github.com/Nyumat/NyumatFlix",
    tmdb: "https://www.themoviedb.org",
  },
  author: {
    name: "NyumatFlix",
    web: "https://nyumatflix.com",
  },
} as const;

export type NavItem = {
  title: string;
  href: string;
  description?: string;
  items?: NavItem[];
};

const home: NavItem = {
  title: "Home",
  href: pages.home.link,
};

const movies: NavItem = {
  title: "Movies",
  href: pages.movie.catalog.link,
  items: [
    {
      title: "Discover",
      href: pages.movie.discover.link,
    },
    {
      title: "Popular",
      href: pages.movie.popular.link,
    },
    {
      title: "Now Playing",
      href: pages.movie.nowPlaying.link,
    },
    {
      title: "Top Rated",
      href: pages.movie.topRated.link,
    },
  ],
};

const tvShows: NavItem = {
  title: "TV Shows",
  href: pages.tv.catalog.link,
  items: [
    {
      title: "Discover",
      href: pages.tv.discover.link,
    },
    {
      title: "Popular",
      href: pages.tv.popular.link,
    },
    {
      title: "Airing Today",
      href: pages.tv.airingToday.link,
    },
    {
      title: "On The Air",
      href: pages.tv.onTheAir.link,
    },
    {
      title: "Top Rated",
      href: pages.tv.topRated.link,
    },
  ],
};

const people: NavItem = {
  title: "People",
  href: pages.people.popular.link,
  items: [
    {
      title: "Popular",
      href: pages.people.popular.link,
    },
    {
      title: "Search",
      href: pages.people.search.link,
    },
    {
      title: "Popular actors",
      href: pages.people.popularActors.link,
    },
    {
      title: "Popular actresses",
      href: pages.people.popularActresses.link,
    },
    {
      title: "Popular directors",
      href: pages.people.popularDirectors.link,
    },
  ],
};

const trending: NavItem = {
  title: "Trending",
  href: pages.trending.root.link,
  items: [
    {
      title: "Movies",
      href: pages.trending.movie.link,
    },
    {
      title: "TV Shows",
      href: pages.trending.tv.link,
    },
  ],
};

export const navigation = {
  items: [home, movies, tvShows, people, trending] as NavItem[],
};

export const availableParams = [
  "with_genres",
  "with_original_language",
  "with_watch_providers",
  "with_companies",
  "with_networks",
  "primary_release_date.gte",
  "primary_release_date.lte",
  "first_air_date.gte",
  "first_air_date.lte",
  "vote_average.gte",
  "vote_average.lte",
  "vote_count.gte",
  "vote_count.lte",
] as const;

export const pageLimit = 500;
