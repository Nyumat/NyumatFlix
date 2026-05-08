"use client";

import { pages } from "@/config";
import {
  mediaDetailTabStoreKey,
  useMediaDetailTabStore,
} from "@/lib/stores/media-detail-tab-store";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

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

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onClick={handleClick}
      data-state={isActive ? "active" : "inactive"}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-xs px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs",
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
