"use client";

import { BackdropCard } from "@/components/cards/backdrop-card";
import { BackdropTopRankRibbon } from "@/components/cards/backdrop-top-rank-ribbon";
import {
  type CanonicalMediaCard,
  isMovie,
  type MediaItem,
} from "@/lib/domain/typings";
import { cn } from "@/lib/utils";

export type RankedBackdropCardVariant = "overlay" | "ribbon";

const getRankOverlayClassName = (rank: number) => {
  if (rank === 1) return "from-amber-300 to-amber-600";
  if (rank === 2) return "from-slate-200 to-slate-500";
  if (rank === 3) return "from-orange-300 to-orange-700";
  return "text-white";
};

export interface RankedBackdropCardProps {
  item: CanonicalMediaCard | MediaItem;
  rank: number;
  variant?: RankedBackdropCardVariant;
}

export const RankedBackdropCard = ({
  item,
  rank,
  variant = "overlay",
}: RankedBackdropCardProps) => {
  const itemHref =
    "href" in item && typeof item.href === "string"
      ? item.href
      : `/${isMovie(item) ? "movies" : "tvshows"}/${item.id}`;

  const frameOverlay =
    variant === "ribbon" ? (
      <BackdropTopRankRibbon rank={rank} />
    ) : (
      <span
        className={cn(
          "pointer-events-none absolute top-3 left-3 z-20 text-4xl font-black tabular-nums tracking-tighter sm:text-5xl",
          rank <= 3
            ? "bg-linear-to-b bg-clip-text text-transparent drop-shadow-md"
            : "drop-shadow-md",
          getRankOverlayClassName(rank),
        )}
      >
        {rank}
      </span>
    );

  return (
    <BackdropCard item={item} href={itemHref} frameOverlay={frameOverlay} />
  );
};
