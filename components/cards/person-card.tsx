"use client";

import { MediaCard, MediaPoster } from "@/components/media";
import { hasProfilePath } from "@/lib/media-poster-path";
import { isDeceasedAsOfToday } from "@/lib/utils";
import type { CanonicalPersonCard } from "@/utils/typings";
import Link from "next/link";

export function PersonCardPresenter({
  id,
  name,
  title,
  profile_path,
  known_for_department,
  deathday,
  href,
}: CanonicalPersonCard) {
  const displayName = name || title;
  const monochrome = isDeceasedAsOfToday(deathday);

  if (!hasProfilePath({ profile_path })) {
    return null;
  }

  return (
    <Link
      href={href || `/person/${id}`}
      key={id}
      className="w-full"
      prefetch={false}
    >
      <MediaCard.Root>
        <MediaPoster
          image={profile_path ?? undefined}
          alt={displayName}
          monochrome={monochrome}
        />
        <MediaCard.Content>
          <MediaCard.Title className="mt-2">{displayName}</MediaCard.Title>

          {known_for_department && (
            <MediaCard.Excerpt>
              Known for {known_for_department}
            </MediaCard.Excerpt>
          )}
        </MediaCard.Content>
      </MediaCard.Root>
    </Link>
  );
}
