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
import {
  matchesEpisodeSearch,
  parseEpisodeSearchQuery,
} from "@/lib/parse-episode-search-query";
import { buildEpisodeIndex, type IndexedEpisode } from "@/lib/tv-episode-index";
import { cn } from "@/lib/utils";
import { Episode, SeasonDetails, TvShowDetails } from "@/utils/typings";
import { ChevronLeft, ChevronRight, Search, Tv } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

export type HeroTvEpisodePanelProps = {
  tvId: string;
  details: TvShowDetails;
  allSeasonDetails: Record<number, SeasonDetails>;
};

export function HeroTvEpisodePanel({
  tvId,
  details,
  allSeasonDetails,
}: HeroTvEpisodePanelProps) {
  const seasonNumbers = useMemo(
    () =>
      (details.seasons ?? [])
        .filter((s) => s.season_number > 0)
        .map((s) => s.season_number)
        .sort((a, b) => a - b),
    [details.seasons],
  );

  const episodeIndex = useMemo(
    () => buildEpisodeIndex(allSeasonDetails),
    [allSeasonDetails],
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

  const parsedQuery = useMemo(() => parseEpisodeSearchQuery(query), [query]);

  useEffect(() => {
    if (storeSeason && seasonNumbers.includes(storeSeason)) {
      setSelectedSeason(storeSeason);
    }
  }, [storeSeason, seasonNumbers]);

  const seasonIndex = seasonNumbers.indexOf(selectedSeason);
  const canPrev = seasonIndex > 0;
  const canNext = seasonIndex >= 0 && seasonIndex < seasonNumbers.length - 1;

  const handlePrev = useCallback(() => {
    if (!canPrev) return;
    setSelectedSeason(seasonNumbers[seasonIndex - 1]!);
  }, [canPrev, seasonIndex, seasonNumbers]);

  const handleNext = useCallback(() => {
    if (!canNext) return;
    setSelectedSeason(seasonNumbers[seasonIndex + 1]!);
  }, [canNext, seasonIndex, seasonNumbers]);

  const seasonEpisodes = useMemo(() => {
    return allSeasonDetails[selectedSeason]?.episodes ?? [];
  }, [allSeasonDetails, selectedSeason]);

  const searchActive = query.trim().length > 0;

  const displayedList: IndexedEpisode[] = useMemo(() => {
    if (!query.trim()) {
      return seasonEpisodes.map((episode) => ({
        episode,
        seasonNumber: selectedSeason,
      }));
    }
    return episodeIndex.filter(({ episode, seasonNumber }) => {
      const titleLower = (episode.name || "").toLowerCase();
      return matchesEpisodeSearch(
        episode,
        seasonNumber,
        titleLower,
        parsedQuery,
        query.trim(),
      );
    });
  }, [episodeIndex, parsedQuery, query, seasonEpisodes, selectedSeason]);

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

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-xl border border-white/15 bg-black/45 p-3 shadow-2xl backdrop-blur-xl sm:gap-3 sm:p-4",
        "h-[min(420px,50vh)] ring-1 ring-white/5 lg:h-[min(520px,calc(75vh-9rem))]",
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Episodes
      </p>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canPrev}
          onClick={handlePrev}
          aria-label="Previous season"
          className="h-9 shrink-0 border border-white/10 bg-white/6 px-2 text-foreground hover:bg-white/10 dark:border-white/15"
        >
          <ChevronLeft className="h-4 w-4 sm:mr-0.5" aria-hidden />
          <span className="hidden text-xs sm:inline">Prev</span>
        </Button>
        <div className="relative min-w-0 flex-1">
          <Select
            value={String(selectedSeason)}
            onValueChange={(value) => setSelectedSeason(Number(value))}
          >
            <SelectTrigger
              aria-label="Select season"
              className={cn(
                "h-9 w-full cursor-pointer rounded-md border border-white/15 bg-white/8 py-2 shadow-none dark:border-white/20 dark:bg-white/8",
                "focus:ring-offset-background",
              )}
            >
              <SelectValue placeholder="Season" />
            </SelectTrigger>
            <SelectContent className="border-white/15 bg-popover/95 dark:border-white/20">
              {seasonNumbers.map((num) => (
                <SelectItem key={num} value={String(num)}>
                  Season {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!canNext}
          onClick={handleNext}
          aria-label="Next season"
          className="h-9 shrink-0 border border-white/10 bg-white/6 px-2 text-foreground hover:bg-white/10 dark:border-white/15"
        >
          <span className="hidden text-xs sm:inline">Next</span>
          <ChevronRight className="h-4 w-4 sm:ml-0.5" aria-hidden />
        </Button>
      </div>

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all episodes"
          aria-label="Search episodes across all seasons"
          suppressHydrationWarning
          className="h-10 rounded-full border-white/20 bg-white/6 pl-9 text-sm placeholder:text-muted-foreground/80 dark:border-white/15 dark:bg-white/6"
        />
      </div>

      {searchActive ? (
        <p className="text-[11px] text-muted-foreground">
          Searching all seasons ({episodeIndex.length} episodes)
        </p>
      ) : null}

      <ScrollArea className="min-h-0 flex-1 pr-1">
        <div className="space-y-2 pb-1 pt-0.5">
          {displayedList.length === 0 ? (
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
                    "flex w-full gap-3 rounded-lg border p-2 text-left transition-colors",
                    "border-transparent bg-white/4 hover:border-white/15 hover:bg-white/[0.07]",
                    active &&
                      "border-primary/50 bg-primary/15 ring-1 ring-primary/30",
                  )}
                >
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md bg-muted ring-1 ring-white/10 sm:h-16 sm:w-28">
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
                  </div>
                  <div className="min-w-0 flex-1">
                    {searchActive || epSeason !== selectedSeason ? (
                      <p className="text-[10px] font-medium uppercase tracking-wide text-primary/90">
                        Season {epSeason}
                      </p>
                    ) : null}
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                      {episode.episode_number}. {episode.name}
                    </p>
                    {episode.air_date ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(episode.air_date).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
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
