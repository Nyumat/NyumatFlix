"use client";

import { Button } from "@/components/ui/button";
import { usePrefetch } from "@/hooks/usePrefetch";
import { MediaItem, isMovie } from "@/utils/typings";
import { ReactNode } from "react";

interface PrefetchButtonProps {
  /** Button content */
  children: ReactNode;
  /** Items to prefetch on hover */
  prefetchItems?: MediaItem[];
  /** Custom URLs to prefetch */
  prefetchUrls?: string[];
  /** Button props */
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  /** Prefetch delay on hover */
  prefetchDelay?: number;
  /** Button variant */
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
}

export function PrefetchButton({
  children,
  prefetchItems = [],
  prefetchUrls = [],
  className,
  disabled = false,
  onClick,
  prefetchDelay = 200,
  variant = "default",
  size = "default",
}: PrefetchButtonProps) {
  const { prefetchRoute } = usePrefetch();

  const handleMouseEnter = () => {
    if (disabled) return;

    // Prefetch custom URLs
    prefetchUrls.forEach((url) => {
      prefetchRoute(url, { delay: prefetchDelay, prefetchData: false });
    });

    // Prefetch media items
    prefetchItems.forEach((item) => {
      const mediaType = isMovie(item) ? "movie" : "tv";
      const href = `/${mediaType === "movie" ? "movies" : "tvshows"}/${item.id}`;

      prefetchRoute(href, {
        delay: prefetchDelay,
        prefetchData: true,
        mediaType,
        mediaId: item.id,
      });
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
    >
      {children}
    </Button>
  );
}
