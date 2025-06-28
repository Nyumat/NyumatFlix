"use client";

import { MediaItem } from "@/utils/typings";

interface HeroPaginationProps {
  media: MediaItem[];
  currentItemIndex: number;
}

export function HeroPagination({
  media,
  currentItemIndex,
}: HeroPaginationProps) {
  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2 z-30">
      {media.map((_, index) => (
        <div
          key={index}
          className={`w-2 h-2 rounded-full ${
            index === currentItemIndex ? "bg-white" : "bg-white/50"
          }`}
        />
      ))}
    </div>
  );
}
