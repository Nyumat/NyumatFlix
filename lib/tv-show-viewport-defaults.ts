import { LARGE_TV_SHOW_EPISODE_OVERVIEW_THRESHOLD } from "@/lib/constants";

export const getTvShowViewportDefaultTabs = (numberOfEpisodes: number) => {
  const mobileTab = "seasons-episodes";
  const desktopTab =
    numberOfEpisodes > LARGE_TV_SHOW_EPISODE_OVERVIEW_THRESHOLD
      ? "overview"
      : "series-graph";
  return { mobileTab, desktopTab };
};

export const resolveTvShowDefaultTab = (
  numberOfEpisodes: number,
  isDesktop: boolean,
): string => {
  const { mobileTab, desktopTab } =
    getTvShowViewportDefaultTabs(numberOfEpisodes);
  return isDesktop ? desktopTab : mobileTab;
};
