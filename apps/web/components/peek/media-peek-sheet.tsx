"use client";

import { MediaPeekActions } from "@/components/peek/media-peek-actions";
import { MediaPeekHeroScrim } from "@/components/peek/media-peek-hero-scrim";
import { MediaPeekMarquee } from "@/components/peek/media-peek-marquee";
import { MediaPeekMetaRow } from "@/components/peek/media-peek-meta-row";
import { MediaPeekMetaStrip } from "@/components/peek/media-peek-meta-strip";
import { MediaPeekScore } from "@/components/peek/media-peek-score";
import { MediaPeekSectionHeading } from "@/components/peek/media-peek-section-heading";
import { Button } from "@/components/ui/button";
import { useWatchlistItem } from "@/hooks/useWatchlistItem";
import { movieWatchButtonLabel } from "@/lib/playback/movie-watch-label";
import { buildGenreBrowseUrl } from "@/lib/genre-routes";
import {
  fetchMovieCreditsClient,
  fetchMovieDetailsClient,
  fetchMovieSimilarPageClient,
  fetchMovieVideosClient,
  fetchTvCreditsClient,
  fetchTvDetailsClient,
  fetchTvSimilarPageClient,
  fetchTvVideosClient,
} from "@/lib/media-detail-tab-client";
import { queryKeys } from "@/lib/query-keys";
import { type MediaPeekTarget } from "@/lib/peek/media-peek-target";
import { extractVideoRowsFromMediaVideos } from "@/lib/select-primary-trailer-video";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useMediaPeekStore } from "@/lib/stores/media-peek-store";
import { useRootTrailerAudioStore } from "@/lib/stores/root-trailer-audio-store";
import { useLocalTvWatchCoords } from "@/hooks/use-local-tv-watch-coords";
import {
  formatTvWatchLabel,
  isTvPlaybackResume,
  isTvWatchlistResume,
  resolveTvWatchTarget,
} from "@/lib/tv-watch-target";
import { formatRuntime, formatYear } from "@/lib/cards/formatters";
import { resolveCastPersonHref } from "@/lib/cast-person-href";
import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import { resolveTvCardHref } from "@/lib/tv-card-href";
import { cn } from "@/lib/utils";
import type { ListResponse } from "@/tmdb/api";
import type {
  Cast,
  Credits,
  GetVideosResponse,
  Movie,
  MovieDetails,
  TvShow,
  TvShowDetails,
} from "@/tmdb/models";
import { format, tmdbImage, yt } from "@/tmdb/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUpRight, Play, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
} from "react";

const formatEndsAt = (runtimeMinutes: number | undefined) => {
  if (!runtimeMinutes || runtimeMinutes <= 0) return null;
  return new Date(Date.now() + runtimeMinutes * 60_000).toLocaleTimeString(
    "en-US",
    { hour: "numeric", minute: "2-digit" },
  );
};

const formatShortDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

const riseStyle = (delayMs: number): CSSProperties => ({
  animationDelay: `${delayMs}ms`,
});

const PEEK_SHEET_OUT_MS = 380;

export const MediaPeekSheet = () => {
  const target = useMediaPeekStore((state) => state.target);
  const closePeek = useMediaPeekStore((state) => state.closePeek);
  const [open, setOpen] = useState(false);
  const [renderTarget, setRenderTarget] = useState<MediaPeekTarget | null>(
    null,
  );
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isClosingRef = useRef(false);

  const clearCloseTimer = () => {
    if (!closeTimerRef.current) return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const finishClose = () => {
    clearCloseTimer();
    isClosingRef.current = false;
    closePeek();
    setRenderTarget(null);
  };

  useEffect(() => {
    if (!target) return;
    clearCloseTimer();
    isClosingRef.current = false;
    setRenderTarget(target);
    setOpen(true);
  }, [target]);

  useEffect(() => () => clearCloseTimer(), []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      isClosingRef.current = false;
      setOpen(true);
      return;
    }

    if (isClosingRef.current) return;

    isClosingRef.current = true;
    setOpen(false);
    clearCloseTimer();
    closeTimerRef.current = setTimeout(finishClose, PEEK_SHEET_OUT_MS);
  };

  const requestClose = () => {
    handleOpenChange(false);
  };

  const handleSheetAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (!isClosingRef.current) return;
    if (event.target !== event.currentTarget) return;
    if (event.animationName !== "peek-sheet-out") return;
    finishClose();
  };

  if (!renderTarget) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[400] bg-black/55 backdrop-blur-[3px] data-[state=closed]:motion-safe:animate-peek-overlay-out data-[state=open]:motion-safe:animate-peek-overlay-in" />
        <MediaPeekBody
          key={`${renderTarget.mediaType}:${renderTarget.id}`}
          target={renderTarget}
          onRequestClose={requestClose}
          onSheetAnimationEnd={handleSheetAnimationEnd}
        />
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

const MediaPeekBody = ({
  target,
  onRequestClose,
  onSheetAnimationEnd,
}: {
  target: MediaPeekTarget;
  onRequestClose: () => void;
  onSheetAnimationEnd: (event: AnimationEvent<HTMLDivElement>) => void;
}) => {
  const router = useRouter();
  const setPeekTrailerActive = useRootTrailerAudioStore(
    (state) => state.setPeekTrailerActive,
  );
  const queryClient = useQueryClient();
  const { watchlistItem } = useWatchlistItem(
    target.contentId,
    target.mediaType,
  );
  const selectedEpisode = useEpisodeStore((state) => state.selectedEpisode);
  const seasonNumber = useEpisodeStore((state) => state.seasonNumber);
  const tvShowId = useEpisodeStore((state) => state.tvShowId);
  const [movieButtonLabel, setMovieButtonLabel] = useState<"Play" | "Resume">(
    "Play",
  );
  const [tvPlaybackResume, setTvPlaybackResume] = useState(false);
  const localCoords = useLocalTvWatchCoords(target.contentId);
  const [activeTrailerKey, setActiveTrailerKey] = useState<string | null>(null);
  const [stuck, setStuck] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isTrailerPlaying = Boolean(activeTrailerKey);

  const aboveFold = queryClient.getQueryData<MediaAboveFoldDetail>(
    queryKeys.mediaAboveFold(target.mediaType, target.id),
  );

  const detailsQuery = useQuery({
    queryKey: [
      ...queryKeys.media(),
      "peek",
      target.mediaType,
      target.id,
      "details",
    ] as const,
    initialData: aboveFold as unknown as
      | (MovieDetails | TvShowDetails)
      | undefined,
    queryFn: async (): Promise<MovieDetails | TvShowDetails> => {
      if (target.mediaType === "movie") {
        return fetchMovieDetailsClient(target.id);
      }
      return fetchTvDetailsClient(target.id, target.catalog);
    },
  });

  const creditsQuery = useQuery({
    queryKey: [
      ...queryKeys.media(),
      "peek",
      target.mediaType,
      target.id,
      "credits",
    ] as const,
    initialData: aboveFold?.credits as Credits | undefined,
    queryFn: async (): Promise<Credits> => {
      if (target.mediaType === "movie") {
        return fetchMovieCreditsClient(target.id);
      }
      return fetchTvCreditsClient(target.id, target.catalog);
    },
  });

  const similarQuery = useQuery({
    queryKey: [
      ...queryKeys.media(),
      "peek",
      target.mediaType,
      target.id,
      "similar",
    ] as const,
    initialData: aboveFold?.similar as ListResponse<Movie | TvShow> | undefined,
    queryFn: async (): Promise<ListResponse<Movie | TvShow>> => {
      if (target.mediaType === "movie") {
        return fetchMovieSimilarPageClient(target.id, "1");
      }
      return fetchTvSimilarPageClient(target.id, "1", target.catalog);
    },
  });

  const videosQuery = useQuery({
    queryKey: [
      ...queryKeys.media(),
      "peek",
      target.mediaType,
      target.id,
      "videos",
    ] as const,
    queryFn: async (): Promise<GetVideosResponse> => {
      if (target.mediaType === "movie") {
        return fetchMovieVideosClient(target.id);
      }
      return fetchTvVideosClient(target.id, target.catalog);
    },
  });

  const details = detailsQuery.data;
  const credits = creditsQuery.data;
  const movieDetails =
    target.mediaType === "movie"
      ? (details as MovieDetails | undefined)
      : undefined;
  const tvDetails =
    target.mediaType === "tv"
      ? (details as TvShowDetails | undefined)
      : undefined;

  const title = movieDetails?.title || tvDetails?.name || target.seed.title;
  const overview =
    movieDetails?.overview || tvDetails?.overview || target.seed.overview || "";
  const backdropPath =
    movieDetails?.backdrop_path ||
    tvDetails?.backdrop_path ||
    target.seed.backdrop_path ||
    target.seed.poster_path;
  const backdropUrl = backdropPath
    ? tmdbImage.backdrop(backdropPath, "w1280")
    : null;
  const logo = target.seed.logo;
  const rating =
    movieDetails?.vote_average ||
    tvDetails?.vote_average ||
    target.seed.vote_average ||
    0;
  const contentRating = target.seed.content_rating;
  const year = formatYear(
    movieDetails?.release_date ||
      tvDetails?.first_air_date ||
      target.seed.release_date ||
      target.seed.first_air_date,
  );
  const runtimeMinutes =
    movieDetails?.runtime ||
    tvDetails?.episode_run_time?.[0] ||
    target.seed.runtime;
  const runtimeLabel = formatRuntime(runtimeMinutes);
  const genres =
    movieDetails?.genres || tvDetails?.genres || target.seed.genres || [];
  const language =
    movieDetails?.original_language || tvDetails?.original_language;
  const releaseLabel = formatShortDate(
    movieDetails?.release_date || tvDetails?.first_air_date,
  );
  const directorPerson =
    credits?.crew.find((person) => person.job === "Director") ??
    (tvDetails?.created_by?.[0]
      ? {
          id: tvDetails.created_by[0].id,
          name: tvDetails.created_by[0].name,
        }
      : null);
  const directorLabel = tvDetails?.created_by?.[0] ? "Creator" : "Director";
  const collection = movieDetails?.belongs_to_collection;
  const companies = useMemo(() => {
    const raw =
      movieDetails?.production_companies ||
      tvDetails?.production_companies ||
      [];
    return raw.filter((company, index, list) => {
      const nameKey = company.name.trim().toLowerCase();
      return (
        list.findIndex(
          (entry) =>
            entry.id === company.id ||
            entry.name.trim().toLowerCase() === nameKey,
        ) === index && Boolean(company.logo_path)
      );
    });
  }, [movieDetails?.production_companies, tvDetails?.production_companies]);
  const videos = useMemo(() => {
    const fromQuery = extractVideoRowsFromMediaVideos(videosQuery.data);
    if (fromQuery.length) return fromQuery;
    return extractVideoRowsFromMediaVideos(
      (aboveFold as { videos?: unknown } | undefined)?.videos,
    );
  }, [aboveFold, videosQuery.data]);
  const trailer = videos.find((video) => video.type === "Trailer") ?? videos[0];
  const tvWatchTarget =
    target.mediaType === "tv"
      ? resolveTvWatchTarget(
          target.contentId,
          { selectedEpisode, tvShowId, seasonNumber },
          watchlistItem,
          null,
          null,
          localCoords,
        )
      : null;
  const tvResume =
    tvWatchTarget != null &&
    (isTvWatchlistResume(tvWatchTarget, watchlistItem) ||
      tvPlaybackResume ||
      tvWatchTarget.source === "progress");
  const playLabel =
    target.mediaType === "movie"
      ? movieButtonLabel
      : tvWatchTarget
        ? formatTvWatchLabel(tvWatchTarget, undefined, { resume: tvResume })
        : "Play";
  const cast = useMemo(
    () =>
      (credits?.cast ?? [])
        .filter((person): person is Cast & { profile_path: string } =>
          Boolean(person.profile_path),
        )
        .slice(0, 16),
    [credits?.cast],
  );
  const similar = (similarQuery.data?.results ?? []).slice(0, 16);
  const watchHref = `${target.href}${target.href.includes("?") ? "&" : "?"}autoplay=true`;
  const canPlayTrailer = Boolean(trailer?.key);
  const isPeekLoading =
    detailsQuery.isPending ||
    creditsQuery.isPending ||
    videosQuery.isPending ||
    similarQuery.isPending;

  const facts = useMemo(
    () =>
      [
        runtimeLabel ? { label: "Runtime", value: runtimeLabel } : null,
        formatEndsAt(runtimeMinutes)
          ? { label: "Ends at", value: formatEndsAt(runtimeMinutes) ?? "" }
          : null,
        language
          ? { label: "Language", value: format.country(language) }
          : null,
        releaseLabel ? { label: "Release", value: releaseLabel } : null,
        directorPerson
          ? {
              label: directorLabel,
              value: directorPerson.name,
              href: `/person/${directorPerson.id}`,
            }
          : null,
      ].filter(
        (fact): fact is { label: string; value: string; href?: string } =>
          Boolean(fact),
      ),
    [
      directorLabel,
      directorPerson,
      language,
      releaseLabel,
      runtimeLabel,
      runtimeMinutes,
    ],
  );

  const showFactsPanel =
    facts.length > 0 || Boolean(collection) || companies.length > 0;

  useEffect(() => {
    setActiveTrailerKey(null);
    setStuck(false);
  }, [target.id]);

  useEffect(() => {
    if (target.mediaType !== "movie") {
      return;
    }
    setMovieButtonLabel(movieWatchButtonLabel(target.contentId));
  }, [target.contentId, target.mediaType]);

  useEffect(() => {
    if (target.mediaType !== "tv" || !tvWatchTarget) {
      setTvPlaybackResume(false);
      return;
    }
    setTvPlaybackResume(isTvPlaybackResume(tvWatchTarget, target.contentId));
  }, [target.contentId, target.mediaType, tvWatchTarget, watchlistItem]);

  useEffect(() => {
    setPeekTrailerActive(Boolean(activeTrailerKey));
    return () => setPeekTrailerActive(false);
  }, [activeTrailerKey, setPeekTrailerActive]);

  const handleCloseNavigate = () => {
    onRequestClose();
  };

  const handlePlay = () => {
    onRequestClose();
    router.push(watchHref);
  };

  const handlePlayTrailer = (videoKey?: string) => {
    const key = videoKey ?? trailer?.key;
    if (!key) return;
    setStuck(false);
    setActiveTrailerKey(key);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseTrailer = () => {
    setActiveTrailerKey(null);
  };

  const resolveSimilarHref = (item: {
    id: number;
    href?: string;
    poster_path?: string | null;
  }) =>
    target.mediaType === "movie"
      ? `/movies/${item.id}`
      : resolveTvCardHref(item, target.catalog === "anime" ? "anime" : null);

  return (
    <DialogPrimitive.Content
      className="fixed inset-x-0 bottom-0 z-[410] mx-auto w-full max-w-[1120px] outline-none will-change-transform data-[state=closed]:motion-safe:animate-peek-sheet-out data-[state=open]:motion-safe:animate-peek-sheet-in"
      aria-describedby={undefined}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onAnimationEnd={onSheetAnimationEnd}
    >
      <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
      <div className="relative flex h-[min(92dvh,920px)] w-full flex-col overflow-hidden rounded-t-[1.35rem] border border-b-0 border-white/10 bg-background text-foreground shadow-[0_-28px_100px_-24px_rgba(0,0,0,0.92)] sm:rounded-t-[1.45rem]">
        <div
          className={cn(
            "absolute inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-white/8 px-4 transition duration-300 sm:px-6",
            stuck && !isTrailerPlaying
              ? "translate-y-0 bg-background/92 opacity-100 backdrop-blur-xl"
              : "pointer-events-none -translate-y-full opacity-0",
          )}
        >
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">
            {title}
          </p>
          <Button
            type="button"
            size="sm"
            onClick={handlePlay}
            className="h-9 shrink-0 whitespace-nowrap rounded-full bg-white px-4 text-black hover:bg-white/90"
          >
            <Play className="mr-1.5 size-3.5 fill-current" />
            {playLabel}
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-9 rounded-full"
          >
            <Link href={target.href} onClick={handleCloseNavigate}>
              Details
              <ArrowUpRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]"
          onScroll={(event) => {
            if (isTrailerPlaying) return;
            setStuck(event.currentTarget.scrollTop > 190);
          }}
        >
          <section
            className={cn(
              "relative w-full overflow-hidden",
              isTrailerPlaying ? "aspect-video min-h-0 bg-black" : "relative",
            )}
          >
            {backdropUrl && !isTrailerPlaying ? (
              <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_0%,black_52%,rgba(0,0,0,0.72)_74%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_52%,rgba(0,0,0,0.72)_74%,transparent_100%)]">
                <Image
                  src={backdropUrl}
                  alt=""
                  fill
                  priority
                  sizes="1120px"
                  className="object-cover object-top"
                />
              </div>
            ) : !isTrailerPlaying ? (
              <div className="absolute inset-0 bg-muted" />
            ) : null}
            {activeTrailerKey ? (
              <iframe
                title={`${title} trailer`}
                src={yt.video(activeTrailerKey, true)}
                className="absolute inset-0 z-[1] size-full bg-black"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            ) : null}
            {!isTrailerPlaying ? (
              <>
                <MediaPeekHeroScrim />

                <div
                  className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-2"
                  aria-hidden
                >
                  <span className="h-1 w-10 rounded-full bg-white/35" />
                </div>

                <DialogPrimitive.Close
                  className="absolute right-3 top-3 z-40 grid size-10 place-items-center rounded-full border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md transition hover:border-white/35 hover:bg-black/60"
                  aria-label="Close"
                >
                  <X className="size-5" strokeWidth={2.2} />
                </DialogPrimitive.Close>

                <div className="relative z-[2] px-4 pb-6 pt-16 md:px-8 md:pb-7 md:pt-20">
                  <div className="max-w-2xl motion-safe:animate-peek-rise">
                    {logo?.file_path ? (
                      <Image
                        src={tmdbImage.logo(logo.file_path, "w500")}
                        alt={title}
                        width={510}
                        height={126}
                        className="mb-3 h-auto max-h-[112px] w-auto max-w-[min(460px,100%)] object-contain object-left drop-shadow-lg sm:max-h-[124px] md:max-h-[136px]"
                      />
                    ) : (
                      <h2 className="mb-3 line-clamp-3 text-balance text-xl font-semibold leading-tight tracking-tight drop-shadow-sm md:text-3xl">
                        {title}
                      </h2>
                    )}

                    <MediaPeekMetaRow className="mb-2.5 items-center text-xs">
                      {rating > 0 ? <MediaPeekScore value={rating} /> : null}
                      {contentRating ? (
                        <span className="rounded border border-white/15 bg-white/8 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-foreground/90">
                          {contentRating}
                        </span>
                      ) : null}
                      {year ? (
                        <span className="text-foreground/90">{year}</span>
                      ) : null}
                      {runtimeLabel ? (
                        <span className="text-foreground/90">
                          {runtimeLabel}
                        </span>
                      ) : null}
                      {genres.slice(0, 4).map((genre) => (
                        <Link
                          key={genre.id}
                          href={buildGenreBrowseUrl(
                            genre,
                            target.mediaType,
                            target.catalog === "anime",
                          )}
                          onClick={handleCloseNavigate}
                          className="text-foreground/75 transition hover:text-primary"
                          aria-label={`Browse ${genre.name}`}
                        >
                          {genre.name}
                        </Link>
                      ))}
                    </MediaPeekMetaRow>

                    {overview ? (
                      <p className="mb-3.5 line-clamp-3 text-xs leading-5 text-muted-foreground sm:text-[13px]">
                        {overview}
                      </p>
                    ) : null}

                    <MediaPeekActions
                      playLabel={playLabel}
                      detailHref={target.href}
                      contentId={target.contentId}
                      mediaType={target.mediaType}
                      canPlayTrailer={canPlayTrailer}
                      onPlay={handlePlay}
                      onTrailer={() => handlePlayTrailer()}
                      onNavigate={handleCloseNavigate}
                    />
                  </div>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={handleCloseTrailer}
                className="absolute right-3 top-3 z-40 grid size-10 place-items-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-md transition hover:border-white/35 hover:bg-black/70"
                aria-label="Close trailer"
              >
                <X className="size-5" strokeWidth={2.2} />
              </button>
            )}
          </section>

          {showFactsPanel ? (
            <MediaPeekMetaStrip
              facts={facts}
              mediaType={target.mediaType}
              collection={collection ?? null}
              companies={companies}
              onNavigate={handleCloseNavigate}
              className="motion-safe:animate-peek-rise"
            />
          ) : detailsQuery.isPending ? (
            <div
              className="border-b border-white/6 px-4 py-3 md:px-8"
              aria-hidden
            >
              <div className={cn(skeletonPulse, "h-4 w-2/3 max-w-md")} />
            </div>
          ) : null}

          <div className="space-y-8 bg-linear-to-b from-background via-background to-muted/10 px-4 py-7 md:space-y-10 md:px-8 md:py-9 md:pb-14">
            {isPeekLoading &&
            cast.length === 0 &&
            videos.length === 0 &&
            similar.length === 0 ? (
              <MediaPeekSectionsSkeleton />
            ) : null}
            {cast.length > 0 ? (
              <section
                className="motion-safe:animate-peek-rise"
                style={riseStyle(120)}
              >
                <MediaPeekSectionHeading title="Cast" />
                <div className="flex cursor-grab snap-x snap-mandatory gap-3 overflow-x-auto pb-1 active:cursor-grabbing [scrollbar-width:none] sm:gap-4">
                  {cast.map((person) => (
                    <MediaPeekCastChip
                      key={`${person.credit_id || person.id}-${person.order}`}
                      person={person}
                      onNavigate={handleCloseNavigate}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {videos.length > 0 ? (
              <section
                className="motion-safe:animate-peek-rise"
                style={riseStyle(160)}
              >
                <MediaPeekSectionHeading title="Trailers & clips" />
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] sm:gap-4">
                  {videos.slice(0, 8).map((video) => (
                    <button
                      key={video.key}
                      type="button"
                      onClick={() => handlePlayTrailer(video.key)}
                      className="group relative h-36 w-[min(68vw,260px)] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-card/30 shadow-lg transition hover:border-primary/35 hover:shadow-primary/10 sm:h-[152px] sm:w-[272px]"
                      aria-label={video.name || "Play clip"}
                    >
                      <Image
                        src={yt.thumbnail(video.key)}
                        alt=""
                        fill
                        sizes="300px"
                        className="object-cover transition duration-500 group-hover:scale-105"
                      />
                      <span className="absolute inset-0 grid place-items-center bg-black/30 transition group-hover:bg-black/20">
                        <span className="grid size-12 place-items-center rounded-full border border-white/30 bg-white/15 backdrop-blur-sm">
                          <Play className="size-5 fill-white text-white" />
                        </span>
                      </span>
                      <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent px-3 pb-3 pt-8 text-left text-xs font-medium text-white line-clamp-2">
                        {video.name}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {similar.length > 0 ? (
              <section
                className="motion-safe:animate-peek-rise"
                style={riseStyle(200)}
              >
                <MediaPeekSectionHeading
                  title="More like this"
                  action={
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                    >
                      <Link href={target.href} onClick={handleCloseNavigate}>
                        See all on detail page
                      </Link>
                    </Button>
                  }
                />
                <MediaPeekMarquee
                  durationSeconds={Math.max(36, similar.length * 4)}
                >
                  {similar.map((item) => {
                    const similarTitle =
                      "title" in item && item.title
                        ? item.title
                        : "name" in item
                          ? item.name
                          : "";
                    return (
                      <Link
                        key={item.id}
                        href={resolveSimilarHref(item)}
                        onClick={handleCloseNavigate}
                        className="group w-[7.5rem] shrink-0 text-left sm:w-[8.25rem]"
                      >
                        <div className="relative mb-2 aspect-2/3 overflow-hidden rounded-xl border border-white/10 bg-card/40 shadow-md ring-1 ring-white/8 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-lg">
                          {item.poster_path ? (
                            <Image
                              src={tmdbImage.poster(item.poster_path, "w342")}
                              alt=""
                              fill
                              sizes="132px"
                              className="object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="grid size-full place-items-center text-muted-foreground">
                              <User className="size-8 opacity-40" />
                            </div>
                          )}
                        </div>
                        <p className="line-clamp-2 text-xs font-semibold leading-4 text-foreground sm:text-[13px]">
                          {similarTitle}
                        </p>
                      </Link>
                    );
                  })}
                </MediaPeekMarquee>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </DialogPrimitive.Content>
  );
};

const skeletonPulse = "animate-pulse rounded-xl bg-white/6";

const MediaPeekSectionsSkeleton = () => (
  <div className="space-y-8" aria-hidden>
    <div>
      <div className={cn(skeletonPulse, "mb-4 h-6 w-28")} />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className={cn(
              skeletonPulse,
              "size-[5.75rem] shrink-0 rounded-2xl sm:size-[6.5rem]",
            )}
          />
        ))}
      </div>
    </div>
    <div>
      <div className={cn(skeletonPulse, "mb-4 h-6 w-40")} />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className={cn(
              skeletonPulse,
              "h-36 w-[260px] shrink-0 sm:h-[152px]",
            )}
          />
        ))}
      </div>
    </div>
  </div>
);

const MediaPeekCastChip = ({
  person,
  onNavigate,
}: {
  person: Cast & { profile_path: string; href?: string | null };
  onNavigate: () => void;
}) => {
  const personHref = resolveCastPersonHref(person);
  const chipClassName = "group w-[5.75rem] shrink-0 snap-start sm:w-[6.5rem]";
  const inner = (
    <>
      <div className="relative mb-2 aspect-square overflow-hidden rounded-2xl border border-white/10 bg-card/40 ring-1 ring-white/8 transition duration-300 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-lg">
        <Image
          src={tmdbImage.profile(person.profile_path, "w185")}
          alt=""
          fill
          sizes="80px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-foreground sm:text-xs">
        {person.name}
      </p>
      <p className="line-clamp-2 text-[10px] leading-4 text-muted-foreground sm:text-[11px]">
        {person.character}
      </p>
    </>
  );

  if (!personHref) {
    return <div className={chipClassName}>{inner}</div>;
  }

  return (
    <Link
      href={personHref}
      onClick={onNavigate}
      className={`${chipClassName} cursor-inherit`}
    >
      {inner}
    </Link>
  );
};
