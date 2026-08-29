"use client";

import { DiscoverFilters, DiscoverSort } from "@/components/discover/discover";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { languages } from "@/lib/languages";
import { useViewModeStore } from "@/lib/stores/view-mode-store";
import { cn, pluralize } from "@/lib/utils";
import type { Genre, WatchProvider } from "@/tmdb/models";
import { Grid2X2, List, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

type CatalogDiscoverToolbarProps = {
  mediaType: "movie" | "tv";
  genres: Genre[];
  providers: WatchProvider[];
  serverDiscoverFilters: Record<string, string>;
  resultCount: number;
};

const parseGenreIds = (value: string): number[] =>
  value
    .split(/[|,]/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => !Number.isNaN(n));

const formatResultsCount = (count: number, mediaType: "movie" | "tv") => {
  const label =
    mediaType === "movie"
      ? pluralize(count, "movie", "movies")
      : pluralize(count, "TV show", "TV shows");
  return `${count.toLocaleString()} ${label} found`;
};

type FilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

const MobileViewModeToggle = () => {
  const { viewMode, setViewMode } = useViewModeStore();

  return (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={(mode) => {
        if (mode === "grid" || mode === "list") setViewMode(mode);
      }}
      className="shrink-0 rounded-lg border border-border/70 bg-background/70 p-0.5 md:hidden"
      aria-label="Results view"
    >
      <ToggleGroupItem
        value="grid"
        className="size-11 p-0"
        aria-label="Grid view"
      >
        <Grid2X2 className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="list"
        className="size-11 p-0"
        aria-label="List view"
      >
        <List className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
};

export const CatalogDiscoverToolbar = ({
  mediaType,
  genres,
  providers,
  serverDiscoverFilters,
  resultCount,
}: CatalogDiscoverToolbarProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentGenreValue =
    searchParams.get("with_genres") ?? serverDiscoverFilters.with_genres ?? "";

  const selectedGenreIds = useMemo(
    () => parseGenreIds(currentGenreValue),
    [currentGenreValue],
  );
  const selectedGenres = useMemo(() => {
    const byId = new Map(genres.map((genre) => [Number(genre.id), genre]));
    return selectedGenreIds
      .map((id) => byId.get(id))
      .filter((genre): genre is Genre => Boolean(genre));
  }, [genres, selectedGenreIds]);

  const matchMode =
    currentGenreValue.includes(",") && !currentGenreValue.includes("|")
      ? "and"
      : "or";

  const replaceParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    router.replace(`?${next.toString()}`);
  };

  const updateGenres = (ids: number[], mode = matchMode) => {
    replaceParams((next) => {
      next.delete("page");
      if (ids.length > 0) {
        next.set("view", "discover");
        next.set("mode", "results");
        next.set("with_genres", ids.join(mode === "and" ? "," : "|"));
      } else {
        next.delete("with_genres");
      }
    });
  };

  const removeParamValue = (
    key: string,
    value: number,
    separator: "," | "|" = ",",
  ) => {
    replaceParams((next) => {
      const remaining = parseGenreIds(next.get(key) ?? "").filter(
        (id) => id !== value,
      );
      next.delete("page");
      if (remaining.length) {
        next.set(key, remaining.join(separator));
      } else {
        next.delete(key);
      }
    });
  };

  const removeParam = (...keys: string[]) => {
    replaceParams((next) => {
      next.delete("page");
      for (const key of keys) {
        next.delete(key);
      }
    });
  };

  const activeFilterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    const filters = new URLSearchParams(searchParams.toString());
    const providerIds = parseGenreIds(
      filters.get("with_watch_providers") ?? "",
    );
    const providerById = new Map(
      providers.map((provider) => [provider.provider_id, provider]),
    );
    const languageCode = filters.get("with_original_language")?.trim();
    const languageName = languages.find(
      (language) => language.iso_639_1 === languageCode,
    )?.english_name;
    const companyName = filters.get("company_name")?.trim();
    const networkName = filters.get("network_name")?.trim();
    const companies = parseGenreIds(filters.get("with_companies") ?? "");
    const networks = parseGenreIds(filters.get("with_networks") ?? "");
    const dateFromKey =
      mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
    const dateToKey =
      mediaType === "movie" ? "primary_release_date.lte" : "first_air_date.lte";

    for (const genre of selectedGenres) {
      chips.push({
        id: `genre-${genre.id}`,
        label: genre.name,
        onRemove: () =>
          updateGenres(
            selectedGenreIds.filter((id) => id !== Number(genre.id)),
          ),
      });
    }

    for (const providerId of providerIds) {
      const provider = providerById.get(providerId);
      chips.push({
        id: `provider-${providerId}`,
        label: provider?.provider_name ?? `Provider ${providerId}`,
        onRemove: () =>
          removeParamValue("with_watch_providers", providerId, "|"),
      });
    }

    if (languageCode) {
      chips.push({
        id: "language",
        label: languageName ? `Language: ${languageName}` : languageCode,
        onRemove: () => removeParam("with_original_language"),
      });
    }

    const fromDate = filters.get(dateFromKey)?.trim();
    if (fromDate) {
      chips.push({
        id: "date-from",
        label: `From: ${fromDate}`,
        onRemove: () => removeParam(dateFromKey),
      });
    }

    const toDate = filters.get(dateToKey)?.trim();
    if (toDate) {
      chips.push({
        id: "date-to",
        label: `To: ${toDate}`,
        onRemove: () => removeParam(dateToKey),
      });
    }

    const rating = filters.get("vote_average.gte")?.trim();
    if (rating && rating !== "0") {
      chips.push({
        id: "rating",
        label: `Rating: ${rating}+`,
        onRemove: () => removeParam("vote_average.gte"),
      });
    }

    const votes = filters.get("vote_count.gte")?.trim();
    if (votes && votes !== "0") {
      chips.push({
        id: "votes",
        label: `Votes: ${votes}+`,
        onRemove: () => removeParam("vote_count.gte"),
      });
    }

    if (companies.length) {
      chips.push({
        id: "companies",
        label:
          companyName && companies.length === 1
            ? `Studio: ${companyName}`
            : `Studios: ${companies.length}`,
        onRemove: () => removeParam("with_companies", "company_name"),
      });
    }

    if (networks.length) {
      chips.push({
        id: "networks",
        label:
          networkName && networks.length === 1
            ? `Network: ${networkName}`
            : `Networks: ${networks.length}`,
        onRemove: () => removeParam("with_networks", "network_name"),
      });
    }

    return chips;
  }, [mediaType, providers, searchParams, selectedGenreIds, selectedGenres]);

  const clearAllFilters = () => {
    replaceParams((next) => {
      next.delete("page");
      next.delete("with_genres");
      next.delete("with_original_language");
      next.delete("with_watch_providers");
      next.delete("with_companies");
      next.delete("company_name");
      next.delete("with_networks");
      next.delete("network_name");
      next.delete("primary_release_date.gte");
      next.delete("primary_release_date.lte");
      next.delete("first_air_date.gte");
      next.delete("first_air_date.lte");
      next.delete("vote_average.gte");
      next.delete("vote_average.lte");
      next.delete("vote_count.gte");
      next.delete("vote_count.lte");
    });
  };

  const handleMatchModeChange = (nextMode: string) => {
    if (nextMode !== "or" && nextMode !== "and") return;
    updateGenres(selectedGenreIds, nextMode);
  };

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex items-center gap-2 md:flex-wrap md:justify-between">
        <div className="min-w-0 flex-1 md:flex md:flex-wrap md:items-center md:gap-2">
          <DiscoverFilters
            type={mediaType}
            genres={genres}
            providers={providers}
            serverDiscoverFilters={serverDiscoverFilters}
            triggerClassName="h-11 w-full px-3 md:h-9 md:w-auto md:px-4"
          />
          <p className="hidden text-sm text-foreground/70 md:block">
            {formatResultsCount(resultCount, mediaType)}
          </p>
        </div>
        <DiscoverSort
          type={mediaType}
          compactOnMobile
          triggerClassName="h-11 shrink-0 px-3 md:h-9 md:px-4"
        />
        <MobileViewModeToggle />
      </div>

      <p className="text-sm font-medium text-foreground/75 md:hidden">
        {formatResultsCount(resultCount, mediaType)}
      </p>

      {activeFilterChips.length > 0 ? (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
          <span className="hidden text-sm text-foreground/70 md:inline">
            Filtered by:
          </span>
          {activeFilterChips.map((chip) => (
            <Button
              key={chip.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={chip.onRemove}
              className="h-9 shrink-0 gap-1.5 rounded-full px-3 text-xs md:h-8"
              aria-label={`Remove ${chip.label} filter`}
            >
              {chip.label}
              <X className="size-3.5" aria-hidden="true" />
            </Button>
          ))}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-9 shrink-0 rounded-full px-3 text-xs md:h-8"
          >
            Clear all
          </Button>

          {selectedGenreIds.length > 1 ? (
            <div className="ml-0 hidden items-center gap-2 text-xs text-foreground/70 md:flex md:ml-2">
              <span>Match</span>
              <ToggleGroup
                type="single"
                value={matchMode}
                onValueChange={handleMatchModeChange}
                className={cn(
                  "h-8 rounded-md border border-border/70 bg-background/50 p-0.5",
                )}
              >
                <ToggleGroupItem value="or" className="h-7 px-2 text-xs">
                  Any
                </ToggleGroupItem>
                <ToggleGroupItem value="and" className="h-7 px-2 text-xs">
                  All
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
