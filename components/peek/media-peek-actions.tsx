"use client";

import { WatchlistButton } from "@/components/watchlist/watchlist";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { ArrowUpRight, Youtube } from "lucide-react";
import Link from "next/link";

type MediaPeekActionsProps = {
  playLabel: string;
  detailHref: string;
  contentId: number;
  mediaType: "movie" | "tv";
  canPlayTrailer: boolean;
  onPlay: () => void;
  onTrailer: () => void;
  onNavigate: () => void;
  compact?: boolean;
};

export const MediaPeekActions = ({
  playLabel,
  detailHref,
  contentId,
  mediaType,
  canPlayTrailer,
  onPlay,
  onTrailer,
  onNavigate,
  compact = false,
}: MediaPeekActionsProps) => (
  <div
    className={cn(
      "flex flex-wrap items-center gap-2 sm:gap-3",
      compact && "gap-2",
    )}
  >
    <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-white/12 bg-black/35 p-1 shadow-lg shadow-black/30 backdrop-blur-xl">
      <button
        type="button"
        onClick={onPlay}
        className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 text-sm font-bold text-black transition hover:bg-white/92"
      >
        <Icons.play className="size-4 fill-black text-black stroke-black" />
        {playLabel}
      </button>

      {canPlayTrailer ? (
        <button
          type="button"
          onClick={onTrailer}
          className="inline-flex size-10 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          aria-label="Play trailer"
        >
          <Youtube className="size-[18px]" />
        </button>
      ) : (
        <Tooltip>
          <TooltipTrigger
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-full text-white/40"
            disabled
            aria-disabled
            aria-label="Trailer unavailable"
          >
            <Youtube className="size-[18px]" />
          </TooltipTrigger>
          <TooltipContent>
            <p>No trailer is available for this title yet.</p>
          </TooltipContent>
        </Tooltip>
      )}

      <WatchlistButton
        contentId={contentId}
        mediaType={mediaType}
        variant="ghost"
        size="icon"
        className="size-10 rounded-full text-white hover:bg-white/10 hover:text-white"
      />
    </div>

    <Link
      href={detailHref}
      onClick={onNavigate}
      className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-foreground/90 transition hover:bg-white/8 hover:text-foreground"
    >
      View details
      <ArrowUpRight className="size-4 shrink-0 opacity-70" aria-hidden />
    </Link>
  </div>
);
