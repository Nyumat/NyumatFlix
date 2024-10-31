import { ContentCategory, MediaItem } from "@utils/typings";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Card from "./Card";

interface CategoryRowProps {
  category: ContentCategory;
  mediaType: "movie" | "tv";
}

export function CategoryRow({ category, mediaType }: CategoryRowProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-2 px-4">
        <h1 className="text-xl md:text-2xl lg:text-4xl font-bold text-white">
          {category.title}
        </h1>
        <Link
          href={`/${mediaType === "tv" ? "tvshows" : `${mediaType}s`}/${category.query}`}
          className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
        >
          View All
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
      <div className="relative">
        <div className="flex overflow-x-scroll scrollbar-hide overflow-y-hidden space-x-4 px-4">
          {isLoaded
            ? category.items.map((item: MediaItem) => (
                <div key={item.id} className="flex-none w-[200px] group">
                  <div className="relative pt-4 pb-2">
                    <Card item={item} mediaType={mediaType} />
                  </div>
                </div>
              ))
            : [...Array(5)].map((_, i) => (
                <div key={i} className="flex-none w-[200px] animate-pulse">
                  <div className="w-full aspect-[2/3] bg-gray-700 rounded-lg mb-2" />
                  <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-700 rounded w-1/2" />
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
