"use client";

import { MediaLogo, Poster } from "@/components/media/media-display";
import { ServerSelector } from "@/components/media/controls/server-selector";
import { Button } from "@/components/ui/button";
import { WatchlistItem } from "@/lib/domain/watchlist";
import { Episode, MediaItem, Movie, TvShow } from "@/lib/domain/typings";
import { buildGenreBrowseUrl } from "@/lib/genre-routes";
import { Icons } from "@/lib/icons";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { cn } from "@/lib/utils";
import {
  getCountryFlagEmoji,
  getFriendlyCountryName,
} from "@/utils/country-helpers";
import { AnimatePresence, motion } from "framer-motion";
import { Star, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import React, { useEffect } from "react";
import { fetchSeasonDetails } from "@/components/tvshow/tvshow-api";
import { resolveTvWatchTarget } from "@/lib/tv-watch-target";
import { HeroButtons } from "./hero-buttons";
import type { YouTubePlayer } from "./youtube-types";

interface HeroContentProps {
  media: MediaItem;
  mediaType?: "tv" | "movie";
  isWatch: boolean;
  isPlayingVideo: boolean;
  isPlayingTrailer: boolean;
  handleWatch(): void;
  handlePlayTrailer(): void;
  handleTrailerEnded(): void;
  youtubePlayer: YouTubePlayer;
  setYoutubePlayer(player: YouTubePlayer): void;
  isUpcoming?: boolean;
  watchlistItem?: WatchlistItem | null;
  initialEpisode?: Episode | null;
  initialSeasonNumber?: number | null;
  anilistId?: number | null | undefined;
  canPlayTrailer: boolean;
  showAmbientMuteButton: boolean;
  showAmbientAudioHint: boolean;
  isAmbientMuted: boolean;
  isHeroHovered: boolean;
  onDetailsMouseEnter(): void;
  onDetailsMouseLeave(): void;
  onToggleAmbientMute(): void;
}

export function HeroContent({
  media,
  mediaType,
  isWatch,
  isPlayingVideo,
  isPlayingTrailer,
  handleWatch,
  handlePlayTrailer,
  handleTrailerEnded,
  youtubePlayer,
  setYoutubePlayer,
  isUpcoming = false,
  watchlistItem,
  initialEpisode,
  initialSeasonNumber,
  anilistId,
  canPlayTrailer,
  showAmbientMuteButton,
  showAmbientAudioHint,
  isAmbientMuted,
  isHeroHovered,
  onDetailsMouseEnter,
  onDetailsMouseLeave,
  onToggleAmbientMute,
}: HeroContentProps) {
  const {
    selectedEpisode,
    seasonNumber,
    tvShowId,
    clearSelectedEpisode,
    setWatchCallback,
    setSelectedEpisode,
  } = useEpisodeStore();
  const title = media.title || media.name;

  const year =
    media.release_date?.substring(0, 4) ||
    media.first_air_date?.substring(0, 4);
  const isTv = mediaType === "tv";
  let durationStr: string | null = null;
  if (isTv) {
    if ((media as TvShow).number_of_seasons) {
      const s = (media as TvShow).number_of_seasons;
      durationStr = `${s} Season${s !== 1 ? "s" : ""}`;
    }
  } else {
    const r = (media as Movie).runtime;
    if (r) {
      const h = Math.floor(r / 60);
      const mins = r % 60;
      durationStr = h > 0 ? `${h}h ${mins}m` : `${mins}m`;
    }
  }
  const ratingRaw = media.vote_average;
  const parsedRating = ratingRaw
    ? parseFloat(ratingRaw.toFixed(1)).toString()
    : null;
  const genresArray =
    (
      media as MediaItem & { genres?: Array<{ id: number; name: string }> }
    ).genres?.slice(0, 3) || [];
  const isAnime = typeof anilistId === "number";
  const primaryProductionCountry =
    !isTv && "production_countries" in media
      ? media.production_countries?.[0]
      : undefined;
  const productionCountryCode = primaryProductionCountry?.iso_3166_1;
  const productionCountryFlag = productionCountryCode
    ? getCountryFlagEmoji(productionCountryCode)
    : null;
  const productionCountryName = primaryProductionCountry
    ? getFriendlyCountryName(
        primaryProductionCountry.iso_3166_1,
        primaryProductionCountry.name,
      )
    : null;

  const metaElements: React.ReactNode[] = [];
  if (parsedRating) {
    metaElements.push(
      <div
        key="rating"
        className="inline-flex h-6 items-center gap-1 text-pink-500"
      >
        <Star className="w-4 h-4 fill-current border-none outline-none focus:outline-none" />
        <span className="text-white/90 text-sm sm:text-base font-medium leading-none tracking-wide">
          {parsedRating}
        </span>
      </div>,
    );
  }
  if (productionCountryCode && productionCountryFlag) {
    metaElements.push(
      <Link
        key="production-country"
        href={`/browse/country/${productionCountryCode.toLowerCase()}?type=movie`}
        className="inline-flex h-6 items-center text-base leading-none transition hover:scale-110 sm:text-lg"
        aria-label={
          productionCountryName
            ? `Browse ${productionCountryName} movies`
            : "Browse movies from this country"
        }
        title={productionCountryName ?? undefined}
      >
        {productionCountryFlag}
      </Link>,
    );
  }
  if (year)
    metaElements.push(
      <span key="year" className="inline-flex h-6 items-center leading-none">
        {year}
      </span>,
    );
  if (durationStr)
    metaElements.push(
      <span
        key="duration"
        className="inline-flex h-6 items-center leading-none"
      >
        {durationStr}
      </span>,
    );
  genresArray.forEach((genre) =>
    metaElements.push(
      <Link
        key={genre.id}
        href={buildGenreBrowseUrl(genre, isTv ? "tv" : "movie", isAnime)}
        className="inline-flex h-6 items-center leading-none transition hover:text-primary"
        aria-label={`Browse ${genre.name} ${isAnime ? "anime" : isTv ? "TV shows" : "movies"}`}
      >
        {genre.name}
      </Link>,
    ),
  );

  const metaRow = metaElements.reduce<React.ReactNode[]>((acc, curr, i) => {
    if (i === 0) return [curr];
    return [
      ...acc,
      <span
        key={`dot-${i}`}
        className="inline-flex h-6 items-center text-white/50 mx-2 text-sm sm:text-base font-bold leading-none"
      >
        &middot;
      </span>,
      curr,
    ];
  }, [] as React.ReactNode[]);

  // Hydrate the resume episode so the label and player stay in sync.
  useEffect(() => {
    if (mediaType !== "tv") {
      return;
    }

    const contentIdStr = media.id.toString();
    const storeState = useEpisodeStore.getState();
    const target = resolveTvWatchTarget(
      media.id,
      {
        selectedEpisode: storeState.selectedEpisode,
        tvShowId: storeState.tvShowId,
        seasonNumber: storeState.seasonNumber,
      },
      watchlistItem,
      initialEpisode,
      initialSeasonNumber,
    );

    if (!target) {
      return;
    }

    if (
      target.source !== "watchlist" &&
      storeState.selectedEpisode &&
      storeState.tvShowId === contentIdStr
    ) {
      return;
    }

    let cancelled = false;

    const hydrateEpisode = async () => {
      let episode = target.source === "watchlist" ? null : target.episode;
      const seasonNumber = target.seasonNumber;

      if (target.source === "watchlist") {
        const seasonData = await fetchSeasonDetails(
          contentIdStr,
          target.seasonNumber,
        );
        episode =
          seasonData?.episodes?.find(
            (item) => item.episode_number === target.episodeNumber,
          ) ?? null;
      }

      if (cancelled || !episode) {
        return;
      }

      const latestState = useEpisodeStore.getState();
      if (
        latestState.selectedEpisode &&
        latestState.tvShowId === contentIdStr &&
        latestState.seasonNumber === seasonNumber &&
        latestState.selectedEpisode.episode_number === episode.episode_number
      ) {
        return;
      }

      setSelectedEpisode(episode, contentIdStr, seasonNumber, undefined, true);
    };

    void hydrateEpisode();

    return () => {
      cancelled = true;
    };
  }, [
    initialEpisode,
    initialSeasonNumber,
    media.id,
    mediaType,
    setSelectedEpisode,
    watchlistItem,
  ]);

  // Use server-rendered episode if available, otherwise use store
  const displayEpisode = selectedEpisode || initialEpisode;
  const displaySeasonNumber = seasonNumber || initialSeasonNumber;
  const isLastWatchedEpisode =
    displayEpisode != null &&
    displaySeasonNumber != null &&
    watchlistItem?.lastWatchedSeason != null &&
    watchlistItem?.lastWatchedEpisode != null &&
    displaySeasonNumber === watchlistItem.lastWatchedSeason &&
    displayEpisode.episode_number === watchlistItem.lastWatchedEpisode;

  // Set the watch callback in the episode store
  useEffect(() => {
    if (mediaType === "tv") {
      setWatchCallback(() => {
        handleWatch();
        // Scroll to top to show the video
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    return () => {
      setWatchCallback(null);
    };
  }, [handleWatch, mediaType, setWatchCallback]);

  // Clear stale episode state when leaving TV pages or switching shows.
  useEffect(() => {
    const contentIdStr = media.id.toString();

    if (mediaType !== "tv") {
      clearSelectedEpisode();
      return;
    }

    if (tvShowId && tvShowId !== contentIdStr) {
      clearSelectedEpisode();
    }
  }, [media.id, mediaType, tvShowId, clearSelectedEpisode]);

  return (
    <div>
      {(isPlayingVideo || isPlayingTrailer) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="absolute z-50 px-4 sm:px-6 lg:px-8 pt-4"
          style={{ top: "calc(100% - 6rem)", left: 0, right: 0 }}
        >
          <div className="md:max-w-7xl lg:max-w-8xl mx-auto flex items-center justify-end gap-3 sm:gap-4">
            <ServerSelector
              media={media}
              mediaType={mediaType}
              onServerSelect={() => {
                if (isPlayingTrailer && youtubePlayer?.destroy) {
                  youtubePlayer.destroy();
                  setYoutubePlayer(null);
                }
                if (isPlayingTrailer) {
                  handleTrailerEnded();
                  handleWatch();
                }
              }}
            />
            <button
              onClick={() => {
                if (isPlayingTrailer && youtubePlayer) {
                  youtubePlayer.destroy();
                  setYoutubePlayer(null);
                }
                handleTrailerEnded();
              }}
              className="group relative bg-background/90 hover:bg-background backdrop-blur-md transition-all duration-200 rounded-full p-2.5 sm:p-3 text-foreground border border-border/50 hover:border-border shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              aria-label={isPlayingTrailer ? "Stop trailer" : "Close video"}
            >
              <X
                size={20}
                className="sm:w-6 sm:h-6 transition-transform duration-200 group-hover:rotate-90"
                strokeWidth={2.5}
              />
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {!isPlayingVideo && !isPlayingTrailer && (
          <div>
            <motion.div
              className="absolute inset-0 z-20 pointer-events-none flex items-end pb-0 px-4 sm:px-6 lg:px-8"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="relative mx-auto w-full md:max-w-7xl lg:max-w-8xl">
                {isWatch && media.poster_path && (
                  <div className="absolute right-4 top-1/2 z-30 w-24 -translate-y-40 sm:right-6 sm:w-28 lg:hidden">
                    <div className="overflow-hidden rounded-lg border-2 border-white/20 shadow-2xl">
                      <Poster
                        posterPath={media.poster_path}
                        title={(title as string) || "Poster"}
                        size="small"
                        className="rounded-lg"
                        priority
                      />
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    "flex w-full flex-col gap-8 py-12 sm:py-16 lg:gap-8 xl:gap-10",
                    "lg:flex-row lg:items-start",
                  )}
                >
                  <motion.div
                    className={cn(
                      "min-w-0 w-full flex-1 flex flex-col pointer-events-auto rounded-xl",
                      isWatch ? "max-w-3xl" : "max-w-2xl",
                    )}
                    onMouseEnter={onDetailsMouseEnter}
                    onMouseLeave={onDetailsMouseLeave}
                    layout
                  >
                    <motion.div layout>
                      {media.logo ? (
                        <MediaLogo
                          logo={media.logo}
                          title={(title as string) || "Logo"}
                          size="default"
                          priority
                          className={cn(
                            "mb-3 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:mb-4",
                            isHeroHovered ? "size-2/6" : "size-1/4",
                          )}
                        />
                      ) : (
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3 drop-shadow-xl tracking-tight">
                          {title as string}
                        </h1>
                      )}
                    </motion.div>

                    <AnimatePresence>
                      {isHeroHovered && (
                        <motion.div
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          variants={{
                            hidden: { opacity: 0, height: 0 },
                            visible: {
                              opacity: 1,
                              height: "auto",
                              transition: {
                                duration: 0.4,
                                ease: [0.19, 1, 0.22, 1], // fluid ease-out
                                staggerChildren: 0.05,
                                delayChildren: 0.05,
                              },
                            },
                            exit: {
                              opacity: 0,
                              height: 0,
                              transition: {
                                duration: 0.3,
                                ease: [0.4, 0, 1, 1], // tight ease-in
                                staggerChildren: 0.03,
                                staggerDirection: -1,
                              },
                            },
                          }}
                          className="overflow-hidden flex flex-col"
                        >
                          {/* Episode Selection Display */}
                          {displayEpisode &&
                            displaySeasonNumber &&
                            mediaType === "tv" && (
                              <motion.div
                                variants={{
                                  hidden: { opacity: 0, y: 15, scale: 0.98 },
                                  visible: {
                                    opacity: 1,
                                    y: 0,
                                    scale: 1,
                                    transition: {
                                      duration: 0.4,
                                      ease: [0.19, 1, 0.22, 1],
                                    },
                                  },
                                  exit: {
                                    opacity: 0,
                                    y: -5,
                                    scale: 0.98,
                                    transition: { duration: 0.2 },
                                  },
                                }}
                                className="mb-3 inline-flex w-fit max-w-full items-center gap-2 rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 backdrop-blur-sm"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-medium text-white/90 sm:text-sm">
                                    {isLastWatchedEpisode
                                      ? "Continue"
                                      : "Up next"}{" "}
                                    from S{displaySeasonNumber}E
                                    {displayEpisode.episode_number}
                                    {displayEpisode.name ? (
                                      <span className="font-normal text-white/65">
                                        {" "}
                                        · {displayEpisode.name}
                                      </span>
                                    ) : null}
                                  </p>
                                </div>
                                <button
                                  onClick={clearSelectedEpisode}
                                  className="shrink-0 rounded-full p-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                                  aria-label="Clear episode selection"
                                >
                                  <X size={14} />
                                </button>
                              </motion.div>
                            )}

                          <motion.div
                            variants={{
                              hidden: { opacity: 0, x: -10 },
                              visible: {
                                opacity: 1,
                                x: 0,
                                transition: {
                                  duration: 0.4,
                                  ease: [0.19, 1, 0.22, 1],
                                },
                              },
                              exit: {
                                opacity: 0,
                                x: -5,
                                transition: { duration: 0.2 },
                              },
                            }}
                            className="flex items-center flex-wrap text-sm sm:text-base font-medium text-white/90 tracking-wide mb-4 drop-shadow-md"
                          >
                            {metaRow}
                          </motion.div>

                          {media.overview && (
                            <motion.p
                              variants={{
                                hidden: { opacity: 0, y: 15 },
                                visible: {
                                  opacity: 1,
                                  y: 0,
                                  transition: {
                                    duration: 0.4,
                                    ease: [0.19, 1, 0.22, 1],
                                  },
                                },
                                exit: {
                                  opacity: 0,
                                  transition: { duration: 0.2 },
                                },
                              }}
                              className="text-white/80 text-sm sm:text-base max-w-2xl leading-relaxed mb-1 line-clamp-3 drop-shadow-md"
                            >
                              {media.overview}
                            </motion.p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <motion.div
                      layout
                      className="flex items-center flex-wrap gap-3 pt-2"
                    >
                      <HeroButtons
                        handleWatch={handleWatch}
                        handlePlayTrailer={handlePlayTrailer}
                        mediaType={mediaType}
                        isUpcoming={isUpcoming}
                        contentId={media.id}
                        watchlistItem={watchlistItem}
                        initialEpisode={initialEpisode}
                        initialSeasonNumber={initialSeasonNumber}
                        canPlayTrailer={canPlayTrailer}
                      />

                      {showAmbientMuteButton && (
                        <div className="relative">
                          <Button
                            variant="chrome"
                            size="icon"
                            onClick={onToggleAmbientMute}
                            className="rounded-full w-10 h-10"
                            aria-label={
                              isAmbientMuted ? "Unmute trailer" : "Mute trailer"
                            }
                          >
                            {isAmbientMuted ? (
                              <VolumeX className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                          </Button>

                          <AnimatePresence>
                            {showAmbientAudioHint && isAmbientMuted && (
                              <motion.div
                                initial={{
                                  opacity: 0,
                                  scale: 0.94,
                                  x: -6,
                                  filter: "blur(8px)",
                                }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                  x: 0,
                                  filter: "blur(0px)",
                                  transition: {
                                    duration: 0.55,
                                    ease: [0.16, 1, 0.3, 1],
                                  },
                                }}
                                exit={{
                                  opacity: 0,
                                  scale: 0.98,
                                  x: 6,
                                  filter: "blur(6px)",
                                  transition: { duration: 0.24 },
                                }}
                                className="pointer-events-none absolute left-full top-1/2 ml-3 flex -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-black/80 px-3 py-1.5 text-xs font-medium text-white shadow-xl shadow-black/40 backdrop-blur-md"
                              >
                                <span className="text-white/80" aria-hidden>
                                  &larr;
                                </span>
                                <span>Click for audio</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </motion.div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
