import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Info, Play } from "lucide-react";

import { MediaLogo, MediaPoster } from "@/components/media";
import { mediaMetaBadgeClass } from "@/components/media/media-shared";
import { Badge } from "@/components/ui/badge";
import { pages } from "@/config/pages";
import { cn } from "@/lib/utils";
import { tmdb, type WithImages } from "@/tmdb/api";
import { tmdbImage } from "@/tmdb/utils";

type CatalogSpotlightProps = {
  mediaType: "movie" | "tv";
  id: number;
  priority?: boolean;
  hubLink: string;
  hubButtonLabel: string;
  badgeLabel?: string;
};

export const CatalogSpotlight: React.FC<CatalogSpotlightProps> = async ({
  mediaType,
  id,
  priority,
  badgeLabel = "Featured",
}) => {
  if (mediaType === "movie") {
    const item = await tmdb.movie.detail<WithImages>({
      id,
      append: "images",
    });
    const logo = item.images.logos.find((l) => l.iso_639_1 === "en");

    const backdropUrl = item.backdrop_path
      ? tmdbImage.backdrop(item.backdrop_path, "w1280")
      : null;

    return (
      <div
        className={cn(
          "group relative isolate overflow-hidden rounded-2xl",
          "bg-card/40 backdrop-blur-xl shadow-2xl transition-all duration-500",
        )}
      >
        {backdropUrl ? (
          <div className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-700 group-hover:opacity-50">
            <Image
              src={backdropUrl}
              alt=""
              fill
              priority={priority}
              sizes="(max-width: 768px) 100vw, min(1400px, 100vw)"
              className="scale-110 object-cover blur-xs"
              aria-hidden
            />
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-background/95 via-background/55 to-background/25" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-background/30" />

        <div className="relative flex h-full min-h-[min(22rem,70vw)] flex-col gap-8 p-4 sm:p-6 md:min-h-80 md:flex-row md:items-stretch md:gap-8 md:p-8 lg:gap-12 lg:p-10">
          <Link
            href={`${pages.movie.root.link}/${item.id}`}
            className="mx-auto shrink-0 md:mx-0"
            aria-describedby="catalog-spotlight-copy-movie"
          >
            <div className="relative w-[min(72vw,14rem)] overflow-hidden rounded-xl bg-muted shadow-2xl transition-all duration-500 sm:w-56 md:w-64 lg:w-72">
              <MediaPoster
                image={item.poster_path}
                alt={item.title}
                priority={priority}
                size="w780"
                className="aspect-poster! w-full"
              />
            </div>
          </Link>

          <div
            id="catalog-spotlight-copy-movie"
            className="flex min-w-0 flex-1 flex-col justify-center space-y-4 text-center md:text-left"
          >
            <Badge className="mx-auto w-fit select-none md:mx-0">
              {badgeLabel}
            </Badge>

            {logo ? (
              <>
                <h2 className="sr-only">{item.title}</h2>
                <MediaLogo
                  logo={logo}
                  title={item.title}
                  size="large"
                  maxHeight="112px"
                  maxWidth="448px"
                  className="mx-auto my-2 md:mx-0"
                />
              </>
            ) : (
              <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
                {item.title}
              </h2>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              {item.genres.slice(0, 4).map((genre) => (
                <Link
                  href={`${pages.movie.catalog.link}?view=discover&with_genres=${genre.id}&mode=results`}
                  key={genre.id}
                >
                  <Badge
                    variant="secondary"
                    className={cn(
                      mediaMetaBadgeClass,
                      "select-none font-medium",
                    )}
                  >
                    {genre.name}
                  </Badge>
                </Link>
              ))}
            </div>

            <p className="line-clamp-4 text-pretty text-sm text-muted-foreground sm:text-base max-w-xl">
              {item.overview}
            </p>

            <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row md:justify-start">
              <Link
                href={`${pages.movie.root.link}/${item.id}?autoplay=true`}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/60 bg-white px-4 py-2 text-sm font-bold text-black shadow-lg transition hover:border-white/70 hover:bg-white/90 hover:shadow-xl"
              >
                <Play className="mr-2 size-4 fill-black text-black" />
                Play
              </Link>
              <Link
                href={`${pages.movie.root.link}/${item.id}`}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:border-white/40 hover:bg-white/20 hover:shadow-xl"
              >
                <Info className="mr-2 size-4" />
                See More
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const item = await tmdb.tv.detail<WithImages>({
    id,
    append: "images",
  });
  const logo = item.images.logos.find((l) => l.iso_639_1 === "en");

  const backdropUrl = item.backdrop_path
    ? tmdbImage.backdrop(item.backdrop_path, "w1280")
    : null;

  return (
    <div
      className={cn(
        "group relative isolate overflow-hidden rounded-2xl",
        "bg-card/40 backdrop-blur-xl shadow-2xl transition-all duration-500",
      )}
    >
      {backdropUrl ? (
        <div className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-700 group-hover:opacity-50">
          <Image
            src={backdropUrl}
            alt=""
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, min(1400px, 100vw)"
            className="scale-110 object-cover blur-xs"
            aria-hidden
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-background/95 via-background/55 to-background/25" />
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-background/30" />

      <div className="relative flex h-full min-h-[min(22rem,70vw)] flex-col gap-8 p-4 sm:p-6 md:min-h-80 md:flex-row md:items-stretch md:gap-8 md:p-8 lg:gap-12 lg:p-10">
        <Link
          href={`${pages.tv.root.link}/${item.id}`}
          className="mx-auto shrink-0 md:mx-0"
          aria-describedby="catalog-spotlight-copy-tv"
        >
          <div className="relative w-[min(72vw,14rem)] overflow-hidden rounded-xl bg-muted shadow-2xl transition-all duration-500 sm:w-56 md:w-64 lg:w-72">
            <MediaPoster
              image={item.poster_path}
              alt={item.name}
              priority={priority}
              size="w780"
              className="aspect-poster! w-full"
            />
          </div>
        </Link>

        <div
          id="catalog-spotlight-copy-tv"
          className="flex min-w-0 flex-1 flex-col justify-center space-y-4 text-center md:text-left"
        >
          <Badge className="mx-auto w-fit select-none md:mx-0">
            {badgeLabel}
          </Badge>

          {logo ? (
            <>
              <h2 className="sr-only">{item.name}</h2>
              <MediaLogo
                logo={logo}
                title={item.name}
                size="large"
                maxHeight="112px"
                maxWidth="448px"
                className="mx-auto my-2 md:mx-0"
              />
            </>
          ) : (
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
              {item.name}
            </h2>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
            {item.genres.slice(0, 4).map((genre) => (
              <Link
                href={`${pages.tv.catalog.link}?view=discover&with_genres=${genre.id}&mode=results`}
                key={genre.id}
              >
                <Badge
                  variant="secondary"
                  className={cn(mediaMetaBadgeClass, "select-none font-medium")}
                >
                  {genre.name}
                </Badge>
              </Link>
            ))}
          </div>

          <p className="line-clamp-4 text-pretty text-sm text-muted-foreground sm:text-base">
            {item.overview}
          </p>

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row md:justify-start">
            <Link
              href={`${pages.tv.root.link}/${item.id}?autoplay=true`}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/60 bg-white px-4 py-2 text-sm font-bold text-black shadow-lg transition hover:border-white/70 hover:bg-white/90 hover:shadow-xl"
            >
              <Play className="mr-2 size-4 fill-black text-black" />
              Play
            </Link>
            <Link
              href={`${pages.tv.root.link}/${item.id}`}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:border-white/40 hover:bg-white/20 hover:shadow-xl"
            >
              <Info className="mr-2 size-4" />
              See More
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
