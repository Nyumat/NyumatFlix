"use client";

import { MediaCard, MediaPoster } from "@/components/media";
import { isDeceasedAsOfToday } from "@/lib/utils";
import { type Person } from "@/tmdb/models";
import Link from "next/link";
import React from "react";

export const PersonCard: React.FC<Person> = ({
  id,
  name,
  profile_path,
  known_for_department,
  deathday,
}) => {
  const monochrome = isDeceasedAsOfToday(deathday);

  return (
    <Link href={`/person/${id}`} key={id} className="w-full" prefetch={false}>
      <MediaCard.Root>
        <MediaPoster image={profile_path} alt={name} monochrome={monochrome} />
        <MediaCard.Content>
          <MediaCard.Title className="mt-2">{name}</MediaCard.Title>

          <MediaCard.Excerpt>
            Known for {known_for_department}
          </MediaCard.Excerpt>
        </MediaCard.Content>
      </MediaCard.Root>
    </Link>
  );
};
