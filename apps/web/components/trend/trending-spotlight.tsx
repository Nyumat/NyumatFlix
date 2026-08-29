import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MediaLogo, MediaPoster } from "@/components/media/media-display";
import { mediaMetaBadgeClass } from "@/components/media/media-shared";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { pages } from "@/config/pages";
import { pickEnglishLogo } from "@/lib/tmdb-logo";
import { cn } from "@/lib/utils";
import { tmdb, type WithImages } from "@/tmdb/api";
import { tmdbImage } from "@/tmdb/utils";
import Image from "next/image";

type TrendingSpotlightProps = {
  mediaType: "movie" | "tv";
  id: number;
  priority?: boolean;
};

export const TrendingSpotlight: React.FC<TrendingSpotlightProps> = async ({
  mediaType,
  id,
  priority,
}) => {
  if (mediaType === "movie") {
    const item = await tmdb.movie.detail<WithImages>({
      id,
      append: "images",
    });
    const logo = pickEnglishLogo(item.images?.logos);
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
            aria-describedby="trending-spotlight-copy-movie"
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
            id="trending-spotlight-copy-movie"
            className="flex min-w-0 flex-1 flex-col justify-center space-y-4 text-center md:text-left"
          >
            <Badge className="mx-auto w-fit select-none md:mx-0">
              Trending today
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
                  priority={priority}
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

            <p className="line-clamp-4 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
              {item.overview}
            </p>

            <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row md:justify-start">
              <Link
                href={`${pages.movie.root.link}/${item.id}`}
                className={buttonVariants({ size: "lg", variant: "default" })}
              >
                Watch Now <ArrowRight className="ml-2 size-4" aria-hidden />
              </Link>
              <Link
                href={pages.trending.movie.link}
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                All trending movies
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
  const logo = pickEnglishLogo(item.images?.logos);
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
          aria-describedby="trending-spotlight-copy-tv"
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
          id="trending-spotlight-copy-tv"
          className="flex min-w-0 flex-1 flex-col justify-center space-y-4 text-center md:text-left"
        >
          <Badge className="mx-auto w-fit select-none md:mx-0">
            Trending today
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
                priority={priority}
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

          <p className="line-clamp-4 text-pretty text-sm text-muted-foreground sm:text-base max-w-xl">
            {item.overview}
          </p>

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row md:justify-start">
            <Link
              href={`${pages.tv.root.link}/${item.id}`}
              className={buttonVariants({ size: "lg", variant: "default" })}
            >
              Watch Now <ArrowRight className="ml-2 size-4" aria-hidden />
            </Link>
            <Link
              href={pages.trending.tv.link}
              className={buttonVariants({ size: "lg", variant: "outline" })}
            >
              All trending TV shows
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
