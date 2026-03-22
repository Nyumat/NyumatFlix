"use client";

import { HoverCardPortal } from "@radix-ui/react-hover-card";
import { pages } from "@/config";
import useMedia from "@/hooks/useMedia";
import { hasPosterPath } from "@/lib/media-poster-path";
import { formatValue } from "@/lib/utils";
import { type Movie } from "@/tmdb/models";
import { format } from "@/tmdb/utils";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { MediaCard, MediaPoster } from "@/components/media";
import { MediaPreview, MediaRating } from "@/components/media/media-shared";
import Link from "next/link";
import React from "react";

export type MovieCardProps = Movie & {
  variant?: "default" | "linkOnly";
};

export const MovieCard: React.FC<MovieCardProps> = (props) => {
  const { variant = "default", ...movie } = props;
  const { id, poster_path, title, vote_average, vote_count, release_date } =
    movie;

  const isMdUp = useMedia("(min-width: 768px)", false);
  const enableHoverPreview = variant !== "linkOnly" && isMdUp;

  if (!hasPosterPath({ poster_path })) {
    return null;
  }

  const cardInner = (
    <MediaCard.Root className="group">
      <MediaPoster image={poster_path} alt={title} />

      <MediaCard.Content>
        <MediaRating
          average={vote_average}
          count={vote_count}
          className="mb-2"
          showTooltip={enableHoverPreview}
        />
        <MediaCard.Title>{title}</MediaCard.Title>
        <MediaCard.Excerpt>
          {formatValue(release_date, format.year)}
        </MediaCard.Excerpt>
      </MediaCard.Content>
    </MediaCard.Root>
  );

  const link = (
    <Link href={`${pages.movie.root.link}/${id}`} prefetch={false}>
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
          <MediaPreview {...movie} />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
};
