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
import { fetchSeasonDetails } from "@/components/tvshow/tvshow-api";
import { useTvDetailCatalog } from "@/hooks/use-tv-detail-catalog";
import {
  fromAnilistTvRouteId,
  parseAnimeAnilistRouteId,
} from "@/lib/anilist-route-id";
import { isAnilistBackedTvRouteId } from "@/lib/tv-detail-catalog";
import {
  episodeListPresentation,
  findSegmentForEpisode,
  formatCourSelectLabel,
  toAnimeDisplayCoords,
  type MappingSegment,
} from "@/lib/anime/tmdb-anilist-map";
import { readMappedTmdbTvIdFromMedia } from "@/lib/tv-playback-tmdb-id";
import { normalizeTvContentKey } from "@/lib/tv-watch-target";
import { resolveEpisodeThumbnailUrl } from "@/lib/anime/episode-thumbnail-url";
import { resolveEpisodeAnimeSelection } from "@/lib/anime/episode-playback-source";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useEmbedServerStore } from "@/lib/stores/embed-server-store";
import { stripSearchParam } from "@/lib/navigation/search-params";
import { slugifyHentainiTitle } from "@/lib/scrape/anime/hentaini-slug";
import {
  matchesEpisodeSearch,
  parseEpisodeSearchQuery,
} from "@/lib/parse-episode-search-query";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { useLocalTvWatchCoords } from "@/hooks/use-local-tv-watch-coords";
import { TvEpisodesPanelSkeleton } from "@/components/tvshow/tv-detail-bootstrap-context";
import { queryStaleTime } from "@/lib/cache-policy";
import { fetchTvAllSeasonsClient } from "@/lib/media-detail-tab-client";
import { buildEpisodeIndex, type IndexedEpisode } from "@/lib/tv-episode-index";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { Episode, SeasonDetails, TvShowDetails } from "@/lib/domain/typings";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { ArrowDownAZ, ArrowUpZA, Search, Tv } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { tmdbImage } from "@/tmdb/utils";

export type HeroTvEpisodePanelProps = {
  tvId: string;
  details: TvShowDetails;
  allSeasonDetails?: Record<number, SeasonDetails>;
};

type AnimeSeasonMap = {
  segments?: MappingSegment[];
  isAdult?: boolean;
};

type KitsuThumbnailRequest =
  | {
      kind: "tmdb";
      seasonNumber: number;
      sourceAnilistId: number;
      tmdbSeasonCount: number;
    }
  | { kind: "anilist"; anilistId: number };

const seasonHasLoadedEpisodes = (
  seasons: Record<number, SeasonDetails>,
  seasonNumber: number,
): boolean => (seasons[seasonNumber]?.episodes?.length ?? 0) > 0;

const fetchKitsuEpisodeThumbnails = async (
  tvId: string,
  request: KitsuThumbnailRequest,
): Promise<Record<number, string>> => {
  const params = new URLSearchParams(
    request.kind === "anilist"
      ? { anilistId: String(request.anilistId) }
      : {
          tmdbShowId: tvId,
          seasonNumber: String(request.seasonNumber),
          sourceAnilistId: String(request.sourceAnilistId),
          tmdbSeasonCount: String(request.tmdbSeasonCount),
        },
  );

  const response = await fetch(`/api/anime/episode-thumbnails?${params}`);
  if (!response.ok) {
    return {};
  }

  const payload = (await response.json()) as {
    thumbnails?: Record<string, string>;
  };
  const thumbnails: Record<number, string> = {};

  for (const [key, value] of Object.entries(payload.thumbnails ?? {})) {
    const episodeNumber = Number(key);
    if (Number.isInteger(episodeNumber) && episodeNumber > 0 && value) {
      thumbnails[episodeNumber] = value;
    }
  }

  return thumbnails;
};

export function HeroTvEpisodePanel({
  tvId,
  details,
  allSeasonDetails,
}: HeroTvEpisodePanelProps) {
  const isHydrated = useIsHydrated();
  const queryClient = useQueryClient();
  const catalog = useTvDetailCatalog();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const consumedSeasonParamRef = useRef(false);
  const isAnilistRoute = isAnilistBackedTvRouteId(tvId, catalog);
  const routeAnilistId = isAnilistRoute
    ? (parseAnimeAnilistRouteId(tvId) ?? fromAnilistTvRouteId(tvId))
    : null;
  const mappedTmdbTvId = readMappedTmdbTvIdFromMedia(details);
  const seasonNumbers = useMemo(() => {
    const fromDetails = (details.seasons ?? [])
      .filter((season) => season.season_number > 0)
      .map((season) => season.season_number)
      .sort((left, right) => left - right);

    const declaredCount = details.number_of_seasons ?? 0;
    if (
      isAnilistRoute &&
      mappedTmdbTvId &&
      declaredCount > fromDetails.length &&
      declaredCount > 1
    ) {
      return Array.from({ length: declaredCount }, (_, index) => index + 1);
    }

    return fromDetails.length > 0 ? fromDetails : [1];
  }, [
    details.number_of_seasons,
    details.seasons,
    isAnilistRoute,
    mappedTmdbTvId,
  ]);

  const {
    selectedEpisode,
    seasonNumber: storeSeason,
    tvShowId,
    defaultAnilistId,
    defaultIsAdultAnime,
    setSelectedEpisode,
    setDefaultAnilistId,
    setSeasonNumber,
  } = useEpisodeStore();
  const requestedSeason = Number.parseInt(searchParams.get("season") ?? "", 10);
  const localCoords = useLocalTvWatchCoords(details.id);

  const selectedSeason = useMemo(() => {
    const storeMatchesRoute =
      normalizeTvContentKey(tvShowId ?? "") === normalizeTvContentKey(tvId);

    if (
      storeMatchesRoute &&
      storeSeason &&
      seasonNumbers.includes(storeSeason)
    ) {
      return storeSeason;
    }

    if (
      Number.isInteger(requestedSeason) &&
      requestedSeason > 0 &&
      seasonNumbers.includes(requestedSeason)
    ) {
      return requestedSeason;
    }

    if (localCoords && seasonNumbers.includes(localCoords.seasonNumber)) {
      return localCoords.seasonNumber;
    }

    return seasonNumbers[0] ?? 1;
  }, [
    localCoords,
    requestedSeason,
    seasonNumbers,
    storeSeason,
    tvId,
    tvShowId,
  ]);
  const [selectedAnimeSegment, setSelectedAnimeSegment] = useState(0);

  const [query, setQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loadedSeasonDetails, setLoadedSeasonDetails] = useState<
    Record<number, SeasonDetails>
  >(() => allSeasonDetails ?? {});

  const episodeIndex = useMemo(
    () => buildEpisodeIndex(loadedSeasonDetails),
    [loadedSeasonDetails],
  );

  useEffect(() => {
    if (!allSeasonDetails) return;
    setLoadedSeasonDetails((current) => {
      const merged: Record<number, SeasonDetails> = {
        ...allSeasonDetails,
        ...current,
      };
      for (const [key, season] of Object.entries(allSeasonDetails)) {
        const seasonNumber = Number(key);
        if (!Number.isInteger(seasonNumber) || seasonNumber <= 0) continue;
        const existing = merged[seasonNumber];
        if (
          (existing?.episodes?.length ?? 0) < (season.episodes?.length ?? 0)
        ) {
          merged[seasonNumber] = season;
        }
      }
      return merged;
    });
  }, [allSeasonDetails]);

  const parsedQuery = useMemo(() => parseEpisodeSearchQuery(query), [query]);

  useEffect(() => {
    if (!isHydrated || consumedSeasonParamRef.current) {
      return;
    }

    consumedSeasonParamRef.current = true;

    if (
      Number.isInteger(requestedSeason) &&
      requestedSeason > 0 &&
      seasonNumbers.includes(requestedSeason)
    ) {
      setSeasonNumber(tvId, requestedSeason);
    }

    if (!searchParams.has("season")) {
      return;
    }

    router.replace(stripSearchParam(pathname, searchParams, "season"), {
      scroll: false,
    });
  }, [
    isHydrated,
    pathname,
    requestedSeason,
    router,
    searchParams,
    seasonNumbers,
    setSeasonNumber,
    tvId,
  ]);

  useEffect(() => {
    if (!isAnilistRoute || routeAnilistId === null) return;

    setDefaultAnilistId(routeAnilistId, details.adult === true);
    useEmbedServerStore
      .getState()
      .setAnimeTitleSlug(
        slugifyHentainiTitle(details.original_name ?? details.name),
      );
  }, [
    details.adult,
    details.name,
    details.original_name,
    isAnilistRoute,
    routeAnilistId,
    setDefaultAnilistId,
  ]);

  const selectedSeasonHasEpisodes = seasonHasLoadedEpisodes(
    loadedSeasonDetails,
    selectedSeason,
  );

  const selectedSeasonQuery = useQuery({
    queryKey: queryKeys.tvSeasonRoute(tvId, selectedSeason),
    queryFn: async () => {
      const seasonDetail = await fetchSeasonDetails(tvId, selectedSeason);
      if (!seasonDetail?.episodes?.length) {
        throw new Error(`Season ${selectedSeason} has no episodes`);
      }
      return seasonDetail;
    },
    enabled:
      isHydrated &&
      seasonNumbers.includes(selectedSeason) &&
      !selectedSeasonHasEpisodes,
    staleTime: queryStaleTime(60 * 60 * 1000),
    retry: 2,
  });

  const animeMapTmdbShowId =
    typeof mappedTmdbTvId === "number" && mappedTmdbTvId > 0
      ? mappedTmdbTvId
      : isAnilistRoute
        ? null
        : Number(tvId);
  const canMapAnimeSeason =
    Number.isInteger(defaultAnilistId) &&
    typeof animeMapTmdbShowId === "number" &&
    Number.isInteger(animeMapTmdbShowId) &&
    animeMapTmdbShowId > 0;

  const animeSeasonMapQuery = useQuery({
    queryKey: queryKeys.animeSeasonMap(
      animeMapTmdbShowId ?? 0,
      selectedSeason,
      defaultAnilistId ?? 0,
    ),
    queryFn: async (): Promise<AnimeSeasonMap> => {
      const response = await fetch(
        `/api/map?tmdbShowId=${encodeURIComponent(String(animeMapTmdbShowId))}&tmdbSeason=${selectedSeason}&sourceAnilistId=${defaultAnilistId}`,
      );
      if (!response.ok) {
        throw new Error("anime season map failed");
      }
      return response.json() as Promise<AnimeSeasonMap>;
    },
    enabled: isHydrated && canMapAnimeSeason,
    staleTime: queryStaleTime(60 * 60 * 1000),
  });

  const animeSegments = animeSeasonMapQuery.data?.segments ?? [];
  const listPresentation = episodeListPresentation({
    tmdbSeasonCount: seasonNumbers.length,
    segmentCount: animeSegments.length,
  });
  const { splitCour, showTmdbSeasonSelect, showCourSelect } = listPresentation;

  useEffect(() => {
    setSelectedAnimeSegment(0);
  }, [selectedSeason, animeSegments.length]);

  useEffect(() => {
    if (!splitCour || !selectedEpisode || animeSegments.length === 0) {
      return;
    }

    const segmentIndex = animeSegments.findIndex(
      (segment) =>
        selectedEpisode.episode_number >= segment.startEpisode &&
        selectedEpisode.episode_number <= segment.endEpisode,
    );
    if (segmentIndex >= 0) {
      setSelectedAnimeSegment(segmentIndex);
    }
    // Only re-sync when the selected episode changes or segments first arrive —
    // not when the user manually browses another anime season group.
  }, [animeSegments, selectedEpisode?.id, splitCour]);

  useEffect(() => {
    const seasonDetail = selectedSeasonQuery.data;
    if (!seasonDetail) return;
    setLoadedSeasonDetails((current) => ({
      ...current,
      [seasonDetail.season_number]: seasonDetail,
    }));
  }, [selectedSeasonQuery.data]);

  const seasonEpisodes = useMemo(() => {
    const episodes = loadedSeasonDetails[selectedSeason]?.episodes ?? [];
    if (!splitCour) return episodes;
    const segment = animeSegments[selectedAnimeSegment];
    if (!segment) return episodes;

    const maxSegmentEnd = Math.max(
      ...animeSegments.map((entry) => entry.endEpisode),
      0,
    );
    const lastSegmentIndex = animeSegments.length - 1;

    const filtered = episodes.filter(
      (episode) =>
        episode.episode_number >= segment.startEpisode &&
        episode.episode_number <= segment.endEpisode,
    );

    if (selectedAnimeSegment !== lastSegmentIndex) {
      return filtered.length > 0 ? filtered : episodes;
    }

    const trailingAppendix = episodes.filter(
      (episode) => episode.episode_number > maxSegmentEnd,
    );
    if (trailingAppendix.length === 0) {
      return filtered.length > 0 ? filtered : episodes;
    }

    const seen = new Set(filtered.map((episode) => episode.id));
    return [
      ...filtered,
      ...trailingAppendix.filter((episode) => !seen.has(episode.id)),
    ];
  }, [
    animeSegments,
    loadedSeasonDetails,
    selectedAnimeSegment,
    selectedSeason,
    splitCour,
  ]);

  const searchActive = query.trim().length > 0;
  const isAnimeTmdbPage = !isAnilistRoute && Number.isInteger(defaultAnilistId);
  const tmdbSeasonCount = seasonNumbers.length;

  const allSeasonsForSearchQuery = useQuery({
    queryKey: queryKeys.tvAllSeasons(tvId),
    queryFn: () => fetchTvAllSeasonsClient(tvId, catalog),
    enabled: isHydrated && searchActive,
    staleTime: queryStaleTime(60 * 60 * 1000),
  });

  useEffect(() => {
    const searchedSeasons = allSeasonsForSearchQuery.data;
    if (!searchedSeasons) return;
    setLoadedSeasonDetails((current) => {
      const merged: Record<number, SeasonDetails> = { ...current };
      for (const [key, season] of Object.entries(searchedSeasons)) {
        const seasonNumber = Number(key);
        if (!Number.isInteger(seasonNumber) || seasonNumber <= 0) continue;
        const existing = merged[seasonNumber];
        if (
          (existing?.episodes?.length ?? 0) < (season.episodes?.length ?? 0)
        ) {
          merged[seasonNumber] = season;
        }
      }
      return merged;
    });
  }, [allSeasonsForSearchQuery.data]);

  useEffect(() => {
    if (!isHydrated || !selectedSeasonHasEpisodes || searchActive) {
      return;
    }

    const unloadedSeasons = seasonNumbers.filter(
      (seasonNumber) =>
        !seasonHasLoadedEpisodes(loadedSeasonDetails, seasonNumber),
    );
    if (unloadedSeasons.length === 0) {
      return;
    }

    const selectedIndex = seasonNumbers.indexOf(selectedSeason);
    const prefetchOrder = [
      seasonNumbers[selectedIndex + 1],
      seasonNumbers[selectedIndex - 1],
      ...unloadedSeasons,
    ].filter(
      (seasonNumber): seasonNumber is number =>
        Number.isInteger(seasonNumber) &&
        seasonNumber > 0 &&
        seasonNumber !== selectedSeason &&
        !seasonHasLoadedEpisodes(loadedSeasonDetails, seasonNumber),
    );

    const nextSeason = prefetchOrder[0];
    if (!nextSeason) {
      return;
    }

    void queryClient.prefetchQuery({
      queryKey: queryKeys.tvSeasonRoute(tvId, nextSeason),
      queryFn: () => fetchSeasonDetails(tvId, nextSeason),
      staleTime: queryStaleTime(60 * 60 * 1000),
    });
  }, [
    isHydrated,
    loadedSeasonDetails,
    queryClient,
    searchActive,
    seasonNumbers,
    selectedSeason,
    selectedSeasonHasEpisodes,
    tvId,
  ]);

  const kitsuThumbnailRequests = useMemo((): KitsuThumbnailRequest[] => {
    if (splitCour) {
      return animeSegments.map((segment) => ({
        kind: "anilist" as const,
        anilistId: segment.anilistMediaId,
      }));
    }

    if (isAnilistRoute && routeAnilistId !== null) {
      return [
        {
          kind: "anilist" as const,
          anilistId: routeAnilistId,
        },
      ];
    }

    if (
      !isAnimeTmdbPage ||
      defaultAnilistId === null ||
      !Number.isInteger(defaultAnilistId)
    ) {
      return [];
    }

    const sourceAnilistId = defaultAnilistId;

    const seasonNumbersToFetch = new Set<number>([selectedSeason]);
    if (searchActive) {
      for (const season of Object.keys(loadedSeasonDetails)) {
        const parsed = Number(season);
        if (Number.isInteger(parsed) && parsed > 0) {
          seasonNumbersToFetch.add(parsed);
        }
      }
    }

    return [...seasonNumbersToFetch].map((seasonNumber) => ({
      kind: "tmdb" as const,
      seasonNumber,
      sourceAnilistId,
      tmdbSeasonCount,
    }));
  }, [
    animeSegments,
    defaultAnilistId,
    isAnimeTmdbPage,
    loadedSeasonDetails,
    searchActive,
    selectedSeason,
    tmdbSeasonCount,
    splitCour,
    isAnilistRoute,
    routeAnilistId,
    tvId,
  ]);

  const kitsuThumbnailsEnabled =
    isHydrated && (isAnimeTmdbPage || isAnilistRoute);

  const kitsuThumbnailQueries = useQueries({
    queries: kitsuThumbnailRequests.map((request) => ({
      queryKey:
        request.kind === "anilist"
          ? ["kitsu-episode-thumbnails", "anilist", request.anilistId]
          : [
              "kitsu-episode-thumbnails",
              "tmdb",
              tvId,
              request.seasonNumber,
              request.sourceAnilistId,
              request.tmdbSeasonCount,
            ],
      queryFn: () => fetchKitsuEpisodeThumbnails(tvId, request),
      enabled: kitsuThumbnailsEnabled,
      staleTime: queryStaleTime(24 * 60 * 60 * 1000),
    })),
  });

  const kitsuThumbnailsBySeason = useMemo(() => {
    const map: Record<number, Record<number, string>> = {};
    for (const [index, request] of kitsuThumbnailRequests.entries()) {
      if (request.kind !== "tmdb") continue;
      const data = kitsuThumbnailQueries[index]?.data;
      if (data) {
        map[request.seasonNumber] = data;
      }
    }
    return map;
  }, [kitsuThumbnailQueries, kitsuThumbnailRequests]);

  const kitsuThumbnailsByAnilist = useMemo(() => {
    const map: Record<number, Record<number, string>> = {};
    for (const [index, request] of kitsuThumbnailRequests.entries()) {
      if (request.kind !== "anilist") continue;
      const data = kitsuThumbnailQueries[index]?.data;
      if (data) {
        map[request.anilistId] = data;
      }
    }
    return map;
  }, [kitsuThumbnailQueries, kitsuThumbnailRequests]);

  const resolveKitsuThumbnail = useCallback(
    (episode: Episode, seasonNumber: number) => {
      if (splitCour && seasonNumber === selectedSeason) {
        const segment = findSegmentForEpisode(
          animeSegments,
          episode.episode_number,
        );
        if (!segment) return null;
        const relativeEpisode =
          episode.episode_number - segment.startEpisode + 1;
        return (
          kitsuThumbnailsByAnilist[segment.anilistMediaId]?.[relativeEpisode] ??
          null
        );
      }

      if (isAnilistRoute && routeAnilistId !== null) {
        return (
          kitsuThumbnailsByAnilist[routeAnilistId]?.[episode.episode_number] ??
          null
        );
      }

      return (
        kitsuThumbnailsBySeason[seasonNumber]?.[episode.episode_number] ?? null
      );
    },
    [
      animeSegments,
      isAnilistRoute,
      kitsuThumbnailsByAnilist,
      kitsuThumbnailsBySeason,
      routeAnilistId,
      selectedSeason,
      splitCour,
    ],
  );

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
      const seasonEpisodes =
        loadedSeasonDetails[episodeSeason]?.episodes ??
        allSeasonDetails?.[episodeSeason]?.episodes;

      const segment =
        episodeSeason === selectedSeason
          ? findSegmentForEpisode(animeSegments, episode.episode_number)
          : null;
      const animeDisplay = segment
        ? toAnimeDisplayCoords(animeSegments, episode.episode_number)
        : null;
      const anilistRouteId = routeAnilistId;
      const embeddedSelection = resolveEpisodeAnimeSelection(episode, {
        animeSeasonNumber: anilistRouteId ? episodeSeason : null,
        isAdult:
          animeSeasonMapQuery.data?.isAdult === true ||
          defaultIsAdultAnime ||
          details.adult === true,
      });
      const animeInfo = segment
        ? {
            anilistId: segment.anilistMediaId,
            startEpisode: segment.startEpisode,
            endEpisode: segment.endEpisode,
          }
        : embeddedSelection?.animeInfo;
      const animeSeasonNumber = animeDisplay
        ? animeDisplay.seasonNumber
        : (embeddedSelection?.mapping.animeSeasonNumber ??
          (anilistRouteId ? episodeSeason : null));

      const mapIsAdult = animeSeasonMapQuery.data?.isAdult === true;
      setSelectedEpisode(
        episode,
        tvId,
        episodeSeason,
        animeInfo,
        false,
        seasonEpisodes,
        segment
          ? {
              confidence: "high",
              isAdult:
                mapIsAdult || defaultIsAdultAnime || details.adult === true,
              animeSeasonNumber,
              relativeEpisodeNumber: animeDisplay?.episodeNumber,
            }
          : (embeddedSelection?.mapping ??
              (anilistRouteId
                ? {
                    confidence: "low",
                    isAdult:
                      mapIsAdult ||
                      defaultIsAdultAnime ||
                      details.adult === true,
                    animeSeasonNumber,
                  }
                : undefined)),
      );
    },
    [
      allSeasonDetails,
      animeSeasonMapQuery.data?.isAdult,
      animeSegments,
      defaultIsAdultAnime,
      details.adult,
      loadedSeasonDetails,
      routeAnilistId,
      selectedSeason,
      setSelectedEpisode,
      tvId,
    ],
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
    return <TvEpisodesPanelSkeleton />;
  }

  return (
    <div className={cn("flex h-[min(680px,72vh)] w-full flex-col gap-5")}>
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {showTmdbSeasonSelect ? (
            <Select
              value={String(selectedSeason)}
              onValueChange={(value) => {
                setSeasonNumber(tvId, Number(value));
                if (searchParams.has("season")) {
                  router.replace(
                    stripSearchParam(pathname, searchParams, "season"),
                    {
                      scroll: false,
                    },
                  );
                }
              }}
            >
              <SelectTrigger
                aria-label="Select season"
                className={cn(
                  "h-12 w-full cursor-pointer rounded-lg border-border/80 bg-card/50 px-4 text-base shadow-none",
                  showCourSelect ? "sm:w-40" : "sm:w-56",
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
          ) : null}

          {showCourSelect ? (
            <Select
              value={`anime-${selectedAnimeSegment}`}
              onValueChange={(value) => {
                setSelectedAnimeSegment(Number(value.slice(6)));
              }}
            >
              <SelectTrigger
                aria-label={
                  showTmdbSeasonSelect ? "Select part" : "Select season"
                }
                className={cn(
                  "h-12 w-full cursor-pointer rounded-lg border-border/80 bg-card/50 px-4 text-base shadow-none",
                  showTmdbSeasonSelect ? "sm:w-48" : "sm:w-56",
                  "focus:ring-offset-background",
                )}
              >
                <SelectValue placeholder="Part" />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover/95">
                {animeSegments.map((segment, index) => (
                  <SelectItem
                    key={segment.anilistMediaId}
                    value={`anime-${index}`}
                  >
                    {formatCourSelectLabel(segment, index, {
                      besideTmdbSeasons: showTmdbSeasonSelect,
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

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
          {selectedSeasonQuery.isPending || selectedSeasonQuery.isFetching ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 rounded-xl border border-border/70 bg-card/25"
              />
            ))
          ) : displayedList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {!searchActive && seasonEpisodes.length === 0
                ? selectedSeasonQuery.isError
                  ? "Couldn't load episodes for this season. Try again."
                  : "No episodes for this season."
                : "No episodes match your search."}
            </p>
          ) : (
            displayedList.map(({ episode, seasonNumber: epSeason }) => {
              const active = isRowSelected(episode, epSeason);
              const animeDisplay =
                splitCour && epSeason === selectedSeason
                  ? toAnimeDisplayCoords(animeSegments, episode.episode_number)
                  : null;
              const badgeEpisodeNumber =
                animeDisplay?.episodeNumber ?? episode.episode_number;
              const labelSeasonNumber = animeDisplay?.seasonNumber ?? epSeason;
              const seasonHeading = animeDisplay
                ? showTmdbSeasonSelect
                  ? `Part ${labelSeasonNumber}`
                  : `Season ${labelSeasonNumber}`
                : `Season ${labelSeasonNumber}`;
              const thumbnailUrl = resolveEpisodeThumbnailUrl({
                stillPath: episode.still_path,
                kitsuUrl: resolveKitsuThumbnail(episode, epSeason),
                fallbackPosterPath: details.poster_path,
                tmdbImageUrl: tmdbImage.url,
              });
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
                    {thumbnailUrl ? (
                      <Image
                        src={thumbnailUrl}
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
                      {badgeEpisodeNumber}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 self-center">
                    {searchActive ||
                    (splitCour
                      ? labelSeasonNumber !== selectedAnimeSegment + 1
                      : epSeason !== selectedSeason) ? (
                      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-primary">
                        {seasonHeading}
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
                              timeZone: "UTC",
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
