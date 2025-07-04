"use client";

import { MediaItem } from "@/utils/typings";

interface HeroPaginationProps {
  /** Array of items to paginate through */
  items: MediaItem[];
  /** Index of the currently active item */
  currentIndex: number;
  /** Optional click handler when a dot is selected */
  onItemSelect?: (index: number) => void;
}

export function HeroPagination({
  items,
  currentIndex,
  onItemSelect,
}: HeroPaginationProps) {
  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex justify-center space-x-2 z-30">
      {items.map((_, index) => {
        const isActive = index === currentIndex;
        const className = `w-2 h-2 rounded-full transition-colors duration-200 ${isActive ? "bg-foreground" : "bg-foreground/50 hover:bg-foreground"}`;

        if (!onItemSelect) {
          return <div key={index} className={className} />;
        }

        return (
          <button
            key={index}
            aria-label={`Go to slide ${index + 1}`}
            onClick={() => onItemSelect(index)}
            className={className}
          />
        );
      })}
    </div>
  );
}
