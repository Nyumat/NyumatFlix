import { Card, CardContent } from "@/components/ui/card";
import type { MediaItem } from "@/utils/typings";
import { Suspense } from "react";
import { MediaCard } from "./media-card";

const SuspenseSkeleton = () => (
  <Card className="overflow-hidden">
    <CardContent className="p-0 relative">
      <div className="aspect-[2/3] bg-gray-900 animate-pulse" />
    </CardContent>
  </Card>
);

const Fallback = Array.from({ length: 16 }).map((_, i) => (
  <SuspenseSkeleton key={i} />
));

export function ContentGrid({
  items,
  title,
  type,
}: {
  items: MediaItem[];
  title?: string;
  type: "movie" | "tv";
}) {
  if (items.length === 0) {
    return <div>No content found for {type}</div>;
  }

  const mediaCards = items.map((item) => (
    <MediaCard key={item.id} item={item} type={type} />
  ));

  return (
    <div className="p-4">
      {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
        <Suspense fallback={Fallback}>{mediaCards}</Suspense>
      </div>
    </div>
  );
}
