import { liveTvNavItem, navigation, type NavItem } from "@/config/site";

const MANIFESTO_ITEM: NavItem = {
  title: "Manifesto",
  href: "/manifesto",
};

export function getNavigationItems(liveTvEnabled: boolean): NavItem[] {
  const items = [...navigation.items];
  if (liveTvEnabled) {
    items.push(liveTvNavItem);
  }
  items.push(MANIFESTO_ITEM);
  return items;
}

export function getFooterLinks(liveTvEnabled: boolean) {
  const base = [
    { href: "/movies", label: "Movies" },
    { href: "/tvshows", label: "TV Shows" },
    { href: "/anime", label: "Anime" },
  ] as const;
  if (!liveTvEnabled) {
    return [
      ...base,
      { href: "/search", label: "Search" },
      { href: "/manifesto", label: "Manifesto" },
    ] as const;
  }
  return [
    ...base,
    { href: "/live", label: "Live TV" },
    { href: "/search", label: "Search" },
    { href: "/manifesto", label: "Manifesto" },
  ] as const;
}
