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

export type SortOption = "recently-watched" | "new-episodes" | "recently-added";
export type StatusFilter = "all" | "watching" | "waiting" | "finished";
export type TypeTab = "all" | "movies" | "tv";

interface WatchlistControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  typeTab: TypeTab;
  onTypeTabChange: (tab: TypeTab) => void;
}

export function WatchlistControls({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  statusFilter,
  onStatusFilterChange,
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
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label
              htmlFor="sort-select"
              className="text-sm text-muted-foreground whitespace-nowrap"
            >
              Sort by:
            </label>
            <Select value={sortOption} onValueChange={onSortChange}>
              <SelectTrigger id="sort-select" className="w-full sm:w-[200px]">
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

          {/* Type Tabs (moved here for better grouping on mobile) */}
           <Tabs
            value={typeTab}
            onValueChange={(value) => onTypeTabChange(value as TypeTab)}
            className="w-full sm:w-auto"
          >
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all" className="flex-1 sm:flex-none">All</TabsTrigger>
              <TabsTrigger value="movies" className="flex-1 sm:flex-none">Movies</TabsTrigger>
              <TabsTrigger value="tv" className="flex-1 sm:flex-none">TV Shows</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
          <span className="text-sm text-muted-foreground whitespace-nowrap hidden sm:inline-block">
            Status:
          </span>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange("all")}
              className="flex-1 sm:flex-none"
            >
              All
            </Button>
            <Button
              variant={statusFilter === "watching" ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange("watching")}
              className="flex-1 sm:flex-none"
            >
              Watching
            </Button>
            <Button
              variant={statusFilter === "waiting" ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange("waiting")}
              className="flex-1 sm:flex-none"
            >
              Waiting
            </Button>
            <Button
              variant={statusFilter === "finished" ? "default" : "outline"}
              size="sm"
              onClick={() => onStatusFilterChange("finished")}
              className="flex-1 sm:flex-none"
            >
              Finished
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
