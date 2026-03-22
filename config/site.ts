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
  description: pages.movie.root.description,
  items: [
    {
      title: "Discover",
      href: pages.movie.discover.link,
      description: pages.movie.discover.description,
    },
    {
      title: "Popular",
      href: pages.movie.popular.link,
      description: pages.movie.popular.description,
    },
    {
      title: "Now Playing",
      href: pages.movie.nowPlaying.link,
      description: pages.movie.nowPlaying.description,
    },
    {
      title: "Upcoming",
      href: pages.movie.upcoming.link,
      description: pages.movie.upcoming.description,
    },
    {
      title: "Top Rated",
      href: pages.movie.topRated.link,
      description: pages.movie.topRated.description,
    },
  ],
};

const tvShows: NavItem = {
  title: "TV Shows",
  href: pages.tv.catalog.link,
  description: pages.tv.root.description,
  items: [
    {
      title: "Discover",
      href: pages.tv.discover.link,
      description: pages.tv.discover.description,
    },
    {
      title: "Popular",
      href: pages.tv.popular.link,
      description: pages.tv.popular.description,
    },
    {
      title: "Airing Today",
      href: pages.tv.airingToday.link,
      description: pages.tv.airingToday.description,
    },
    {
      title: "On The Air",
      href: pages.tv.onTheAir.link,
      description: pages.tv.onTheAir.description,
    },
    {
      title: "Top Rated",
      href: pages.tv.topRated.link,
      description: pages.tv.topRated.description,
    },
  ],
};

const people: NavItem = {
  title: "People",
  href: pages.people.popular.link,
  description: pages.people.root.description,
  items: [
    {
      title: "Popular",
      href: pages.people.popular.link,
      description: pages.people.popular.description,
    },
    {
      title: "Search",
      href: pages.people.search.link,
      description: pages.people.search.description,
    },
    {
      title: "Popular actors",
      href: pages.people.popularActors.link,
      description: pages.people.popularActors.description,
    },
    {
      title: "Popular actresses",
      href: pages.people.popularActresses.link,
      description: pages.people.popularActresses.description,
    },
    {
      title: "Popular directors",
      href: pages.people.popularDirectors.link,
      description: pages.people.popularDirectors.description,
    },
  ],
};

const trending: NavItem = {
  title: "Trending",
  href: pages.trending.root.link,
  description: pages.trending.root.description,
  items: [
    {
      title: "Movies",
      href: pages.trending.movie.link,
      description: pages.trending.movie.description,
    },
    {
      title: "TV Shows",
      href: pages.trending.tv.link,
      description: pages.trending.tv.description,
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
