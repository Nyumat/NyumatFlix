"use client";

import { MediaPoster } from "@/components/media/media-display";
import { Icons } from "@/lib/icons";
import { getDisplayTitle, getDisplayYear } from "@/lib/cards/selectors";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/tmdb/utils";
import type { MediaItem } from "@/lib/domain/typings";
import Image from "next/image";
import Link from "next/link";

type CollectionFilmTileProps = {
  item: MediaItem;
  variant?: "poster" | "wide";
  priority?: boolean;
  className?: string;
};

export function CollectionFilmTile({
  item,
  variant = "poster",
  priority,
  className,
}: CollectionFilmTileProps) {
  const title = getDisplayTitle(item);
  const year = getDisplayYear(item);
  const href =
    "href" in item && typeof item.href === "string"
      ? item.href
      : `/movies/${item.id}`;

  const backdropUrl = item.backdrop_path
    ? tmdbImage.backdrop(item.backdrop_path, "w780")
    : null;

  if (variant === "wide") {
    return (
      <Link
        href={href}
        className={cn(
          "group relative isolate block overflow-hidden rounded-lg bg-muted/40",
          "shadow-md transition-transform duration-500 hover:scale-[1.02]",
          className,
        )}
        aria-label={title}
      >
        {backdropUrl ? (
          <Image
            src={backdropUrl}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <MediaPoster
            image={item.poster_path}
            alt={title}
            priority={priority}
            size="w500"
            className="absolute inset-0 aspect-auto! h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-2 sm:p-2.5">
          <p className="line-clamp-1 text-[10px] font-semibold text-white sm:text-xs">
            {title}
          </p>
          {year ? (
            <p className="text-[9px] text-white/70 sm:text-[10px]">{year}</p>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <Icons.play className="size-6 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:size-7" />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group relative isolate block overflow-hidden rounded-2xl bg-muted/30",
        "aspect-2/3 shadow-md transition-transform duration-500 hover:scale-[1.02]",
        className,
      )}
      aria-label={title}
    >
      <MediaPoster
        image={item.poster_path}
        alt={title}
        priority={priority}
        size="w342"
        className="aspect-2/3! h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-x-0 bottom-0 translate-y-1 p-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <p className="line-clamp-2 text-[10px] font-semibold leading-tight text-white sm:text-[11px]">
          {title}
        </p>
        {year ? (
          <p className="mt-0.5 text-[9px] text-white/70">{year}</p>
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <Icons.play className="size-6 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] sm:size-7" />
      </div>
    </Link>
  );
}
