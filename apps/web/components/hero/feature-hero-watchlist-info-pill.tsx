"use client";

import { WatchlistButton } from "@/components/watchlist/watchlist";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import Link from "next/link";

const pillSegmentClass =
  "inline-flex h-full w-16 items-center justify-center rounded-none bg-transparent p-0 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

const watchlistSegmentClass = cn(
  pillSegmentClass,
  "border-0 shadow-none backdrop-blur-none hover:border-transparent hover:bg-white/15 hover:shadow-none dark:hover:border-transparent dark:hover:bg-white/15",
);

type FeatureHeroWatchlistInfoPillProps = {
  contentId: number;
  mediaType: "movie" | "tv";
  detailHref: string;
  title: string;
};

export function FeatureHeroWatchlistInfoPill({
  contentId,
  mediaType,
  detailHref,
  title,
}: FeatureHeroWatchlistInfoPillProps) {
  return (
    <div className="group/pill inline-flex h-[52px] items-stretch overflow-hidden rounded-full border border-white/10 bg-white/10 text-white shadow-lg shadow-black/20 backdrop-blur-[20px] backdrop-saturate-150">
      <WatchlistButton
        contentId={contentId}
        mediaType={mediaType}
        variant="ghost"
        size="icon"
        className={watchlistSegmentClass}
      />
      <span
        className="my-3 w-px shrink-0 bg-white/20 transition-opacity duration-200 group-hover/pill:opacity-0"
        aria-hidden="true"
      />
      <Link
        href={detailHref}
        aria-label={`More info about ${title}`}
        className={pillSegmentClass}
      >
        <Info className="size-5" />
      </Link>
    </div>
  );
}
