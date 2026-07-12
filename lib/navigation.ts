import { navigation, type NavItem } from "@/config/site";

const LIVE_TV_ITEM: NavItem = {
  title: "Live TV",
  href: "/live",
};

export function getNavigationItems(liveTvEnabled: boolean): NavItem[] {
  if (!liveTvEnabled) {
    return navigation.items;
  }
  const items = [...navigation.items];
  items.splice(3, 0, LIVE_TV_ITEM);
  return items;
}

export function getFooterLinks(liveTvEnabled: boolean) {
  const base = [
    { href: "/movies", label: "Movies" },
    { href: "/tvshows", label: "TV Shows" },
    { href: "/anime", label: "Anime" },
  ] as const;
  if (!liveTvEnabled) {
    return [...base, { href: "/search", label: "Search" }] as const;
  }
  return [
    ...base,
    { href: "/live", label: "Live TV" },
    { href: "/search", label: "Search" },
  ] as const;
}
