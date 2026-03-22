"use client";

import { pages } from "@/config";
import { cn } from "@/lib/utils";
import { TabsLink } from "@/components/ui/tabs";

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
  { segment: "series-graph", label: "Series graph" },
  { segment: "images", label: "Images" },
  { segment: "videos", label: "Videos" },
  { segment: "recommendations", label: "Recommendations" },
  { segment: "similar", label: "Similar" },
] as const;

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
          className={cn(
            "rounded-md bg-muted p-1 text-muted-foreground",
            mediaType === "tv"
              ? "flex min-h-10 w-full flex-wrap items-center gap-1 lg:inline-flex lg:w-max lg:flex-nowrap"
              : "inline-flex min-h-10 w-max items-center gap-1",
          )}
        >
          {tabs.map(({ segment, label }) => {
            const href = segment ? `${root}/${id}/${segment}` : `${root}/${id}`;
            return (
              <TabsLink key={label} href={href}>
                {label}
              </TabsLink>
            );
          })}
        </div>
      </div>
    </div>
  );
};
