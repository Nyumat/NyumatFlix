"use client";

import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export type ContentType = "movie" | "tv" | "anime" | "animepahe";

export interface ContentTypeToggleProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: ContentType;
  onValueChange: (value: ContentType) => void;
}

export const ContentTypeToggle = React.forwardRef<
  HTMLDivElement,
  ContentTypeToggleProps
>(({ className, value, onValueChange, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "overflow-hidden rounded-full border border-border/80 bg-background/50 shadow-lg backdrop-blur-md transition hover:border-border hover:shadow-xl dark:border-white/30 dark:bg-white/10 dark:hover:border-white/40 dark:hover:bg-white/20",
      className,
    )}
    {...props}
  >
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) onValueChange(newValue as ContentType);
      }}
      className="flex items-center gap-0 bg-transparent"
    >
      <ToggleGroupItem
        value="movie"
        className="rounded-full px-2 py-1 text-xs font-medium transition-colors duration-200 data-[state=on]:bg-primary/20 data-[state=on]:text-primary data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground dark:data-[state=on]:bg-white/20 dark:data-[state=on]:text-black dark:data-[state=off]:text-white/80 dark:data-[state=off]:hover:text-white"
        aria-label="Movie content"
      >
        MOVIE
      </ToggleGroupItem>
      <ToggleGroupItem
        value="tv"
        className="rounded-full px-2 py-1 text-xs font-medium transition-colors duration-200 data-[state=on]:bg-primary/20 data-[state=on]:text-primary data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground dark:data-[state=on]:bg-white/20 dark:data-[state=on]:text-black dark:data-[state=off]:text-white/80 dark:data-[state=off]:hover:text-white"
        aria-label="TV show content"
      >
        TV
      </ToggleGroupItem>
      <ToggleGroupItem
        value="anime"
        className="rounded-full px-2 py-1 text-xs font-medium transition-colors duration-200 data-[state=on]:bg-primary/20 data-[state=on]:text-primary data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground dark:data-[state=on]:bg-white/20 dark:data-[state=on]:text-black dark:data-[state=off]:text-white/80 dark:data-[state=off]:hover:text-white"
        aria-label="Anime content"
      >
        ANIME
      </ToggleGroupItem>
      <ToggleGroupItem
        value="animepahe"
        className="rounded-full px-2 py-1 text-xs font-medium transition-colors duration-200 data-[state=on]:bg-primary/20 data-[state=on]:text-primary data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground dark:data-[state=on]:bg-white/20 dark:data-[state=on]:text-black dark:data-[state=off]:text-white/80 dark:data-[state=off]:hover:text-white"
        aria-label="AnimePahe content"
      >
        ANIMEPAHE
      </ToggleGroupItem>
    </ToggleGroup>
  </div>
));

ContentTypeToggle.displayName = "ContentTypeToggle";
