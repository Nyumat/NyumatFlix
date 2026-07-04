"use client";

import { cn } from "@/lib/utils";
import { User } from "lucide-react";
import Image from "next/image";

interface KnownForItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  media_type: string;
}

interface PersonCollageProps {
  knownFor?: KnownForItem[];
  profilePath?: string | null;
  className?: string;
}

const getCollageLayout = (
  count: number,
): {
  imagesToShow: number;
  gridCols: string;
  gridRows: string;
  specialLayout?: "three";
} => {
  if (count <= 1) {
    return {
      imagesToShow: 1,
      gridCols: "grid-cols-1",
      gridRows: "grid-rows-1",
    };
  }
  if (count === 2) {
    return {
      imagesToShow: 2,
      gridCols: "grid-cols-2",
      gridRows: "grid-rows-1",
    };
  }
  if (count === 3) {
    return {
      imagesToShow: 3,
      gridCols: "grid-cols-2",
      gridRows: "grid-rows-2",
      specialLayout: "three",
    };
  }
  if (count === 4) {
    return {
      imagesToShow: 4,
      gridCols: "grid-cols-2",
      gridRows: "grid-rows-2",
    };
  }
  if (count > 4 && count <= 10) {
    return {
      imagesToShow: 5,
      gridCols: "grid-cols-3",
      gridRows: "grid-rows-2",
    };
  }
  return { imagesToShow: 10, gridCols: "grid-cols-4", gridRows: "grid-rows-3" };
};

export function PersonCollage({
  knownFor = [],
  profilePath,
  className,
}: PersonCollageProps) {
  const hasKnownFor = knownFor.length > 0;
  const { imagesToShow, gridCols, gridRows, specialLayout } = getCollageLayout(
    hasKnownFor ? knownFor.length : 0,
  );

  if (profilePath) {
    return (
      <div className={cn("relative h-full w-full", className)}>
        <Image
          src={`https://image.tmdb.org/t/p/w185${profilePath}`}
          fill
          sizes="44px"
          alt="Profile"
          className="rounded-md object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  if (!hasKnownFor) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-muted text-muted-foreground",
          className,
        )}
      >
        <User size={20} />
      </div>
    );
  }

  const imagesToDisplay = knownFor.slice(0, imagesToShow);

  if (specialLayout === "three") {
    return (
      <div
        className={cn(
          "grid h-full w-full gap-0.5 overflow-hidden rounded-md",
          gridCols,
          gridRows,
          className,
        )}
      >
        {imagesToDisplay.map((item, index) => {
          const isFirstImage = index === 0;
          return (
            <div
              key={`${item.id}-${index}`}
              className={cn(
                "relative h-full w-full",
                isFirstImage && "col-span-2",
              )}
            >
              {item.poster_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w154${item.poster_path}`}
                  fill
                  sizes="44px"
                  alt={item.title || item.name || "Media"}
                  className="object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <User size={12} className="text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid h-full w-full gap-0.5 overflow-hidden rounded-md",
        gridCols,
        gridRows,
        className,
      )}
    >
      {imagesToDisplay.map((item, index) => (
        <div key={`${item.id}-${index}`} className="relative h-full w-full">
          {item.poster_path ? (
            <Image
              src={`https://image.tmdb.org/t/p/w154${item.poster_path}`}
              fill
              sizes="44px"
              alt={item.title || item.name || "Media"}
              className="object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <User size={12} className="text-muted-foreground" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
