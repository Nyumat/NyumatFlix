import type { NavItem } from "@/config/site";
import {
  BookOpen,
  Clapperboard,
  Flame,
  LayoutGrid,
  RadioTower,
  Tv,
  Users,
  type LucideIcon,
} from "lucide-react";

export const parentIcons: Record<string, LucideIcon> = {
  Movies: Clapperboard,
  "TV Shows": Tv,
  Anime: BookOpen,
  "Live TV": RadioTower,
  People: Users,
  Trending: Flame,
};

export const getNavIcon = (item: NavItem) =>
  parentIcons[item.title] ?? LayoutGrid;

export const toTitleCase = (label: string) =>
  label.replace(/\w\S*/g, (word) =>
    word === word.toUpperCase()
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );

export const isInNavGroup = (
  pathname: string,
  item: NavItem,
  parentRouteOverride?: string,
) => {
  if (parentRouteOverride) {
    return item.href === parentRouteOverride;
  }

  if (pathname === item.href) return true;
  if (item.href === "/movies") return pathname.startsWith("/movies/");
  if (item.href === "/tvshows") return pathname.startsWith("/tvshows/");
  if (item.href === "/people") return pathname.startsWith("/people");
  if (item.href === "/trending") return pathname.startsWith("/trending");
  if (item.href === "/anime") return pathname.startsWith("/anime");
  if (item.href === "/live") return pathname.startsWith("/live");

  return false;
};
