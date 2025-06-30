"use client";

import Image from "next/legacy/image";

interface PosterProps {
  posterPath?: string;
  title?: string;
  altText?: string;
}

export const Poster = ({ posterPath, title, altText }: PosterProps) =>
  posterPath ? (
    <Image
      src={`https://image.tmdb.org/t/p/w500${posterPath}`}
      alt={altText || title || "Media Poster"}
      width={500}
      height={750}
      className="w-full h-full object-cover"
    />
  ) : (
    <div className="w-full h-full bg-gray-200 flex items-center justify-center aspect-[2/3] text-gray-500 text-sm">
      <div className="text-center p-4">
        <p className="font-medium">No Image</p>
        {title && <p className="mt-2">{title}</p>}
      </div>
    </div>
  );
