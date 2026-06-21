"use client";

import {
  ANILIST_FORMAT_OPTIONS,
  ANILIST_GENRES,
  ANILIST_SEASON_OPTIONS,
  ANILIST_SORT_OPTIONS,
  ANILIST_STATUS_OPTIONS,
  buildAniListUrl,
  parseAniListSearchParams,
  type AniListSearchParams,
} from "@/lib/anilist";
import { cn } from "@/lib/utils";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AniListFiltersProps = {
  serverParams: Record<string, string>;
};

const EMPTY_SELECT_VALUE = "ALL";

const toRecord = (sp: URLSearchParams): Record<string, string> => {
  const out: Record<string, string> = {};
  sp.forEach((value, key) => {
    out[key] = value;
  });
  return out;
};

const countFilters = (filters: AniListSearchParams) => {
  let count = 0;
  if (filters.sort !== "TRENDING_DESC") count += 1;
  if (filters.query) count += 1;
  count += filters.genres.length;
  if (filters.format) count += 1;
  if (filters.status) count += 1;
  if (filters.season) count += 1;
  if (filters.year) count += 1;
  return count;
};

export const AniListFilters = ({ serverParams }: AniListFiltersProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [isMounted, setIsMounted] = useState(false);

  const currentFilters = useMemo(
    () =>
      parseAniListSearchParams(
        searchKey ? toRecord(searchParams) : serverParams,
      ),
    [searchKey, searchParams, serverParams],
  );
  const [draft, setDraft] = useState<AniListSearchParams>(currentFilters);

  const selectedGenres = new Set(draft.genres);
  const filterCount = countFilters(currentFilters);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const setPartial = (partial: Partial<AniListSearchParams>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  };

  const toggleGenre = (genre: string) => {
    setDraft((prev) => {
      const next = new Set(prev.genres);
      if (next.has(genre)) {
        next.delete(genre);
      } else {
        next.add(genre);
      }
      return { ...prev, genres: Array.from(next) };
    });
  };

  const clearFilters = () => {
    setDraft({
      medium: "ANIME",
      sort: "TRENDING_DESC",
      genres: [],
    });
  };

  const applyFilters = () => {
    router.replace(buildAniListUrl({ ...draft, mode: "results" }));
  };

  if (!isMounted) {
    return (
      <div
        className="h-10 w-32 animate-pulse rounded-md bg-muted"
        aria-hidden="true"
      />
    );
  }

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open) setDraft(currentFilters);
      }}
    >
      <SheetTrigger className={cn(buttonVariants({ variant: "outline" }))}>
        <SlidersHorizontal className="mr-2 size-4" />
        Filters
        {filterCount > 0 ? (
          <Badge className="ml-2 px-2 text-xs leading-none">
            {filterCount}
          </Badge>
        ) : null}
      </SheetTrigger>

      <SheetContent className="flex flex-col px-0">
        <SheetHeader>
          <div className="px-4 md:px-6">
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>
              Narrow down your anime results with the following filters.
            </SheetDescription>
          </div>
        </SheetHeader>

        <ScrollArea>
          <div className="space-y-8 px-4 md:px-6">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Search</Label>
              <Input
                value={draft.query ?? ""}
                placeholder="Title, creator, or keyword..."
                onChange={(event) =>
                  setPartial({ query: event.currentTarget.value })
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={draft.sort}
                onValueChange={(value) =>
                  setPartial({ sort: value as AniListSearchParams["sort"] })
                }
              >
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Sort</Label>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </div>
                <SelectContent>
                  {ANILIST_SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Genres</Label>
              <div className="flex flex-wrap gap-2">
                {ANILIST_GENRES.map((genre) => {
                  const isSelected = selectedGenres.has(genre);
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      aria-pressed={isSelected}
                      className={cn(
                        badgeVariants({
                          variant: isSelected ? "default" : "secondary",
                        }),
                        isSelected &&
                          "ring-2 ring-primary/60 ring-offset-2 ring-offset-background",
                      )}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={draft.format || EMPTY_SELECT_VALUE}
                onValueChange={(value) =>
                  setPartial({
                    format: value === EMPTY_SELECT_VALUE ? undefined : value,
                  })
                }
              >
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Format</Label>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </div>
                <SelectContent>
                  {ANILIST_FORMAT_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.label}
                      value={option.value || EMPTY_SELECT_VALUE}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={draft.status || EMPTY_SELECT_VALUE}
                onValueChange={(value) =>
                  setPartial({
                    status: value === EMPTY_SELECT_VALUE ? undefined : value,
                  })
                }
              >
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Status</Label>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </div>
                <SelectContent>
                  {ANILIST_STATUS_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.label}
                      value={option.value || EMPTY_SELECT_VALUE}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                value={draft.season || EMPTY_SELECT_VALUE}
                onValueChange={(value) =>
                  setPartial({
                    season: value === EMPTY_SELECT_VALUE ? undefined : value,
                  })
                }
              >
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Season</Label>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </div>
                <SelectContent>
                  {ANILIST_SEASON_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.label}
                      value={option.value || EMPTY_SELECT_VALUE}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Season Year</Label>
                <Input
                  value={draft.year ?? ""}
                  inputMode="numeric"
                  placeholder="2026"
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setPartial({
                      year: value ? Number.parseInt(value, 10) : undefined,
                    });
                  }}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="gap-2 px-4 md:gap-0 md:px-6">
          <Button size="lg" variant="outline" onClick={clearFilters}>
            Clear
          </Button>
          <SheetClose className={buttonVariants()} onClick={applyFilters}>
            Save Changes
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
