"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface GenreBadgeProps {
  genreId: number;
  genreName: string;
  mediaType?: "movie" | "tv";
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
  clickable?: boolean;
}

export function GenreBadge({
  genreId,
  genreName,
  mediaType = "movie",
  variant = "secondary",
  className,
  clickable = true,
}: GenreBadgeProps) {
  const router = useRouter();
  const href =
    mediaType === "movie"
      ? `/movies/browse?genre=${genreId}`
      : `/tvshows/browse?genre=${genreId}`;

  if (!clickable) {
    return (
      <Badge variant={variant} className={className}>
        {genreName}
      </Badge>
    );
  }

  return (
    <Badge
      onClick={() => router.push(href)}
      title={`Browse ${genreName} movies`}
      aria-label={`Browse ${genreName} movies`}
      role="button"
      tabIndex={0}
      variant={variant}
      className={cn(
        "cursor-pointer transition-all hover:scale-105 hover:shadow-md",
        className,
      )}
    >
      {genreName}
    </Badge>
  );
}
