"use client";

import { HoverCardPortal } from "@radix-ui/react-hover-card";
import { pages } from "@/config";
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

export const MovieCard: React.FC<Movie> = (props) => {
  const { id, poster_path, title, vote_average, vote_count, release_date } =
    props;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Link href={`${pages.movie.root.link}/${id}`} key={id} prefetch={false}>
          <MediaCard.Root className="group">
            <MediaPoster image={poster_path} alt={title} />

            <MediaCard.Content>
              <MediaRating
                average={vote_average}
                count={vote_count}
                className="mb-2"
              />
              <MediaCard.Title>{title}</MediaCard.Title>
              <MediaCard.Excerpt>
                {formatValue(release_date, format.year)}
              </MediaCard.Excerpt>
            </MediaCard.Content>
          </MediaCard.Root>
        </Link>
      </HoverCardTrigger>
      <HoverCardPortal>
        <HoverCardContent side="right" align="start" className="w-96">
          <MediaPreview {...props} />
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
};
