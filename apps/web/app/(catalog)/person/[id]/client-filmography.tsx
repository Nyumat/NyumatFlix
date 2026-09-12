"use client";

import { MediaContentGrid } from "@/components/content/media-content-grid";
import { InfiniteScroll } from "@/components/ui/infinite-scroll";
import { MediaItem } from "@/lib/domain/typings";
import { getFilmographyListNodes } from "./actions";

interface PersonFilmographyProps {
  personId: number;
  initialFilmography: MediaItem[];
}

export function PersonFilmography({
  personId,
  initialFilmography,
}: PersonFilmographyProps) {
  const initialOffset = 2;

  const initialSeenIds = initialFilmography
    .filter((item) => typeof item.id === "number")
    .map((item) => {
      const mediaType =
        item.media_type ??
        ("title" in item ? "movie" : "name" in item ? "tv" : "content");
      return `${mediaType}-${String(item.id)}`;
    });

  return (
    <InfiniteScroll
      getListNodes={async (offset: number, seenIds?: string[]) => {
        const result = await getFilmographyListNodes(personId, offset, seenIds);
        if (!result) return null;

        const { items, nextOffset } = result;
        return [
          <MediaContentGrid
            items={items}
            key={offset}
            type="multi"
            showViewModeControls={false}
            itemsPerRow={4}
          />,
          nextOffset,
          items,
        ] as const;
      }}
      initialOffset={initialOffset}
      className="space-y-8"
      initialSeenIds={initialSeenIds}
      unifiedGrid={true}
      initialItems={initialFilmography}
      gridType="multi"
      gridItemsPerRow={4}
    />
  );
}
