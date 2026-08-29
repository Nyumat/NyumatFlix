"use client";

import { CardMeta } from "@/components/cards/card-meta";
import { MediaLogo } from "@/components/media/media-display";
import { SmartGenreBadgeGroup } from "@/components/media/controls/genre-badge";
import { Button } from "@/components/ui/button";
import type { PersonSearchResult } from "@/hooks/use-people-search";
import {
  getBackdropPath,
  getDisplayTitle,
  getGenreIds,
  getHref,
  getPosterPath,
  isAnimeSearchCard,
} from "@/lib/cards/selectors";
import type { CanonicalMediaCard } from "@/lib/domain/typings";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/tmdb/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PersonSearchAvatar } from "./person-collage";
import { HighlightedText } from "./highlighted-text";
import { SearchPosterThumb } from "./search-poster-thumb";

type SearchMetadataPreviewProps = {
  mediaItem?: CanonicalMediaCard | null;
  person?: PersonSearchResult | null;
  query?: string;
  onNavigate?: () => void;
  layout?: "panel" | "banner";
  className?: string;
};

const panelMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const },
};

export function SearchMetadataPreview({
  mediaItem,
  person,
  query,
  onNavigate,
  layout = "panel",
  className,
}: SearchMetadataPreviewProps) {
  const isBanner = layout === "banner";
  const hasMedia = Boolean(mediaItem);
  const hasPerson = Boolean(person);

  if (!hasMedia && !hasPerson) {
    return (
      <div
        className={cn(
          "relative flex flex-col items-center justify-center overflow-hidden border border-white/8 bg-[#0a0a0c] text-center",
          isBanner
            ? "min-h-[120px] rounded-md p-5"
            : "min-h-[200px] rounded-md p-6",
          className,
        )}
        data-testid="search-metadata-empty"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_55%)]"
        />
        <Sparkles
          className="mb-2 size-4 text-muted-foreground/70"
          aria-hidden
        />
        <p className="text-sm font-medium text-foreground/90">
          Select a result to preview
        </p>
        <p className="mt-1 max-w-[24ch] text-xs text-muted-foreground">
          Tap a title on mobile or use arrow keys on desktop
        </p>
      </div>
    );
  }

  if (hasPerson && person) {
    return (
      <PersonMetadataPreview
        person={person}
        query={query}
        onNavigate={onNavigate}
        layout={layout}
        className={className}
      />
    );
  }

  if (!mediaItem) {
    return null;
  }

  const title = getDisplayTitle(mediaItem);
  const href = getHref(mediaItem);
  const isAnime = isAnimeSearchCard(mediaItem);
  const posterPath = getPosterPath(mediaItem) ?? undefined;
  const backdropPath = getBackdropPath(mediaItem);
  const backdropUrl = backdropPath
    ? tmdbImage.backdrop(backdropPath, "w1280")
    : undefined;
  const genreIds = getGenreIds(mediaItem);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${mediaItem.media_type}-${mediaItem.id}`}
        {...panelMotion}
        className={cn(
          "relative flex flex-col overflow-hidden border border-white/8 bg-[#0a0a0c]",
          isBanner ? "rounded-md" : "rounded-md",
          className,
        )}
        data-testid="search-metadata-preview"
      >
        <div className={cn("relative shrink-0", isBanner ? "h-24" : "h-32")}>
          {backdropUrl ? (
            <Image
              src={backdropUrl}
              alt=""
              fill
              priority
              sizes={isBanner ? "100vw" : "(max-width: 1100px) 40vw, 400px"}
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-muted/30" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent" />
        </div>

        <div
          className={cn(
            "relative z-10 flex flex-col",
            isBanner ? "-mt-8 px-3.5 pb-3.5" : "-mt-12 px-4 pb-4",
          )}
        >
          <div
            className={cn("flex gap-3", isBanner ? "items-end" : "items-start")}
          >
            <SearchPosterThumb
              posterPath={posterPath}
              alt={title}
              className={isBanner ? "h-16 w-11" : "h-24 w-16"}
              imageSize={isBanner ? "w185" : "w342"}
              sizes={isBanner ? "44px" : "64px"}
              priority
              radius="sm"
            />

            <div className="min-w-0 flex-1">
              {mediaItem.logo ? (
                <MediaLogo
                  logo={mediaItem.logo}
                  title={title}
                  align="left"
                  className="max-w-full"
                  fallbackClassName={cn(
                    "line-clamp-2 font-semibold tracking-tight text-foreground",
                    isBanner ? "text-base" : "text-lg",
                  )}
                />
              ) : (
                <h3
                  className={cn(
                    "line-clamp-2 font-semibold tracking-tight text-foreground text-balance",
                    isBanner ? "text-base" : "text-lg",
                  )}
                >
                  {query ? (
                    <HighlightedText text={title} query={query} />
                  ) : (
                    title
                  )}
                </h3>
              )}

              <div className="mt-1.5">
                <CardMeta
                  item={mediaItem}
                  showType
                  showRuntime={!isBanner}
                  showGenres={false}
                  maxGenres={0}
                  variant="compact"
                />
              </div>
            </div>
          </div>

          {!isBanner && genreIds.length > 0 ? (
            <div className="mt-2.5">
              <SmartGenreBadgeGroup
                genreIds={genreIds}
                mediaType={
                  isAnime || mediaItem.media_type !== "movie" ? "tv" : "movie"
                }
                maxVisible={4}
              />
            </div>
          ) : null}

          {mediaItem.overview ? (
            <p
              className={cn(
                "mt-2.5 text-sm leading-relaxed text-muted-foreground text-pretty",
                isBanner ? "line-clamp-2" : "line-clamp-3",
              )}
            >
              {mediaItem.overview}
            </p>
          ) : null}

          <div className={cn("pt-3", isBanner && "pt-2.5")}>
            <Button
              asChild
              size="sm"
              className="h-9 w-full rounded-md bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto sm:px-5"
            >
              <Link href={href} onClick={onNavigate} prefetch>
                View
                <ArrowRight className="ml-2 size-3.5" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function PersonMetadataPreview({
  person,
  query,
  onNavigate,
  layout,
  className,
}: {
  person: PersonSearchResult;
  query?: string;
  onNavigate?: () => void;
  layout: "panel" | "banner";
  className?: string;
}) {
  const isBanner = layout === "banner";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={person.id}
        {...panelMotion}
        className={cn(
          "relative flex flex-col overflow-hidden border border-white/8 bg-[#0a0a0c]",
          isBanner ? "rounded-md p-3.5" : "rounded-md p-4",
          className,
        )}
        data-testid="search-metadata-preview-person"
      >
        <div className="flex gap-3">
          <div
            className={cn(
              "relative shrink-0 overflow-hidden bg-neutral-900",
              isBanner ? "h-20 w-16" : "h-28 w-20",
            )}
          >
            <PersonSearchAvatar
              profilePath={person.profile_path}
              name={person.name}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className={cn(
                "font-semibold tracking-tight text-foreground text-balance",
                isBanner ? "text-base" : "text-xl",
              )}
            >
              {query ? (
                <HighlightedText text={person.name} query={query} />
              ) : (
                person.name
              )}
            </h3>
            {person.known_for_department ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {person.known_for_department}
              </p>
            ) : null}
          </div>
        </div>

        {person.known_for && person.known_for.length > 0 ? (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Known for
            </p>
            <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {person.known_for.slice(0, 5).map((credit) => (
                <div
                  key={`${person.id}-${credit.id}-${credit.media_type}`}
                  className="w-14 shrink-0"
                >
                  <SearchPosterThumb
                    posterPath={credit.poster_path}
                    alt={credit.title ?? credit.name ?? "Known for"}
                    className="aspect-[2/3] w-full"
                    sizes="56px"
                  />
                  <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                    {credit.title ?? credit.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="pt-3">
          <Button
            asChild
            size="sm"
            className="h-9 w-full rounded-md bg-primary text-primary-foreground sm:w-auto sm:px-5"
          >
            <Link href={`/person/${person.id}`} onClick={onNavigate} prefetch>
              View profile
              <ArrowRight className="ml-2 size-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
