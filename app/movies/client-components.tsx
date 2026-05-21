"use client";

import { MediaItem } from "@/lib/domain/typings";
import NextDynamic from "next/dynamic";
import { use } from "react";

export const DynamicMediaCarousel = NextDynamic(
  () => import("@/components/hero/media-carousel").then((m) => m.MediaCarousel),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-[80vh] md:h-[92vh] overflow-hidden bg-black" />
    ),
  },
);

interface StreamingMediaCarouselProps {
  itemsPromise: Promise<MediaItem[]>;
}

export const StreamingMediaCarousel = ({
  itemsPromise,
}: StreamingMediaCarouselProps) => {
  const items = use(itemsPromise);
  return <DynamicMediaCarousel items={items} />;
};
