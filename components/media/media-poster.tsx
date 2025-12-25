"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

/**
 * Props for the Poster component
 */
interface PosterProps {
  /** Path to the poster image from TMDB */
  posterPath?: string;
  /** Title of the media for alt text */
  title?: string;
  /** Alternative text for accessibility */
  altText?: string;
  /**
   * Container size variant - affects image quality and sizing
   * - 'small': Thumbnails, lists (w92-w154)
   * - 'medium': Cards, grids (w300-w342)
   * - 'large': Hero sections, detail pages (w500-w780)
   */
  size?: "small" | "medium" | "large";
  /**
   * Custom aspect ratio override (default is 2/3 for posters)
   */
  aspectRatio?: string;
  /**
   * Custom className for the container
   */
  className?: string;
  /**
   * Whether to use object-cover or object-contain
   */
  objectFit?: "cover" | "contain";
}

/**
 * Poster component displays media poster images with responsive sizing
 * Automatically adjusts image quality based on container size.
 * @param props - The component props
 * @returns An optimized image component for media posters
 */
export const Poster = ({
  posterPath,
  title,
  altText,
  size = "medium",
  aspectRatio = "2/3",
  className,
  objectFit = "cover",
}: PosterProps) => {
  const imageUrl = useMemo(() => {
    if (!posterPath) return "/placeholder-poster.jpg";

    if (size === "small") {
      return `https://image.tmdb.org/t/p/w154${posterPath}`;
    }
    if (size === "large") {
      return `https://image.tmdb.org/t/p/w780${posterPath}`;
    }
    return `https://image.tmdb.org/t/p/w342${posterPath}`;
  }, [posterPath, size]);

  const sizes = useMemo(() => {
    if (size === "small") {
      return "(max-width: 640px) 56px, 64px";
    }
    if (size === "large") {
      return "(max-width: 640px) 200px, (max-width: 1024px) 300px, 500px";
    }
    return "(max-width: 640px) 40vw, (max-width: 1024px) 22vw, 12vw";
  }, [size]);

  const alt = altText || title || "Media poster";

  const aspectRatioClass = useMemo(() => {
    const ratioMap: Record<string, string> = {
      "2/3": "aspect-[2/3]",
      "3/4": "aspect-[3/4]",
      "16/9": "aspect-video",
      "1/1": "aspect-square",
    };
    return ratioMap[aspectRatio] || "aspect-[2/3]";
  }, [aspectRatio]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg",
        aspectRatioClass,
        className,
      )}
    >
      <Image
        src={imageUrl}
        alt={alt}
        fill
        sizes={sizes}
        className={cn(
          objectFit === "cover" ? "object-cover" : "object-contain",
          "transition-transform duration-300",
        )}
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      />
    </div>
  );
};
