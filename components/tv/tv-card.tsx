"use client";

import { HoverCardPortal } from "@radix-ui/react-hover-card";
import { pages } from "@/config";
import useMedia from "@/hooks/useMedia";
import { hasPosterPath } from "@/lib/media-poster-path";
import { format } from "@/tmdb/utils";
import { type TvShow } from "@/tmdb/models";
import { formatValue } from "@/lib/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { MediaCard, MediaPoster } from "@/components/media";
import { MediaPreview, MediaRating } from "@/components/media/media-shared";
import Link from "next/link";
import React from "react";

export type TvCardProps = TvShow & {
  variant?: "default" | "linkOnly";
};

export const TvCard: React.FC<TvCardProps> = (props) => {
  const { variant = "default", ...show } = props;
  const { id, poster_path, name, vote_average, vote_count, first_air_date } =
    show;

  const isMdUp = useMedia("(min-width: 768px)", false);
  const enableHoverPreview = variant !== "linkOnly" && isMdUp;

  if (!hasPosterPath({ poster_path })) {
    return null;
  }

  const cardInner = (
    <MediaCard.Root>
      <MediaPoster image={poster_path} alt={name} />

      <MediaCard.Content>
        <MediaRating
          average={vote_average}
          count={vote_count}
          className="mb-2"
          showTooltip={enableHoverPreview}
        />
        <MediaCard.Title>{name}</MediaCard.Title>
        <MediaCard.Excerpt>
          {formatValue(first_air_date, format.year)}
        </MediaCard.Excerpt>
      </MediaCard.Content>
    </MediaCard.Root>
  );

  const link = (
    <Link
      href={`${pages.tv.root.link}/${id}`}
      className="w-full"
      prefetch={false}
    >
      {cardInner}
    </Link>
  );

  if (!enableHoverPreview) {
    return link;
  }

  return (
    <HoverCard openDelay={500}>
      <HoverCardTrigger asChild>{link}</HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent side="bottom" align="start" className="w-96">
          <MediaPreview {...show} />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
};
