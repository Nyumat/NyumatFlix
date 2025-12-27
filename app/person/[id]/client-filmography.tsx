"use client";

import { ContentGrid } from "@/components/content/media-content-grid";
import { InfiniteScroll } from "@/components/ui/infinite-scroll";
import { MediaItem } from "@/utils/typings";
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
    .map((item) => item.id)
    .filter((id): id is number => typeof id === "number");

  return (
    <InfiniteScroll
      getListNodes={async (offset: number, seenIds?: number[]) => {
        const result = await getFilmographyListNodes(personId, offset, seenIds);
        if (!result) return null;

        const { items, nextOffset } = result;
        return [
          <ContentGrid
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
