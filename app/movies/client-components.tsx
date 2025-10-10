"use client";

import NextDynamic from "next/dynamic";

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
