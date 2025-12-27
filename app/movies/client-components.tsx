"use client";

import { MediaItem } from "@/utils/typings";
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

export const LazyContentRowsDynamic = NextDynamic(
  () =>
    import("@/components/content/lazy-content-rows").then(
      (m) => m.LazyContentRows,
    ),
  { ssr: false },
);

interface StreamingMediaCarouselProps {
  itemsPromise: Promise<MediaItem[]>;
}

export function StreamingMediaCarousel({
  itemsPromise,
}: StreamingMediaCarouselProps) {
  const items = use(itemsPromise);
  return <DynamicMediaCarousel items={items} />;
}
