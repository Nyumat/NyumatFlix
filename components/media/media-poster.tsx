"use client";

import Image from "next/legacy/image";

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
}

/**
 * Poster component displays media poster images with fallback handling
 * @param props - The component props
 * @returns An optimized image component for media posters
 */
export const Poster = ({ posterPath, title, altText }: PosterProps) => {
  const imageUrl = posterPath
    ? `https://image.tmdb.org/t/p/w780${posterPath}`
    : "/placeholder-poster.jpg";

  const alt = altText || title || "Media poster";

  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg">
      <Image
        src={imageUrl}
        alt={alt}
        layout="fill"
        objectFit="cover"
        className="transition-transform duration-300 group-hover:scale-105"
        placeholder="blur"
        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
      />
    </div>
  );
};
