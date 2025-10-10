"use client";

import Image from "next/image";

interface PageBackgroundProps {
  imageUrl: string;
  title: string;
  className?: string;
}

export function PageBackground({
  imageUrl,
  title,
  className = "",
}: PageBackgroundProps) {
  return (
    <div
      className={`fixed -mt-5 h-[100dvh] w-full z-0 overflow-hidden ${className}`}
    >
      <Image
        src={imageUrl}
        alt={title}
        width={1920}
        height={1080}
        className="object-cover w-full h-full"
        priority
      />
      {/* darkening overlays from all directions */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/70 via-black/50 to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent opacity-70" />
    </div>
  );
}
