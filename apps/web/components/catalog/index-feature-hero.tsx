"use client";

import { getGenreName } from "@/components/content/genre-helpers";
import { useIndexHeroTransition } from "@/components/catalog/index-hero-transition-context";
import { FeatureHeroStickyScrollBackdrop } from "@/components/hero/feature-hero-backdrop";
import {
  FeatureHeroPlayButton,
  FeatureHeroWatchlistInfoPill,
} from "@/components/hero/feature-hero-watchlist-info-pill";
import { pages } from "@/config/pages";
import type { CanonicalCardLogo } from "@/lib/domain/typings";
import { buildAnimeGenreUrl, buildGenreBrowseUrl } from "@/lib/genre-routes";
import { buildHeroBackdropsFromItems } from "@/lib/hero-hub-backdrops";
import {
  HERO_CROSSFADE_DURATION_MS,
  HERO_CROSSFADE_EASE,
} from "@/lib/hero-crossfade";
import {
  indexHeroContentOverlapClassName,
  indexHeroContentShellClassName,
  indexHeroSectionClassName,
} from "@/lib/hero-shell-layout";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/tmdb/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Calendar, ChevronUp, Clapperboard, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type FeatureLogoSeed = {
  file_path?: string | null;
  iso_639_1?: string | null;
  width?: number;
  height?: number;
  aspect_ratio?: number;
};

type FeatureLogo = FeatureLogoSeed & {
  file_path: string;
};

export type IndexFeatureHeroItem = {
  id: number;
  title?: string | null;
  name?: string | null;
  overview?: string | null;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  runtime?: number | null;
  number_of_seasons?: number | null;
  genre_ids?: number[] | null;
  genres?: Array<{ id: number; name: string }> | null;
  images?: {
    logos?: FeatureLogoSeed[] | null;
  } | null;
  href?: string | null;
  logo?: CanonicalCardLogo | null;
  media_type?: "movie" | "tv";
};

type IndexFeatureHeroProps = {
  mediaType: "movie" | "tv";
  item: IndexFeatureHeroItem;
  items?: IndexFeatureHeroItem[];
  label?: string;
  priority?: boolean;
  variant?: "tmdb" | "anime";
};

const getTitle = (item: IndexFeatureHeroItem, mediaType: "movie" | "tv") =>
  mediaType === "movie"
    ? (item.title ?? item.name ?? "")
    : (item.name ?? item.title ?? "");

const getLogoFromImages = (item: IndexFeatureHeroItem): FeatureLogo | null => {
  const logos = item.images?.logos ?? [];
  const isUsable = (
    logo: FeatureLogoSeed | null | undefined,
  ): logo is FeatureLogo => Boolean(logo?.file_path);

  return (
    logos.find(
      (logo): logo is FeatureLogo => isUsable(logo) && logo.iso_639_1 === "en",
    ) ??
    logos.find(
      (logo): logo is FeatureLogo => isUsable(logo) && !logo.iso_639_1,
    ) ??
    logos.find(isUsable) ??
    null
  );
};

const getResolvedLogo = (
  item: IndexFeatureHeroItem,
  variant: "tmdb" | "anime",
): FeatureLogo | null => {
  const logoFromItem = item.logo?.file_path ? (item.logo as FeatureLogo) : null;

  if (variant === "anime") {
    return logoFromItem ?? getLogoFromImages(item);
  }

  return getLogoFromImages(item) ?? logoFromItem;
};

const getYear = (item: IndexFeatureHeroItem, mediaType: "movie" | "tv") => {
  const date =
    mediaType === "movie"
      ? item.release_date
      : (item.first_air_date ?? item.release_date);
  return typeof date === "string" && date.length >= 4 ? date.slice(0, 4) : null;
};

const getGenres = (item: IndexFeatureHeroItem, mediaType: "movie" | "tv") => {
  if (item.genres?.length) return item.genres;

  return (item.genre_ids ?? [])
    .map((genreId) => ({
      id: genreId,
      name: getGenreName(genreId, mediaType),
    }))
    .filter((genre) => genre.name !== "Unknown" && genre.name !== "N/A");
};

const getTmdbDetailHref = (
  item: IndexFeatureHeroItem,
  mediaType: "movie" | "tv",
) =>
  `${mediaType === "movie" ? pages.movie.root.link : pages.tv.root.link}/${item.id}`;

const getAnimeDetailHref = (
  item: IndexFeatureHeroItem,
  mediaType: "movie" | "tv",
) => {
  if (typeof item.href === "string" && item.href.length > 0) {
    return item.href;
  }

  return getTmdbDetailHref(item, mediaType);
};

const isInternalDetailHref = (href: string) =>
  /^\/(?:movies|tvshows|anime)\/[^/?#]+(?:[?#].*)?$/.test(href);

export function IndexFeatureHero({
  mediaType,
  item: initialItem,
  items,
  label,
  priority,
  variant = "tmdb",
}: IndexFeatureHeroProps) {
  const featureItems = items?.length ? items : [initialItem];
  const transition = useIndexHeroTransition();
  const [localActiveIndex, setLocalActiveIndex] = useState(0);
  const [isOverviewOpen, setIsOverviewOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const activeIndex = transition?.activeIndex ?? localActiveIndex;
  const setActiveIndex = transition?.setActiveIndex ?? setLocalActiveIndex;
  const item = featureItems[activeIndex] ?? initialItem;

  const selectFeature = (index: number) => setActiveIndex(index);

  const toggleOverviewOpen = () => setIsOverviewOpen((prev) => !prev);

  useEffect(() => {
    transition?.setBackdrops(
      buildHeroBackdropsFromItems(featureItems, mediaType, priority),
    );
  }, [featureItems, mediaType, priority, transition]);

  useEffect(() => {
    if (featureItems.length < 2) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        selectFeature((activeIndex + 1) % featureItems.length);
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [activeIndex, featureItems.length]);

  const isAnime = variant === "anime";
  const title = getTitle(item, mediaType);
  const logo = getResolvedLogo(item, variant);
  const rating =
    typeof item.vote_average === "number" && item.vote_average > 0
      ? item.vote_average.toFixed(1)
      : null;
  const year = getYear(item, mediaType);
  const primaryGenre = getGenres(item, mediaType)[0];
  const primaryGenreLabel =
    primaryGenre?.name ??
    (item.genre_ids?.[0] ? getGenreName(item.genre_ids[0], mediaType) : null);
  const showPrimaryGenre =
    Boolean(primaryGenre) ||
    (isAnime &&
      Boolean(primaryGenreLabel) &&
      primaryGenreLabel !== "Unknown" &&
      primaryGenreLabel !== "N/A");
  const primaryGenreHref = showPrimaryGenre
    ? isAnime
      ? primaryGenre
        ? buildGenreBrowseUrl(primaryGenre, mediaType, true)
        : primaryGenreLabel
          ? buildAnimeGenreUrl(primaryGenreLabel)
          : null
      : primaryGenre
        ? buildGenreBrowseUrl(primaryGenre, mediaType, false)
        : null
    : null;
  const primaryGenreName = primaryGenre?.name ?? primaryGenreLabel;
  const detailHref = isAnime
    ? getAnimeDetailHref(item, mediaType)
    : getTmdbDetailHref(item, mediaType);
  const hasInternalDetailHref = isInternalDetailHref(detailHref);
  const showPlay = !isAnime || hasInternalDetailHref;
  const overview = item.overview?.trim();
  const hasMetaRow = Boolean(
    rating || year || (primaryGenreHref && primaryGenreName),
  );
  const hasOverview = Boolean(overview);
  const overviewToggleLabel = isOverviewOpen
    ? `Hide description for ${title}`
    : `Show description for ${title}`;
  const overviewExpandKey = `index-hero-overview-${item.id}`;
  const backdropPath = item.backdrop_path ?? item.poster_path;
  const backdropUrl = backdropPath
    ? tmdbImage.backdrop(backdropPath, "original")
    : null;
  const logoWidth = logo?.width && logo.width > 0 ? logo.width : 500;
  const logoHeight =
    logo?.height && logo.height > 0
      ? logo.height
      : logo?.aspect_ratio && logo.aspect_ratio > 0
        ? Math.round(logoWidth / logo.aspect_ratio)
        : 281;

  useEffect(() => {
    setIsOverviewOpen(false);
  }, [item.id]);

  if (!title) return null;

  return (
    <section className={indexHeroSectionClassName}>
      {backdropUrl ? (
        <FeatureHeroStickyScrollBackdrop
          imageUrl={backdropUrl}
          priority={priority}
        />
      ) : null}

      <div
        className={cn(
          indexHeroContentShellClassName,
          backdropUrl && indexHeroContentOverlapClassName,
        )}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={item.id}
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : {
                    duration: HERO_CROSSFADE_DURATION_MS / 1000,
                    ease: HERO_CROSSFADE_EASE,
                  }
            }
            className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 text-center text-white antialiased lg:mx-0 lg:items-start lg:gap-3 lg:text-left"
          >
            {label ? <span className="sr-only">{label}</span> : null}

            {logo ? (
              <>
                <h2 className="sr-only">{title}</h2>
                <Image
                  src={tmdbImage.logo(logo.file_path, "w500")}
                  alt={title}
                  width={logoWidth}
                  height={logoHeight}
                  className="h-auto max-h-20 w-auto max-w-full origin-center object-contain drop-shadow-2xl lg:max-h-36 lg:origin-left"
                  priority={priority}
                />
              </>
            ) : (
              <h2 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.08] tracking-tight text-white drop-shadow-2xl sm:text-5xl lg:text-6xl">
                {title}
              </h2>
            )}

            {hasMetaRow ? (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-medium leading-6 text-white drop-shadow-lg sm:gap-x-4 lg:justify-start">
                {rating ? (
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Star
                      className="size-3.5 shrink-0 fill-pink-500 text-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.55)]"
                      aria-hidden
                    />
                    {rating}/10
                  </span>
                ) : null}

                {year ? (
                  <>
                    {rating ? <span aria-hidden="true">•</span> : null}
                    <span className="inline-flex items-center gap-1.5 tabular-nums">
                      <Calendar className="size-3.5 shrink-0" aria-hidden />
                      {year}
                    </span>
                  </>
                ) : null}

                {primaryGenreHref && primaryGenreName ? (
                  <>
                    {rating || year ? <span aria-hidden="true">•</span> : null}
                    <Link
                      className="inline-flex items-center gap-1.5 text-white transition hover:text-white/80"
                      href={primaryGenreHref}
                    >
                      <Clapperboard className="size-3.5 shrink-0" aria-hidden />
                      {primaryGenreName}
                    </Link>
                  </>
                ) : null}
              </div>
            ) : null}

            {hasOverview ? (
              <p className="max-w-xl text-pretty text-sm font-normal leading-relaxed text-white/90 drop-shadow-lg sm:text-base sm:leading-relaxed line-clamp-3 lg:hidden">
                {overview}
              </p>
            ) : null}

            <AnimatePresence initial={false}>
              {hasOverview && isOverviewOpen ? (
                <motion.div
                  key={overviewExpandKey}
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
                        ease: [0.19, 1, 0.22, 1],
                      },
                    },
                    exit: {
                      opacity: 0,
                      height: 0,
                      transition: {
                        duration: 0.3,
                        ease: [0.4, 0, 1, 1],
                      },
                    },
                  }}
                  className="hidden overflow-hidden lg:block"
                >
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
                      exit: { opacity: 0, transition: { duration: 0.2 } },
                    }}
                    className="max-w-xl text-pretty text-sm font-normal leading-relaxed text-white/90 drop-shadow-lg sm:text-base sm:leading-relaxed line-clamp-3"
                  >
                    {overview}
                  </motion.p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {showPlay ? (
                <FeatureHeroPlayButton
                  detailHref={detailHref}
                  mediaType={mediaType}
                />
              ) : null}

              {!isAnime || hasInternalDetailHref ? (
                <FeatureHeroWatchlistInfoPill
                  contentId={item.id}
                  mediaType={mediaType}
                  detailHref={detailHref}
                  title={title}
                />
              ) : null}

              {hasOverview ? (
                <button
                  type="button"
                  onClick={toggleOverviewOpen}
                  aria-expanded={isOverviewOpen}
                  aria-label={overviewToggleLabel}
                  title={overviewToggleLabel}
                  className="hidden size-11 items-center justify-center text-white/70 transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:inline-flex"
                >
                  <ChevronUp
                    aria-hidden
                    className={cn(
                      "size-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isOverviewOpen ? "rotate-0" : "rotate-180",
                    )}
                  />
                </button>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        {featureItems.length > 1 ? (
          <div className="mt-4 flex justify-center gap-2 lg:absolute lg:right-8 lg:bottom-8 lg:mt-0 lg:justify-end">
            {featureItems.map((feature, index) => (
              <button
                key={feature.id}
                type="button"
                aria-label={`Show featured item ${index + 1}`}
                aria-current={activeIndex === index ? "true" : undefined}
                onClick={() => selectFeature(index)}
                className={cn(
                  "relative h-2 overflow-hidden rounded-full transition-[width,background-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  activeIndex === index
                    ? "w-8 bg-white/35"
                    : "w-2 bg-white/50 hover:bg-white/70",
                )}
              >
                {activeIndex === index ? (
                  <span className="absolute inset-0 origin-left rounded-full bg-white motion-safe:animate-hero-progress motion-reduce:scale-x-100" />
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
