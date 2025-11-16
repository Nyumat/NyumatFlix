"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption = "recently-watched" | "new-episodes" | "recently-added";
export type MediaFilter = "all" | "movies" | "tv";
export type TypeTab = "all" | "movies" | "tv";

interface WatchlistControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  mediaFilter: MediaFilter;
  onMediaFilterChange: (filter: MediaFilter) => void;
  typeTab: TypeTab;
  onTypeTabChange: (tab: TypeTab) => void;
}

export function WatchlistControls({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  mediaFilter,
  onMediaFilterChange,
  typeTab,
  onTypeTabChange,
}: WatchlistControlsProps) {
  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search your watchlist..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-10"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="sort-select"
            className="text-sm text-muted-foreground whitespace-nowrap"
          >
            Sort by:
          </label>
          <Select value={sortOption} onValueChange={onSortChange}>
            <SelectTrigger id="sort-select" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recently-watched">
                Most Recently Watched
              </SelectItem>
              <SelectItem value="new-episodes">
                New Episodes Available
              </SelectItem>
              <SelectItem value="recently-added">Recently Added</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Filter:
          </span>
          <div className="flex gap-1">
            <Button
              variant={mediaFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => onMediaFilterChange("all")}
            >
              All
            </Button>
            <Button
              variant={mediaFilter === "movies" ? "default" : "outline"}
              size="sm"
              onClick={() => onMediaFilterChange("movies")}
            >
              Movies Only
            </Button>
            <Button
              variant={mediaFilter === "tv" ? "default" : "outline"}
              size="sm"
              onClick={() => onMediaFilterChange("tv")}
            >
              TV Shows Only
            </Button>
          </div>
        </div>
      </div>

      {/* Type Tabs */}
      <Tabs
        value={typeTab}
        onValueChange={(value) => onTypeTabChange(value as TypeTab)}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="movies">Movies</TabsTrigger>
          <TabsTrigger value="tv">TV Shows</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
