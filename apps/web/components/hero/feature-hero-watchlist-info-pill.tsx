"use client";

import { WatchlistButton } from "@/components/watchlist/watchlist";
import { requestDetailPlay } from "@/lib/playback/detail-autoplay-href";
import { cn } from "@/lib/utils";
import { Info, Play } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const pillSegmentClass =
  "inline-flex h-full w-14 items-center justify-center rounded-none bg-transparent p-0 text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

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

export function FeatureHeroPlayButton({
  detailHref,
  mediaType,
}: {
  detailHref: string;
  mediaType: "movie" | "tv";
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() =>
        requestDetailPlay((href) => router.push(href), detailHref, {
          mediaType,
        })
      }
      className="inline-flex h-11 min-w-[108px] cursor-pointer items-center justify-center rounded-full border border-white/80 bg-white/95 px-5 text-base font-bold text-black shadow-lg shadow-black/25 transition hover:bg-white"
    >
      <Play className="mr-1.5 size-4 fill-black text-black" />
      Play
    </button>
  );
}

export function FeatureHeroWatchlistInfoPill({
  contentId,
  mediaType,
  detailHref,
  title,
}: FeatureHeroWatchlistInfoPillProps) {
  return (
    <div className="group/pill inline-flex h-11 items-stretch overflow-hidden rounded-full border border-white/10 bg-white/10 text-white shadow-lg shadow-black/20 backdrop-blur-[20px] backdrop-saturate-150">
      <WatchlistButton
        contentId={contentId}
        mediaType={mediaType}
        variant="ghost"
        size="icon"
        className={watchlistSegmentClass}
      />
      <span
        className="my-2.5 w-px shrink-0 bg-white/20 transition-opacity duration-200 group-hover/pill:opacity-0"
        aria-hidden="true"
      />
      <Link
        href={detailHref}
        aria-label={`More info about ${title}`}
        className={pillSegmentClass}
      >
        <Info className="size-4" />
      </Link>
    </div>
  );
}
