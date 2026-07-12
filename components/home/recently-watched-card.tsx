"use client";

import { Icons } from "@/lib/icons";
import type { RecentlyWatchedItem } from "@/lib/playback/recently-watched";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/tmdb/utils";
import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export interface RecentlyWatchedCardProps {
  item: RecentlyWatchedItem;
}

const continueWatchingProgressFillClass = "bg-pink-500";
const continueWatchingProgressFallbackFillClass = "bg-pink-500/40";
const continueWatchingProgressTrackClass = "bg-pink-500/15";

export function RecentlyWatchedCard({ item }: RecentlyWatchedCardProps) {
  const backdropUrl = item.backdropPath
    ? tmdbImage.backdrop(item.backdropPath, "w1280")
    : item.posterPath
      ? tmdbImage.poster(item.posterPath, "w780")
      : undefined;

  const episodeLabel =
    item.mediaType === "tv" && item.seasonNumber && item.episodeNumber
      ? `S${item.seasonNumber} · E${item.episodeNumber}`
      : null;

  const progressPercent =
    item.progressRatio != null ? Math.round(item.progressRatio * 100) : null;

  return (
    <div
      className="group relative aspect-video cursor-grab select-none overflow-hidden rounded-t-lg bg-black/40 shadow-lg shadow-black/10 ring-1 ring-white/8 transition-shadow duration-300 active:cursor-grabbing hover:shadow-xl rounded-xs"
      aria-label={item.title}
    >
      {backdropUrl ? (
        <Image
          src={backdropUrl}
          alt={item.title}
          fill
          className="pointer-events-none object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 85vw, 28vw"
          draggable={false}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-pink-500/20 to-pink-500/5" />
      )}

      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/35 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 pb-5 sm:p-5 sm:pb-6">
        <div className="min-w-0 space-y-1.5">
          <h3 className="line-clamp-2 text-base font-semibold tracking-tight text-white sm:text-lg">
            {item.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/75 sm:text-sm">
            {episodeLabel ? (
              <span className="font-medium text-white/90">{episodeLabel}</span>
            ) : null}
            {episodeLabel && item.year ? (
              <span className="text-white/35">·</span>
            ) : null}
            {item.year ? <span>{item.year}</span> : null}
            {item.voteAverage != null && item.voteAverage > 0 ? (
              <>
                <span className="text-white/35">·</span>
                <span className="inline-flex items-center gap-1">
                  <Star
                    className="size-3.5 text-amber-400 sm:size-4"
                    fill="currentColor"
                  />
                  {item.voteAverage.toFixed(1)}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-30 h-[3px]",
          continueWatchingProgressTrackClass,
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progressPercent ?? undefined}
        aria-label={
          progressPercent != null
            ? `${progressPercent}% watched`
            : "Watch progress unavailable"
        }
      >
        <div
          className={cn(
            "h-full transition-[width] duration-500",
            progressPercent == null
              ? cn("w-[6%]", continueWatchingProgressFallbackFillClass)
              : continueWatchingProgressFillClass,
          )}
          style={
            progressPercent != null
              ? { width: `${Math.max(progressPercent, 2)}%` }
              : undefined
          }
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
        <Link
          href={item.href}
          className="pointer-events-auto flex size-20 cursor-pointer items-center justify-center rounded-full opacity-100 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100"
          aria-label={`Continue watching ${item.title}`}
          prefetch={false}
        >
          <Icons.play
            className="size-10 scale-100 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-300 md:scale-75 md:group-hover:scale-100 sm:size-12"
            strokeWidth={1.5}
          />
        </Link>
      </div>
    </div>
  );
}
