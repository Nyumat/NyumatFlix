"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { fetchSeasonDetails } from "@/components/tvshow/tvshow-api";
import {
  matchesEpisodeSearch,
  parseEpisodeSearchQuery,
} from "@/lib/parse-episode-search-query";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { buildEpisodeIndex, type IndexedEpisode } from "@/lib/tv-episode-index";
import { cn } from "@/lib/utils";
import { Episode, SeasonDetails, TvShowDetails } from "@/utils/typings";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownAZ, ArrowUpZA, Search, Tv } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

export type HeroTvEpisodePanelProps = {
  tvId: string;
  details: TvShowDetails;
  allSeasonDetails?: Record<number, SeasonDetails>;
};

export function HeroTvEpisodePanel({
  tvId,
  details,
  allSeasonDetails,
}: HeroTvEpisodePanelProps) {
  const isHydrated = useIsHydrated();
  const seasonNumbers = useMemo(
    () =>
      (details.seasons ?? [])
        .filter((s) => s.season_number > 0)
        .map((s) => s.season_number)
        .sort((a, b) => a - b),
    [details.seasons],
  );

  const {
    selectedEpisode,
    seasonNumber: storeSeason,
    tvShowId,
    setSelectedEpisode,
  } = useEpisodeStore();

  const [selectedSeason, setSelectedSeason] = useState<number>(() => {
    if (
      storeSeason &&
      seasonNumbers.length > 0 &&
      seasonNumbers.includes(storeSeason)
    ) {
      return storeSeason;
    }
    return seasonNumbers[0] ?? 1;
  });

  const [query, setQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loadedSeasonDetails, setLoadedSeasonDetails] = useState<
    Record<number, SeasonDetails>
  >(() => allSeasonDetails ?? {});

  const episodeIndex = useMemo(
    () => buildEpisodeIndex(loadedSeasonDetails),
    [loadedSeasonDetails],
  );

  const parsedQuery = useMemo(() => parseEpisodeSearchQuery(query), [query]);

  useEffect(() => {
    if (storeSeason && seasonNumbers.includes(storeSeason)) {
      setSelectedSeason(storeSeason);
    }
  }, [storeSeason, seasonNumbers]);

  const selectedSeasonQuery = useQuery({
    queryKey: [
      "nyumatflix",
      "media",
      "tv",
      Number(tvId),
      "season",
      selectedSeason,
    ],
    queryFn: () => fetchSeasonDetails(tvId, selectedSeason),
    enabled:
      isHydrated &&
      seasonNumbers.includes(selectedSeason) &&
      !loadedSeasonDetails[selectedSeason],
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    const seasonDetail = selectedSeasonQuery.data;
    if (!seasonDetail) return;
    setLoadedSeasonDetails((current) => ({
      ...current,
      [seasonDetail.season_number]: seasonDetail,
    }));
  }, [selectedSeasonQuery.data]);

  const seasonEpisodes = useMemo(() => {
    return loadedSeasonDetails[selectedSeason]?.episodes ?? [];
  }, [loadedSeasonDetails, selectedSeason]);

  const searchActive = query.trim().length > 0;

  const displayedList: IndexedEpisode[] = useMemo(() => {
    const source = !query.trim()
      ? seasonEpisodes.map((episode) => ({
          episode,
          seasonNumber: selectedSeason,
        }))
      : episodeIndex.filter(({ episode, seasonNumber }) => {
          const titleLower = (episode.name || "").toLowerCase();
          return matchesEpisodeSearch(
            episode,
            seasonNumber,
            titleLower,
            parsedQuery,
            query.trim(),
          );
        });

    return [...source].sort((a, b) => {
      const seasonDelta = a.seasonNumber - b.seasonNumber;
      const episodeDelta = a.episode.episode_number - b.episode.episode_number;
      const delta = seasonDelta || episodeDelta;
      return sortDirection === "asc" ? delta : -delta;
    });
  }, [
    episodeIndex,
    parsedQuery,
    query,
    seasonEpisodes,
    selectedSeason,
    sortDirection,
  ]);

  const handleEpisodeClick = useCallback(
    (episode: Episode, episodeSeason: number) => {
      setSelectedEpisode(episode, tvId, episodeSeason, undefined, false);
      setSelectedSeason(episodeSeason);
    },
    [setSelectedEpisode, tvId],
  );

  const isRowSelected = useCallback(
    (episode: Episode, episodeSeason: number) =>
      tvShowId === tvId &&
      storeSeason === episodeSeason &&
      selectedEpisode?.id === episode.id,
    [selectedEpisode?.id, storeSeason, tvId, tvShowId],
  );

  if (seasonNumbers.length === 0) {
    return null;
  }

  if (!isHydrated) {
    return (
      <div className="flex h-[min(680px,72vh)] w-full flex-col gap-5">
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="h-12 w-full rounded-lg border border-border/80 bg-card/50 sm:w-56" />
            <div className="h-12 min-w-0 flex-1 rounded-lg border border-border/80 bg-card/50" />
            <div className="h-12 w-12 shrink-0 rounded-lg border border-border/80 bg-card/50" />
          </div>
        </div>

        <div className="min-h-0 flex-1 pr-1">
          <div className="space-y-3 pb-1 pt-0.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 rounded-xl border border-border/70 bg-card/25"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-[min(680px,72vh)] w-full flex-col gap-5")}>
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={String(selectedSeason)}
            onValueChange={(value) => setSelectedSeason(Number(value))}
          >
            <SelectTrigger
              aria-label="Select season"
              className={cn(
                "h-12 w-full cursor-pointer rounded-lg border-border/80 bg-card/50 px-4 text-base shadow-none sm:w-56",
                "focus:ring-offset-background",
              )}
            >
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover/95">
              {seasonNumbers.map((num) => (
                <SelectItem key={num} value={String(num)}>
                  Season {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search episode..."
              aria-label="Search episodes across all seasons"
              suppressHydrationWarning
              className="h-12 rounded-lg border-border/80 bg-card/50 pl-9 text-base placeholder:text-muted-foreground/80"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              setSortDirection((current) =>
                current === "asc" ? "desc" : "asc",
              )
            }
            aria-label={
              sortDirection === "asc"
                ? "Sort newest episodes first"
                : "Sort oldest episodes first"
            }
            className="h-12 w-12 shrink-0 rounded-lg border border-border/80 bg-card/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {sortDirection === "asc" ? (
              <ArrowDownAZ className="h-5 w-5" aria-hidden />
            ) : (
              <ArrowUpZA className="h-5 w-5" aria-hidden />
            )}
          </Button>
        </div>
      </div>

      {searchActive ? (
        <p className="text-[11px] text-muted-foreground">
          Searching all seasons ({episodeIndex.length} episodes)
        </p>
      ) : null}

      <ScrollArea className="min-h-0 flex-1 pr-1">
        <div className="space-y-3 pb-1 pt-0.5">
          {selectedSeasonQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 rounded-xl border border-border/70 bg-card/25"
              />
            ))
          ) : displayedList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {!searchActive && seasonEpisodes.length === 0
                ? "No episodes for this season."
                : "No episodes match your search."}
            </p>
          ) : (
            displayedList.map(({ episode, seasonNumber: epSeason }) => {
              const active = isRowSelected(episode, epSeason);
              return (
                <button
                  key={`${epSeason}-${episode.id}`}
                  type="button"
                  onClick={() => handleEpisodeClick(episode, epSeason)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "group flex w-full gap-4 rounded-xl border p-3 text-left transition-colors sm:gap-5 sm:p-4",
                    "border-border/80 bg-card/35 hover:border-primary/35 hover:bg-card/70",
                    active &&
                      "border-primary/70 bg-primary/10 ring-1 ring-primary/25",
                  )}
                >
                  <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border sm:h-24 sm:w-44">
                    {episode.still_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
                        alt=""
                        width={300}
                        height={169}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Tv
                          className="size-5 text-muted-foreground"
                          aria-hidden
                        />
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 flex h-7 min-w-7 items-center justify-center rounded-md bg-background/85 px-2 text-sm font-semibold text-foreground ring-1 ring-border backdrop-blur">
                      {episode.episode_number}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 self-center">
                    {searchActive || epSeason !== selectedSeason ? (
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                        Season {epSeason}
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "line-clamp-2 text-base font-semibold leading-snug text-foreground sm:text-lg",
                        active && "text-primary",
                      )}
                    >
                      {episode.name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {episode.runtime ? (
                        <span>{episode.runtime} min</span>
                      ) : null}
                      {episode.air_date ? (
                        <span>
                          {new Date(episode.air_date).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            },
                          )}
                        </span>
                      ) : null}
                    </div>
                    {episode.overview ? (
                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                        {episode.overview}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
