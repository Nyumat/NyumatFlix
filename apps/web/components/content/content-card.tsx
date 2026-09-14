"use client";

import { BackdropCard } from "@/components/cards/backdrop-card";
import { PosterCard } from "@/components/cards/poster-card";
import { useCatalogCardStyle } from "@/lib/catalog-card-presentation";
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
  const catalogCardStyle = useCatalogCardStyle();

  if (catalogCardStyle === "backdrop") {
    return (
      <BackdropCard
        item={item}
        isMobile={isMobile}
        href={href}
        hideTitleFallback={hideTitleFallback}
      />
    );
  }

  return (
    <PosterCard
      item={item}
      isMobile={isMobile}
      href={href}
      hideTitleFallback={hideTitleFallback}
    />
  );
}
