"use client";

import { HoverCardPortal } from "@radix-ui/react-hover-card";
import { pages } from "@/config";
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

export const TvCard: React.FC<TvShow> = (props) => {
  const { id, poster_path, name, vote_average, vote_count, first_air_date } =
    props;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Link
          href={`${pages.tv.root.link}/${id}`}
          key={id}
          className="w-full"
          prefetch={false}
        >
          <MediaCard.Root>
            <MediaPoster image={poster_path} alt={name} />

            <MediaCard.Content>
              <MediaRating
                average={vote_average}
                count={vote_count}
                className="mb-2"
              />
              <MediaCard.Title>{name}</MediaCard.Title>
              <MediaCard.Excerpt>
                {formatValue(first_air_date, format.year)}
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
