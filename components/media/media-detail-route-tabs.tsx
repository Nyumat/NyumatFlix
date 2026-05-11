"use client";

import { pages } from "@/config";
import {
  mediaDetailTabStoreKey,
  useMediaDetailTabStore,
} from "@/lib/stores/media-detail-tab-store";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  fetchMovieCredits,
  fetchMovieImages,
  fetchMovieRecommendationsPage,
  fetchMovieReviewsPage,
  fetchMovieSimilarPage,
  fetchMovieVideos,
  fetchTvCredits,
  fetchTvImages,
  fetchTvRecommendationsPage,
  fetchTvReviewsPage,
  fetchTvSimilarPage,
  fetchTvVideos,
} from "@/app/actions/media-detail-tab-data";

type MediaDetailRouteTabsProps = {
  mediaType: "movie" | "tv";
  id: string;
  className?: string;
};

const movieTabs = [
  { segment: "", label: "Overview" },
  { segment: "credits", label: "Cast" },
  { segment: "reviews", label: "Reviews" },
  { segment: "images", label: "Images" },
  { segment: "videos", label: "Videos" },
  { segment: "recommendations", label: "Recommendations" },
  { segment: "similar", label: "Similar" },
] as const;

const tvTabs = [
  { segment: "overview", label: "Overview" },
  { segment: "seasons-episodes", label: "Seasons & Episodes" },
  { segment: "credits", label: "Cast" },
  { segment: "reviews", label: "Reviews" },
  { segment: "series-graph", label: "Series Graph" },
  { segment: "images", label: "Images" },
  { segment: "videos", label: "Videos" },
  { segment: "recommendations", label: "Recommendations" },
  { segment: "similar", label: "Similar" },
] as const;

const MediaDetailTabButton = ({
  root,
  id,
  segment,
  label,
  mediaType,
}: {
  root: string;
  id: string;
  segment: string;
  label: string;
  mediaType: "movie" | "tv";
}) => {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const setMediaDetailTab = useMediaDetailTabStore((s) => s.setMediaDetailTab);
  const owner = mediaType === "movie" ? "movie" : "tv";
  const stored = useMediaDetailTabStore(
    (s) => s.tabs[mediaDetailTabStoreKey(owner, id)],
  );

  const basePath = `${root}/${id}`;
  const isActive =
    pathname === basePath &&
    (mediaType === "movie"
      ? segment === ""
        ? stored === undefined
        : stored === segment
      : stored === segment);

  const handleClick = () => {
    if (mediaType === "movie" && segment === "") {
      setMediaDetailTab("movie", id, "");
      return;
    }
    setMediaDetailTab(owner, id, segment);
  };

  const handleMouseEnter = () => {
    if (mediaType === "movie") {
      switch (segment) {
        case "credits":
          queryClient.prefetchQuery({
            queryKey: queryKeys.movieTabCredits(id),
            queryFn: () => fetchMovieCredits(id),
          });
          break;
        case "images":
          queryClient.prefetchQuery({
            queryKey: queryKeys.movieTabImages(id),
            queryFn: () => fetchMovieImages(id),
          });
          break;
        case "videos":
          queryClient.prefetchQuery({
            queryKey: queryKeys.movieTabVideos(id),
            queryFn: () => fetchMovieVideos(id),
          });
          break;
        case "reviews":
          queryClient.prefetchQuery({
            queryKey: queryKeys.movieTabReviews(id, "1"),
            queryFn: () => fetchMovieReviewsPage(id, "1"),
          });
          break;
        case "recommendations":
          queryClient.prefetchQuery({
            queryKey: queryKeys.movieTabRecommendations(id, "1"),
            queryFn: () => fetchMovieRecommendationsPage(id, "1"),
          });
          break;
        case "similar":
          queryClient.prefetchQuery({
            queryKey: queryKeys.movieTabSimilar(id, "1"),
            queryFn: () => fetchMovieSimilarPage(id, "1"),
          });
          break;
      }
    } else {
      switch (segment) {
        case "credits":
          queryClient.prefetchQuery({
            queryKey: queryKeys.tvTabCredits(id),
            queryFn: () => fetchTvCredits(id),
          });
          break;
        case "images":
          queryClient.prefetchQuery({
            queryKey: queryKeys.tvTabImages(id),
            queryFn: () => fetchTvImages(id),
          });
          break;
        case "videos":
          queryClient.prefetchQuery({
            queryKey: queryKeys.tvTabVideos(id),
            queryFn: () => fetchTvVideos(id),
          });
          break;
        case "reviews":
          queryClient.prefetchQuery({
            queryKey: queryKeys.tvTabReviews(id, "1"),
            queryFn: () => fetchTvReviewsPage(id, "1"),
          });
          break;
        case "recommendations":
          queryClient.prefetchQuery({
            queryKey: queryKeys.tvTabRecommendations(id, "1"),
            queryFn: () => fetchTvRecommendationsPage(id, "1"),
          });
          break;
        case "similar":
          queryClient.prefetchQuery({
            queryKey: queryKeys.tvTabSimilar(id, "1"),
            queryFn: () => fetchTvSimilarPage(id, "1"),
          });
          break;
      }
    }
  };

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      )}
    >
      {label}
    </button>
  );
};

export const MediaDetailRouteTabs = ({
  mediaType,
  id,
  className,
}: MediaDetailRouteTabsProps) => {
  const root =
    mediaType === "movie" ? pages.movie.root.link : pages.tv.root.link;
  const tabs = mediaType === "movie" ? movieTabs : tvTabs;

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "max-w-screen -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0",
          mediaType === "tv"
            ? "overflow-x-visible lg:scrollbar-hidden lg:overflow-x-auto"
            : "scrollbar-hidden overflow-x-auto",
        )}
      >
        <div
          role="tablist"
          className={cn(
            "rounded-md bg-muted p-1 text-muted-foreground",
            mediaType === "tv"
              ? "flex min-h-10 w-full flex-wrap items-center gap-1 lg:inline-flex lg:w-max lg:flex-nowrap"
              : "inline-flex min-h-10 w-max items-center gap-1",
          )}
        >
          {tabs.map(({ segment, label }) => (
            <MediaDetailTabButton
              key={label}
              root={root}
              id={id}
              segment={segment}
              label={label}
              mediaType={mediaType}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
