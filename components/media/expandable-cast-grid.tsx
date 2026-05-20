"use client";

import { Button } from "@/components/ui/button";
import { sortWithProfilePathFirst } from "@/lib/media-poster-path";
import { cn } from "@/lib/utils";
import type { Cast } from "@/tmdb/models";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  MediaCastCard,
  mediaCastGridClass,
} from "@/components/media/media-shared";

const COLLAPSED_ROWS = 3;

const getColumnCount = () => {
  if (typeof window === "undefined") return 5;

  const width = window.innerWidth;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
};

type ExpandableCastGridProps = {
  cast: Cast[];
};

export function ExpandableCastGrid({ cast }: ExpandableCastGridProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [columnCount, setColumnCount] = useState(getColumnCount);
  const sortedCast = useMemo(() => sortWithProfilePathFirst(cast), [cast]);
  const collapsedCount = columnCount * COLLAPSED_ROWS;
  const canExpand = sortedCast.length > collapsedCount;
  const visibleCast =
    isExpanded || !canExpand ? sortedCast : sortedCast.slice(0, collapsedCount);

  useEffect(() => {
    const handleResize = () => setColumnCount(getColumnCount());

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="relative">
      <div
        className={cn(mediaCastGridClass, canExpand && !isExpanded && "pb-8")}
      >
        {visibleCast.map((castMember) => (
          <MediaCastCard key={castMember.credit_id} {...castMember} />
        ))}
      </div>

      {canExpand ? (
        <div
          className={cn(
            "flex justify-center",
            !isExpanded &&
              "pointer-events-none absolute inset-x-0 bottom-0 items-end bg-linear-to-t from-background via-background/95 to-transparent pt-20",
            isExpanded && "mt-8",
          )}
        >
          <Button
            type="button"
            variant="secondary"
            className="pointer-events-auto h-10 rounded-full border border-white/15 bg-background/90 px-4 text-sm font-semibold shadow-xl shadow-black/20 backdrop-blur-md hover:bg-background"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? (
              <>
                Show less <ChevronUp className="size-4" aria-hidden />
              </>
            ) : (
              <>
                Read more cast <ChevronDown className="size-4" aria-hidden />
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
