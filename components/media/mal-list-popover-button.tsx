"use client";

import Image from "next/image";
import { CheckCircle2, ChevronDown, Star } from "lucide-react";
import { useMemo } from "react";

import { MalListControls } from "@/components/media/mal-list-controls";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMalListIndex } from "@/hooks/use-mal-list-index";
import {
  findMalListIndexItem,
  malEntryFromIndexItem,
} from "@/lib/mal/list-index-shared";
import {
  formatMalEpisodeTotal,
  malListStatusLabel,
  malScoreLabel,
  type MalListStatus,
} from "@/lib/mal/constants";
import { cn } from "@/lib/utils";

type MalListPopoverButtonProps = {
  anilistId?: number | null;
  contentId: number;
  mediaType: "movie" | "tv";
  seasonNumber?: number | null;
  showEnded?: boolean;
  className?: string;
  onUpdated?: () => void;
};

export function MalListPopoverButton({
  anilistId,
  contentId,
  mediaType,
  seasonNumber,
  showEnded = false,
  className,
  onUpdated,
}: MalListPopoverButtonProps) {
  const { items } = useMalListIndex();

  const indexItem = useMemo(
    () => findMalListIndexItem(items, mediaType, contentId),
    [contentId, items, mediaType],
  );

  const entry = indexItem ? malEntryFromIndexItem(indexItem) : null;
  const onList = entry?.onList === true;
  const status = (entry?.listStatus?.status ??
    (onList ? "watching" : "plan_to_watch")) as MalListStatus;
  const score = entry?.listStatus?.score ?? 0;
  const watched = entry?.listStatus?.num_episodes_watched ?? 0;
  const total = entry?.numEpisodes ?? null;

  const triggerLabel = onList ? malListStatusLabel(status) : "Add to MAL";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "backdrop-blur-md border border-white/30 text-white hover:bg-white/20 hover:border-white/40 rounded-full px-3 py-2 h-auto gap-1.5 shadow-lg",
            onList &&
              status === "completed" &&
              "border-emerald-400/40 bg-emerald-500/15",
            className,
          )}
          data-testid="mal-list-popover-trigger"
        >
          <Image
            src="/myanimelist-logo.png"
            alt=""
            width={16}
            height={16}
            className="size-4 rounded-sm opacity-90"
          />
          <span className="text-sm font-medium">{triggerLabel}</span>
          {onList && status === "completed" ? (
            <CheckCircle2 className="size-3.5 text-emerald-300" />
          ) : null}
          {onList && score > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-xs text-yellow-300">
              <Star className="size-3 fill-yellow-400 text-yellow-400" />
              {score}
            </span>
          ) : null}
          {onList && mediaType === "tv" && watched > 0 ? (
            <span className="text-[11px] text-white/70 tabular-nums">
              {watched}/{formatMalEpisodeTotal(total)}
            </span>
          ) : null}
          <ChevronDown className="size-3.5 text-white/70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(100vw-2rem,24rem)] border-white/15 bg-black/95 p-3 text-white shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-2 flex items-center gap-2">
          <Image
            src="/myanimelist-logo.png"
            alt=""
            width={18}
            height={18}
            className="size-[18px] rounded-sm opacity-90"
          />
          <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
            MyAnimeList
          </p>
        </div>
        <MalListControls
          anilistId={anilistId}
          contentId={contentId}
          mediaType={mediaType}
          seasonNumber={seasonNumber}
          showEnded={showEnded}
          indexItem={indexItem ?? undefined}
          compact
          onUpdated={onUpdated}
        />
        {onList && score > 0 ? (
          <p className="mt-2 text-[11px] text-white/50">
            Rated {malScoreLabel(score)} on MAL
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
