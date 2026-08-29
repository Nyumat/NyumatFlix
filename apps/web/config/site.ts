import { pages } from "@/config/pages";
export { availableParams, pageLimit } from "@/config/catalog";

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "NyumatFlix",
  description:
    "Nyumatflix is an open-source, no-cost, and ad-free movie and TV stream aggregator.",
  mainNav: [],
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
};

const movies: NavItem = {
  title: "Movies",
  href: pages.movie.catalog.link,
};

const tvShows: NavItem = {
  title: "TV Shows",
  href: pages.tv.catalog.link,
};

const people: NavItem = {
  title: "People",
  href: pages.people.root.link,
};

const trending: NavItem = {
  title: "Trending",
  href: pages.trending.root.link,
};

const anime: NavItem = {
  title: "Anime",
  href: pages.anime.root.link,
};

const liveTv: NavItem = {
  title: "Live TV",
  href: "/live",
};

const navigationItems = [movies, tvShows, anime, people, trending] as NavItem[];

export const navigation = {
  items: navigationItems,
};

export const liveTvNavItem = liveTv;
