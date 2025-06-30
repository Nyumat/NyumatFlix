"use client";

import { usePrefetch } from "@/hooks/usePrefetch";
import { MediaItem, isMovie } from "@/utils/typings";
import Link from "next/link";
import { useEffect } from "react";

interface EnhancedLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Media item for intelligent API prefetching */
  mediaItem?: MediaItem;
  /** Disable prefetching */
  noPrefetch?: boolean;
  /** Custom prefetch delay in ms */
  prefetchDelay?: number;
  /** Additional props to pass to the Link component */
  [key: string]: unknown;
}

export function EnhancedLink({
  href,
  children,
  className,
  mediaItem,
  noPrefetch = false,
  prefetchDelay = 150,
  ...linkProps
}: EnhancedLinkProps) {
  const { prefetchRoute, cancelPrefetch, cleanup } = usePrefetch();

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleMouseEnter = () => {
    if (noPrefetch) return;

    let mediaType: "movie" | "tv" | undefined;
    let mediaId: number | undefined;

    // Extract media info from href if mediaItem not provided
    if (mediaItem) {
      mediaType = isMovie(mediaItem) ? "movie" : "tv";
      mediaId = mediaItem.id;
    } else {
      // Parse from href patterns like /movies/123 or /tvshows/456
      const movieMatch = href.match(/\/movies\/(\d+)/);
      const tvMatch = href.match(/\/tvshows\/(\d+)/);

      if (movieMatch) {
        mediaType = "movie";
        mediaId = parseInt(movieMatch[1]);
      } else if (tvMatch) {
        mediaType = "tv";
        mediaId = parseInt(tvMatch[1]);
      }
    }

    prefetchRoute(href, {
      delay: prefetchDelay,
      prefetchData: !!(mediaType && mediaId),
      mediaType,
      mediaId,
    });
  };

  const handleMouseLeave = () => {
    if (!noPrefetch) {
      cancelPrefetch();
    }
  };

  return (
    <Link
      href={href}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...linkProps}
    >
      {children}
    </Link>
  );
}
