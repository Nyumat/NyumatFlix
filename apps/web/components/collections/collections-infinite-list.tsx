"use client";

import { CollectionShowcase } from "@/components/collections/collection-showcase";
import { homeCollectionPartToMediaItem } from "@/lib/cards/catalog-dto";
import type { HomeCollection } from "@/lib/server/home-collections-data";
import { useEffect, useRef, useState } from "react";

const PAGE_SIZE = 4;

export function CollectionsInfiniteList({
  collections,
}: {
  collections: HomeCollection[];
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = visibleCount < collections.length;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((count) =>
            Math.min(count + PAGE_SIZE, collections.length),
          );
        }
      },
      { rootMargin: "320px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [collections.length, hasMore]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:gap-6">
        {collections.slice(0, visibleCount).map((collection, index) => (
          <CollectionShowcase
            key={collection.id}
            collection={collection}
            items={collection.parts.map(homeCollectionPartToMediaItem)}
            priority={index < 2}
          />
        ))}
      </div>
      {hasMore ? <div ref={sentinelRef} className="h-10" aria-hidden /> : null}
    </>
  );
}
