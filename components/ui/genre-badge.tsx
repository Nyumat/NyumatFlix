"use client";

import { getGenreName } from "@/components/content/genre-helpers";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface GenreBadgeProps {
  genreId: number;
  genreName: string;
  mediaType?: "movie" | "tv";
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "chrome"
    | "stylish";
  className?: string;
  clickable?: boolean;
}

export function GenreBadge({
  genreId,
  genreName,
  mediaType,
  variant = "chrome",
  className,
  clickable = true,
}: GenreBadgeProps) {
  const href =
    mediaType === "movie"
      ? `/movies/browse?genre=${genreId}`
      : `/tvshows/browse?genre=${genreId}`;
  const tooltipText = `Browse ${genreName} ${mediaType === "movie" ? "movies" : "TV shows"}`;

  if (!clickable) {
    return (
      <Badge variant={variant} className={className}>
        {genreName}
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={href} className="inline-block" aria-label={tooltipText}>
          <Badge
            variant={variant}
            className={cn(
              "cursor-pointer transition-all hover:scale-105 hover:shadow-md",
              className,
            )}
          >
            {genreName}
          </Badge>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipText}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function PrimaryGenreBadge(props: GenreBadgeProps) {
  return (
    <GenreBadge
      {...props}
      variant="chrome"
      className={cn(
        "focus:ring-0 focus:ring-offset-0 active:ring-0 active:ring-offset-0",
        props.className,
      )}
    />
  );
}

interface SmartGenreBadgeGroupProps {
  genreIds: number[];
  mediaType: "movie" | "tv";
  maxVisible?: number;
  className?: string;
  badgeClassName?: string;
  variant?:
    | "default"
    | "secondary"
    | "destructive"
    | "outline"
    | "chrome"
    | "stylish";
}

export function SmartGenreBadgeGroup({
  genreIds,
  mediaType,
  maxVisible = 2,
  className,
  badgeClassName,
  variant = "chrome",
}: SmartGenreBadgeGroupProps) {
  if (!genreIds || genreIds.length === 0) {
    return null;
  }

  const visibleGenres = genreIds.slice(0, maxVisible);
  const hiddenGenres = genreIds.slice(maxVisible);
  const hasHiddenGenres = hiddenGenres.length > 0;

  const hiddenGenreNames = hiddenGenres.map((id) =>
    getGenreName(id, mediaType),
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visibleGenres.map((genreId) => (
        <GenreBadge
          key={genreId}
          genreId={genreId}
          genreName={getGenreName(genreId, mediaType)}
          mediaType={mediaType}
          variant={variant}
          className={badgeClassName}
        />
      ))}

      {hasHiddenGenres && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant={variant}
              className={cn(
                "cursor-help transition-colors hover:bg-primary/20 hover:text-primary hover:border-primary/50",
                badgeClassName,
              )}
            >
              +{hiddenGenres.length} more
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm font-medium">Additional genres:</p>
            <p className="text-xs text-muted-foreground">
              {hiddenGenreNames.join(", ")}
            </p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
