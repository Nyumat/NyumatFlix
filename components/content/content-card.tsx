"use client";

import { PosterCard } from "@/components/cards";
import type { CanonicalMediaCard, MediaItem } from "@/utils/typings";

interface ContentCardProps {
  item: MediaItem | CanonicalMediaCard;
  // Cleanup note: ranked rendering has no current call sites; keep the props
  // temporarily so older callers do not break while rows move to presenters.
  isRanked?: boolean;
  rank?: number;
  isMobile: boolean;
  rating?: string;
  href?: string;
  hideTitleFallback?: boolean;
}

export function ContentCard({
  item,
  isMobile,
  href,
  hideTitleFallback,
}: ContentCardProps) {
  return (
    <PosterCard
      item={item}
      isMobile={isMobile}
      href={href}
      hideTitleFallback={hideTitleFallback}
    />
  );
}
