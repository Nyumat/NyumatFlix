"use client";

import { CollectionFilmTile } from "@/components/collections/collection-film-tile";
import { MediaPoster } from "@/components/media/media-display";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { buttonVariants } from "@/components/ui/button";
import {
  COLLECTION_CAROUSEL_THRESHOLD,
  collectionCarouselItemBasis,
} from "@/lib/collections/layout";
import { filterWithPosterPath } from "@/lib/media-poster-path";
import { cn } from "@/lib/utils";
import type { HomeCollection } from "@/lib/server/home-collections-data";
import type { Movie } from "@/tmdb/models";
import { tmdbImage } from "@/tmdb/utils";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type CollectionShowcaseProps = {
  collection: HomeCollection;
  items: Array<Movie & { media_type: "movie" }>;
  priority?: boolean;
};

function CollectionFilmStrip({
  items,
  priority,
}: {
  items: Array<Movie & { media_type: "movie" }>;
  priority?: boolean;
}) {
  const visible = filterWithPosterPath(items);
  if (!visible.length) return null;

  if (visible.length <= COLLECTION_CAROUSEL_THRESHOLD) {
    return (
      <div className="flex gap-2 sm:gap-2.5">
        {visible.map((item, index) => (
          <CollectionFilmTile
            key={item.id}
            item={item}
            priority={priority && index === 0}
            className="min-w-0 flex-1"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <Carousel
        opts={{
          align: "start",
          slidesToScroll: "auto",
          dragFree: true,
        }}
        className="w-full"
      >
        <CarouselContent>
          {visible.map((item, index) => (
            <CarouselItem key={item.id} className={collectionCarouselItemBasis}>
              <CollectionFilmTile
                item={item}
                priority={priority && index === 0}
                className="w-full"
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious
          className={cn(
            "left-0.5 top-1/2 h-6 w-6 -translate-y-1/2 border-0 bg-black/85 text-white shadow-md",
            "hover:bg-black disabled:pointer-events-none disabled:opacity-0",
            "[&_svg]:size-3",
          )}
        />
        <CarouselNext
          className={cn(
            "right-0.5 top-1/2 h-6 w-6 -translate-y-1/2 border-0 bg-black/85 text-white shadow-md",
            "hover:bg-black disabled:pointer-events-none disabled:opacity-0",
            "[&_svg]:size-3",
          )}
        />
      </Carousel>
    </div>
  );
}

export function CollectionShowcase({
  collection,
  items,
  priority,
}: CollectionShowcaseProps) {
  const href = `/collection/${collection.id}`;
  const backdropPath =
    collection.backdrop_path ?? collection.parts[0]?.backdrop_path;
  const backdropUrl = backdropPath
    ? tmdbImage.backdrop(backdropPath, "w1280")
    : null;

  return (
    <article className="group/collection relative isolate overflow-hidden rounded-2xl">
      {backdropUrl ? (
        <div className="pointer-events-none absolute inset-0 opacity-35 transition-opacity duration-700 group-hover/collection:opacity-45">
          <Image
            src={backdropUrl}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="scale-110 object-cover blur-xs"
            aria-hidden
          />
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-background/95 via-background/70 to-background/30" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/90 via-transparent to-background/20" />

      <div className="relative space-y-3 p-3 sm:space-y-4 sm:p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <Link href={href} className="shrink-0">
            <div className="relative w-20 overflow-hidden rounded-xl shadow-xl transition-transform duration-500 group-hover/collection:scale-[1.02] sm:w-24">
              <MediaPoster
                image={
                  collection.poster_path ?? collection.parts[0]?.poster_path
                }
                alt={collection.name}
                priority={priority}
                size="w342"
                className="aspect-poster! w-full"
              />
            </div>
          </Link>

          <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Collection
            </p>
            <h3 className="line-clamp-2 text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {collection.name}
            </h3>
            {collection.overview ? (
              <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                {collection.overview}
              </p>
            ) : null}
            <Link
              href={href}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "mt-1 rounded-full border-white/15 bg-white/5 px-4 text-xs font-semibold backdrop-blur-md sm:text-sm",
              )}
            >
              View collection
              <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </div>
        </div>

        <CollectionFilmStrip items={items} priority={priority} />
      </div>
    </article>
  );
}
