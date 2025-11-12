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
      "backdrop-blur-md bg-white/10 border border-white/30 rounded-full hover:bg-white/20 hover:border-white/40 hover:shadow-xl transition shadow-lg overflow-hidden",
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
        className="px-2 py-1 text-xs font-medium rounded-full data-[state=on]:bg-white/20 data-[state=on]:text-black data-[state=off]:text-white data-[state=off]:hover:text-white/80 transition-colors duration-200"
        aria-label="Movie content"
      >
        MOVIE
      </ToggleGroupItem>
      <ToggleGroupItem
        value="tv"
        className="px-2 py-1 text-xs font-medium rounded-full data-[state=on]:bg-white/20 data-[state=on]:text-black data-[state=off]:text-white data-[state=off]:hover:text-white/80 transition-colors duration-200"
        aria-label="TV show content"
      >
        TV
      </ToggleGroupItem>
      <ToggleGroupItem
        value="anime"
        className="px-2 py-1 text-xs font-medium rounded-full data-[state=on]:bg-white/20 data-[state=on]:text-black data-[state=off]:text-white data-[state=off]:hover:text-white/80 transition-colors duration-200"
        aria-label="Anime content"
      >
        ANIME
      </ToggleGroupItem>
      <ToggleGroupItem
        value="animepahe"
        className="px-2 py-1 text-xs font-medium rounded-full data-[state=on]:bg-white/20 data-[state=on]:text-black data-[state=off]:text-white data-[state=off]:hover:text-white/80 transition-colors duration-200"
        aria-label="AnimePahe content"
      >
        ANIMEPAHE
      </ToggleGroupItem>
    </ToggleGroup>
  </div>
));

ContentTypeToggle.displayName = "ContentTypeToggle";
