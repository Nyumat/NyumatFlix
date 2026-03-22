import React from "react";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pages } from "@/config";
import { Movie } from "@/tmdb/models";
import { tmdb } from "@/tmdb/api";
import { MovieListType, WithImages } from "@/tmdb/api";
import { format, tmdbImage } from "@/tmdb/utils";
import { ArrowRight } from "lucide-react";

import { cn, formatValue, getRandomItems } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { MediaPoster } from "@/components/media";
import { MediaBackdrop, MediaRating } from "@/components/media/media-shared";
import { ListPagination } from "@/components/shared/list-pagination";
import { MovieCard } from "./movie-card";

export const MovieCollectionPart: React.FC<Movie> = ({
  id,
  title,
  backdrop_path,
  poster_path,
  vote_average,
  vote_count,
  overview,
  original_title,
  original_language,
  release_date,
}) => {
  return (
    <div className="relative">
      <div className="relative aspect-video">
        <MediaBackdrop image={backdrop_path} alt={title} size="w780" />
      </div>

      <div className="overlay-darker"></div>

      <div className="absolute inset-0 px-2 md:px-8">
        <div className="flex size-full items-center gap-6">
          <Link
            href={`${pages.movie.root.link}/${id}`}
            className="relative aspect-poster w-1/3 shrink-0"
          >
            <MediaPoster image={poster_path} alt={title} size="w342" />
          </Link>

          <div className="w-full pb-4 pt-2">
            <Link href={`${pages.movie.root.link}/${id}`}>
              <h3 className="text-md mb-2 line-clamp-1 font-semibold">
                {title}
              </h3>
            </Link>

            <div className="mb-4 hidden grid-cols-2 gap-y-2 text-xs md:grid">
              <div>
                <span className="text-muted-foreground">Year</span>
                <p>{formatValue(release_date, format.year)}</p>
              </div>

              <div>
                <span className="text-muted-foreground">Rating</span>
                <p>{vote_average ? vote_average.toFixed(1) : "N/A"}</p>
              </div>

              <div>
                <span className="text-muted-foreground">Language</span>
                <p>{formatValue(original_language, format.country)}</p>
              </div>

              <div>
                <span className="text-muted-foreground">Original Title</span>
                <p>{original_title}</p>
              </div>
            </div>

            <p className="line-clamp-2 text-xs text-muted-foreground xl:line-clamp-4">
              {overview}
            </p>

            <Link
              href={`${pages.movie.root.link}/${id}`}
              className={cn(
                buttonVariants({ size: "sm", variant: "default" }),
                "mt-4",
              )}
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MovieCollectionProps {
  id: number;
}

export const MovieCollection: React.FC<MovieCollectionProps> = async ({
  id,
}) => {
  const collection = await tmdb.collection.details({
    id,
  });

  return (
    <div className="h-hero relative w-full">
      <MediaBackdrop image={collection.backdrop_path} alt={collection.name} />
      <div className="overlay">
        <div className="p-4 md:p-10">
          <p className="line-clamp-3 text-xs text-muted-foreground md:text-lg">
            Part of
          </p>
          <h2 className="line-clamp-1 text-lg font-medium md:text-2xl">
            {collection.name}
          </h2>
          <p className="mb-4 line-clamp-1 max-w-2xl text-muted-foreground">
            Includes: {collection.parts.map((part) => part.title).join(", ")}
          </p>
          <Button asChild>
            <Link href={`/collection/${id}`}>View the collection</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

interface MovieHeroItemProps {
  id: string;
  label?: string;
  priority?: boolean;
}

export const MovieHeroItem: React.FC<MovieHeroItemProps> = async ({
  id,
  label,
  priority,
}) => {
  const item = await tmdb.movie.detail<WithImages>({ id, append: "images" });
  const logo = item.images.logos.find((logo) => logo.iso_639_1 === "en");

  return (
    <div className="h-hero relative isolate" key={item.id}>
      <div className="absolute inset-0 md:hidden">
        <MediaBackdrop
          image={item.backdrop_path}
          alt={item.title}
          priority={priority}
          className="h-full min-h-0"
          size="w1280"
        />
      </div>
      <div className="absolute inset-0 hidden md:block">
        <MediaBackdrop
          image={item.backdrop_path}
          alt={item.title}
          priority={priority}
          className="h-full min-h-0"
          size="w1280"
        />
      </div>

      <div className="overlay">
        <div className="mx-auto max-w-3xl space-y-3 p-4 pb-6 text-center md:space-y-4 md:p-8 md:pb-8 lg:p-10">
          <Badge className="select-none">{label}</Badge>

          {logo ? (
            <Image
              src={tmdbImage.logo(logo.file_path, "w500")}
              className="mx-auto my-6 w-[min(70%,18rem)] md:my-8 md:w-[min(55%,16rem)] lg:w-[min(50%,18rem)]"
              alt={item.title}
              height={logo.height}
              width={logo.width}
              unoptimized
            />
          ) : (
            <h1 className="line-clamp-2 text-xl font-medium leading-tight tracking-tighter md:text-3xl lg:text-4xl">
              {item.title}
            </h1>
          )}

          <div>
            <MediaRating average={item.vote_average} count={item.vote_count} />
            {item.genres.map((genre) => (
              <Link
                href={`${pages.movie.catalog.link}?view=discover&with_genres=${genre.id}&mode=results`}
                key={genre.id}
              >
                <Badge variant="secondary" className="ml-2 select-none">
                  {genre.name}
                </Badge>
              </Link>
            ))}
          </div>

          <p className="line-clamp-3 text-sm text-muted-foreground md:text-lg">
            {item.overview}
          </p>

          <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
            <Link
              href={`${pages.movie.root.link}/${item.id}`}
              className={buttonVariants({
                size: "lg",
                variant: "default",
              })}
            >
              Details <ArrowRight className="ml-2 size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MovieHeroProps {
  movies: Movie[];
  label: string;
  count?: number;
  priority?: boolean;
  pick?: "random" | "first";
}

export const MovieHero: React.FC<MovieHeroProps> = ({
  movies,
  label,
  count = 1,
  priority,
  pick = "random",
}) => {
  const items =
    pick === "first"
      ? movies.slice(0, Math.min(count, movies.length))
      : getRandomItems(movies, count);

  return items.map((item) => (
    <MovieHeroItem
      key={item.id}
      id={item.id.toString()}
      label={label}
      priority={priority}
    />
  ));
};

interface MovieListProps {
  list: MovieListType;
  page: string;
  title?: string;
  description?: string;
}

export const MovieList: React.FC<MovieListProps> = async ({
  list,
  page,
  title,
  description,
}) => {
  const cookieStore = await cookies();
  const region = cookieStore.get("region")?.value ?? "US";

  const {
    results,
    total_pages: totalPages,
    page: currentPage,
  } = await tmdb.movie.list({
    region,
    list,
    page,
  });

  if (!results?.length) {
    return notFound();
  }

  return (
    <div className="container space-y-8">
      <div className="md:mb-12 md:mt-6">
        <h1 className="mb-2 text-2xl font-medium">{title}</h1>
        <p className="max-w-3xl text-muted-foreground">{description}</p>
      </div>

      <div className="grid-list">
        {results.map((movie) => (
          <MovieCard key={movie.id} {...movie} />
        ))}
      </div>

      <ListPagination currentPage={currentPage} totalPages={totalPages} />
    </div>
  );
};
