"use client";

import {
  getDisplayTitle,
  getDisplayYear,
  getMediaLabel,
  getRatingDisplay,
} from "@/lib/cards/selectors";
import type { CanonicalMediaCard, MediaItem } from "@/lib/domain/typings";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

type BackdropCardCaptionProps = {
  item: CanonicalMediaCard | MediaItem;
  /** When a title logo is shown above, omit the text title. */
  hideTitle?: boolean;
  className?: string;
};

const Dot = () => (
  <span className="text-white/35" aria-hidden>
    ·
  </span>
);

/**
 * Plain caption under backdrop tiles: white title, single metadata line (no badges).
 */
export function BackdropCardCaption({
  item,
  hideTitle = false,
  className,
}: BackdropCardCaptionProps) {
  const title = getDisplayTitle(item);
  const rating = getRatingDisplay(item);
  const year = getDisplayYear(item);
  const typeLabel = getMediaLabel(item);

  const showMeta = Boolean(rating || year || typeLabel);

  return (
    <div className={cn("min-w-0 space-y-1 px-0.5", className)}>
      {!hideTitle && title ? (
        <p className="line-clamp-2 text-sm font-normal leading-snug text-white">
          {title}
        </p>
      ) : null}
      {showMeta ? (
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-normal text-white/70">
          {rating ? (
            <span className="inline-flex items-center gap-1">
              <Star
                className="size-3 shrink-0 fill-white/75 text-white/75"
                aria-hidden
              />
              {rating}
            </span>
          ) : null}
          {rating && (year || typeLabel) ? <Dot /> : null}
          {year ? <span>{year}</span> : null}
          {year && typeLabel ? <Dot /> : null}
          {typeLabel ? <span>{typeLabel}</span> : null}
        </p>
      ) : null}
    </div>
  );
}
