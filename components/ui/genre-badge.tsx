"use client";

import { getGenreName } from "@/components/content/genre-helpers";
import { Badge } from "@/components/ui/badge";
import { EnhancedLink } from "@/components/ui/enhanced-link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
        <EnhancedLink
          href={href}
          prefetchDelay={100}
          className="inline-block"
          aria-label={tooltipText}
        >
          <Badge
            variant={variant}
            className={cn(
              "cursor-pointer transition-all hover:scale-105 hover:shadow-md",
              className,
            )}
          >
            {genreName}
          </Badge>
        </EnhancedLink>
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
      className={cn(
        "bg-primary/20 text-primary border-primary focus:ring-0 focus:ring-offset-0 active:ring-0 active:ring-offset-0",
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
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export function SmartGenreBadgeGroup({
  genreIds,
  mediaType,
  maxVisible = 2,
  className,
  badgeClassName,
  variant = "secondary",
}: SmartGenreBadgeGroupProps) {
  if (!genreIds || genreIds.length === 0) {
    return null;
  }

  const visibleGenres = genreIds.slice(0, maxVisible);
  const hiddenGenres = genreIds.slice(maxVisible);
  const hasHiddenGenres = hiddenGenres.length > 0;

  // Import and use the existing getGenreName function from genre-helpers

  const hiddenGenreNames = hiddenGenres.map((id) =>
    getGenreName(id, mediaType),
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visibleGenres.map((genreId) => (
        <PrimaryGenreBadge
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
