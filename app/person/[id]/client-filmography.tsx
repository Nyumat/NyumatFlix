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

  return (
    <InfiniteScroll
      getListNodes={async (offset: number) => {
        const result = await getFilmographyListNodes(personId, offset);
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
        ] as const;
      }}
      initialOffset={initialOffset}
      className="space-y-8"
    >
      <ContentGrid items={initialFilmography} type="multi" itemsPerRow={4} />
    </InfiniteScroll>
  );
}
