"use client";

import Image from "next/legacy/image";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <div className={cn("w-full h-full relative", className)}>
        <Image
          src={`https://image.tmdb.org/t/p/w185${profilePath}`}
          layout="fill"
          objectFit="cover"
          alt="Profile"
          className="rounded-md"
          loading="lazy"
        />
      </div>
    );
  }

  if (!hasKnownFor) {
    return (
      <div
        className={cn(
          "w-full h-full flex items-center justify-center text-muted-foreground bg-muted",
          className,
        )}
      >
        <User size={32} />
      </div>
    );
  }

  const imagesToDisplay = knownFor.slice(0, imagesToShow);

  if (specialLayout === "three") {
    return (
      <div
        className={cn(
          "w-full h-full grid gap-0.5 rounded-md overflow-hidden",
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
                "relative w-full h-full",
                isFirstImage && "col-span-2",
              )}
            >
              {item.poster_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w154${item.poster_path}`}
                  layout="fill"
                  objectFit="cover"
                  alt={item.title || item.name || "Media"}
                  className="transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-muted flex items-center justify-center">
                  <User size={16} className="text-muted-foreground" />
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
        "w-full h-full grid gap-0.5 rounded-md overflow-hidden",
        gridCols,
        gridRows,
        className,
      )}
    >
      {imagesToDisplay.map((item, index) => (
        <div key={`${item.id}-${index}`} className="relative w-full h-full">
          {item.poster_path ? (
            <Image
              src={`https://image.tmdb.org/t/p/w154${item.poster_path}`}
              layout="fill"
              objectFit="cover"
              alt={item.title || item.name || "Media"}
              className="transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center">
              <User size={16} className="text-muted-foreground" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
