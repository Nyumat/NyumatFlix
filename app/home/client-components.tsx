"use client";

import { MediaItem } from "@/utils/typings";
import NextDynamic from "next/dynamic";
import { use } from "react";

export const DynamicMediaCarousel = NextDynamic(
  () => import("@/components/hero/hero-client").then((m) => m.MediaCarousel),
  {
    ssr: false,
    loading: () => (
      <div className="relative h-[75vh] md:h-[85vh] lg:h-[92vh] overflow-hidden bg-black" />
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
