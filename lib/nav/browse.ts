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

export const getSearchValue = (searchParams: URLSearchParams, key: string) =>
  searchParams.get(key) ?? undefined;

export const getHrefParts = (href: string) => {
  const [path, query = ""] = href.split("?");
  return {
    path,
    params: new URLSearchParams(query),
  };
};

export const getBrowseLinkLabel = (
  item: NavItem,
  child: Pick<NavItem, "href" | "title">,
) => {
  if (child.href === item.href || child.title === "Discover") {
    return "All";
  }

  return toTitleCase(child.title);
};

export const hasBrowseSubmenu = (item: NavItem) =>
  (item.items?.length ?? 0) > 0;

export const getBrowseLinks = (
  item: NavItem,
): Pick<NavItem, "href" | "title">[] => {
  const children = item.items ?? [];
  const hasRootLink = children.some((child) => child.href === item.href);

  if (hasRootLink) {
    return children;
  }

  return [{ href: item.href, title: "All" }, ...children];
};

export const isCurrentHref = (
  pathname: string,
  searchParams: URLSearchParams,
  href: string,
) => {
  const { path, params } = getHrefParts(href);

  if (pathname !== path) return false;

  const expectedView = params.get("view");
  const currentView = searchParams.get("view");
  const expectedDepartment = params.get("department");
  const expectedGender = params.get("gender");

  if (expectedView) {
    return currentView === expectedView;
  }

  if (expectedDepartment) {
    return (
      searchParams.get("department") === expectedDepartment &&
      searchParams.get("gender") === expectedGender
    );
  }

  if (params.size > 0) {
    for (const [key, value] of params.entries()) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  }

  if (path === "/movies" || path === "/tvshows") {
    return !currentView || currentView === "discover";
  }

  if (path === "/people/popular") {
    return (
      !getSearchValue(searchParams, "department") &&
      !getSearchValue(searchParams, "gender")
    );
  }

  return true;
};

export const isInNavGroup = (
  pathname: string,
  searchParams: URLSearchParams,
  item: NavItem,
) => {
  if (
    item.items?.some((child) =>
      isCurrentHref(pathname, searchParams, child.href),
    )
  ) {
    return true;
  }

  if (isCurrentHref(pathname, searchParams, item.href)) {
    return true;
  }

  if (item.href === "/movies") {
    return (
      pathname.startsWith("/movies") &&
      (!searchParams.get("view") || searchParams.get("view") === "discover")
    );
  }

  if (item.href === "/tvshows") {
    return (
      pathname.startsWith("/tvshows") &&
      (!searchParams.get("view") || searchParams.get("view") === "discover")
    );
  }
  if (item.href === "/people/popular") return pathname.startsWith("/people");
  if (item.href === "/trending") return pathname.startsWith("/trending");
  if (item.href === "/anime") return pathname.startsWith("/anime");
  if (item.href === "/live") return pathname.startsWith("/live");

  return false;
};
