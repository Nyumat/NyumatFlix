"use client";

import { cn } from "@/lib/utils";
import { tmdbImage, type PosterSize } from "@/tmdb/utils";
import Image from "next/image";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type SearchPosterThumbProps = ComponentPropsWithoutRef<"div"> & {
  posterPath?: string | null;
  alt: string;
  imageSize?: PosterSize;
  sizes?: string;
  priority?: boolean;
  radius?: "none" | "sm";
  fallback?: ReactNode;
};

export function SearchPosterThumb({
  posterPath,
  alt,
  className,
  imageSize = "w185",
  sizes = "48px",
  priority,
  radius = "none",
  fallback,
  ...props
}: SearchPosterThumbProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-neutral-900",
        radius === "sm" && "rounded-sm",
        className,
      )}
      {...props}
    >
      {posterPath ? (
        <Image
          src={tmdbImage.poster(posterPath, imageSize)}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover select-none"
          draggable={false}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
