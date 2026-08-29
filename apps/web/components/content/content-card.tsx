"use client";

import { PosterCard } from "@/components/cards/poster-card";
import type { CanonicalMediaCard, MediaItem } from "@/lib/domain/typings";

interface ContentCardProps {
  item: MediaItem | CanonicalMediaCard;
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
