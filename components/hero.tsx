"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Logo, MediaItem } from "@/utils/typings";
import Fade from "embla-carousel-fade";
import { Calendar, Clock, Globe, Info, Play, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { match, P } from "ts-pattern";
import { GenreBadge } from "./ui/genre-badge";

interface HeroProps {
  imageUrl: string;
  title: string;
  subtitle?: string;
  route?: string;
  logo?: Logo;
  hideTitle?: boolean;
}

function BackgroundImage({
  isFullPage,
  imageUrl,
  title,
  logo,
  hideTitle = false,
}: HeroProps & { isFullPage: boolean }) {
  const backgroundImage = imageUrl;
  return (
    <div
      className={`${
        isFullPage
          ? "fixed -mt-5 h-[100dvh] w-full"
          : "absolute w-full h-[40vh]"
      } z-0 overflow-hidden`}
    >
      <Image
        src={backgroundImage}
        alt={title}
        width={1920}
        height={1080}
        className="rounded-lg object-cover w-full h-full"
        priority
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/70 via-black/50 to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent opacity-70" />
      {!hideTitle && (isFullPage || logo) && title && (
        <div className="absolute inset-0 flex items-center justify-center">
          {logo ? (
            <div className="max-w-[300px] md:max-w-[500px] w-auto px-4">
              <Image
                src={`https://image.tmdb.org/t/p/w500${logo.file_path}`}
                alt={title}
                width={logo.width}
                height={logo.height}
                className="max-w-full h-auto"
              />
            </div>
          ) : (
            <div className="text-center my-12 mt-44">
              {logo ? (
                <div className="flex justify-center items-center">
                  <Image
                    src={logo}
                    alt={title}
                    width={400}
                    height={200}
                    className="max-w-full h-auto"
                    priority
                  />
                </div>
              ) : (
                <h1 className="text-6xl md:text-7xl font-bold text-foreground tracking-tight px-4">
                  {title}
                </h1>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StaticHero({
  imageUrl,
  title,
  route,
  logo,
  hideTitle = false,
}: HeroProps) {
  const pathname = usePathname();
  const isSearchPage = pathname === "/search" || !!route;
  const isBrowsePage = pathname.includes("/browse");
  const isLegalPage =
    pathname.includes("/terms") ||
    pathname.includes("/privacy") ||
    pathname.includes("/cookie-policy") ||
    pathname.includes("/dmca");
  const isFullPageBackground = isSearchPage || isBrowsePage || isLegalPage;

  return (
    <>
      <BackgroundImage
        isFullPage={isFullPageBackground}
        imageUrl={imageUrl}
        title={route || title}
        logo={logo}
        hideTitle={hideTitle}
      />
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 opacity-70 -z-10" />
    </>
  );
}

interface MediaCarouselProps {
  items: MediaItem[];
}

function MediaInfoDialog({
  isOpen,
  onClose,
  media,
}: {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem;
}) {
  const titleText = match(media)
    .with({ title: P.string }, (movie) => movie.title)
    .otherwise((tvShow) => tvShow.name);

  const year = match(media)
    .with(
      {
        title: P.string,
        release_date: P.string.optional(),
      },
      (movie) => movie.release_date?.substring(0, 4),
    )
    .with(
      {
        name: P.string,
        first_air_date: P.string.optional(),
      },
      (tvShow) => tvShow.first_air_date?.substring(0, 4),
    )
    .otherwise(() => undefined);

  const isMovie = "title" in media;
  const mediaType = isMovie ? "Movie" : "TV Show";

  // Safely access enhanced properties
  const runtime =
    "runtime" in media
      ? (media as MediaItem & { runtime?: number }).runtime
      : undefined;
  const contentRating =
    "content_rating" in media
      ? (media as MediaItem & { content_rating?: string }).content_rating
      : undefined;
  const genres =
    "genres" in media
      ? (media as MediaItem & { genres?: Array<{ id: number; name: string }> })
          .genres
      : undefined;

  const formatRuntime = (minutes?: number) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${remainingMinutes}m`;
  };

  const href = match(media)
    .with({ title: P.string, id: P.number }, (movie) => `/movies/${movie.id}`)
    .with({ name: P.string, id: P.number }, (tvShow) => `/tvshows/${tvShow.id}`)
    .otherwise(() => "#");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "w-[95vw] max-w-4xl max-h-[90vh] mx-4",
          "bg-black/60 backdrop-blur-md border border-white/20 shadow-xl",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-xl md:text-2xl font-bold text-white">
            {titleText}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          {/* Poster */}
          <div className="flex-shrink-0">
            <div className="relative w-32 h-48 md:w-48 md:h-72 mx-auto md:mx-0 rounded-lg overflow-hidden shadow-xl">
              <Image
                src={`https://image.tmdb.org/t/p/w342${media.poster_path}`}
                alt={titleText}
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <ScrollArea className="h-[40vh] md:h-[50vh] pr-2 md:pr-4">
              {/* Metadata Card */}
              <div
                className={cn(
                  "bg-black/30 backdrop-blur-md border border-white/20 rounded-lg p-4 mb-4 shadow-lg",
                  "flex flex-wrap items-center gap-3",
                )}
              >
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  <span className="font-semibold text-sm md:text-base text-white">
                    {media.vote_average.toFixed(1)}/10
                  </span>
                </div>

                {year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-300" />
                    <span className="text-sm md:text-base text-white">
                      {year}
                    </span>
                  </div>
                )}

                {runtime && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-gray-300" />
                    <span className="text-sm md:text-base text-white">
                      {formatRuntime(runtime)}
                    </span>
                  </div>
                )}

                <Badge
                  variant="outline"
                  className="text-xs md:text-sm bg-white/10 border-white/20 text-white"
                >
                  {mediaType}
                </Badge>

                {contentRating && (
                  <Badge
                    variant="outline"
                    className="text-xs md:text-sm bg-white/15 border-white/30 text-white"
                  >
                    {contentRating}
                  </Badge>
                )}
              </div>

              {/* Genres */}
              {genres && genres.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-semibold mb-2 text-sm md:text-base text-white">
                    Genres
                  </h4>
                  <div className="flex flex-wrap gap-1 md:gap-2 pl-2">
                    {genres.map((genre) => (
                      <GenreBadge
                        key={genre.id}
                        genreId={genre.id}
                        className="text-xs md:text-sm bg-white/10 border-white/20 text-white"
                        genreName={genre.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Overview */}
              <div className="mb-4">
                <h4 className="font-semibold mb-2 text-sm md:text-base text-white">
                  Overview
                </h4>
                <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                  {media.overview}
                </p>
              </div>

              {/* Additional Info Card */}
              <div
                className={cn(
                  "bg-black/30 backdrop-blur-md border border-white/20 rounded-lg p-4 mb-4 shadow-lg",
                  "grid grid-cols-1 sm:grid-cols-2 gap-4",
                )}
              >
                <div>
                  <h4 className="font-semibold mb-1 text-sm md:text-base text-white">
                    Language
                  </h4>
                  <p className="text-xs md:text-sm text-gray-300 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {media.original_language?.toUpperCase()}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-1 text-sm md:text-base text-white">
                    Popularity
                  </h4>
                  <p className="text-xs md:text-sm text-gray-300">
                    {Math.round(media.popularity)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  asChild
                  className={cn(
                    "flex-1 font-bold transition-all duration-200 shadow-lg",
                    "backdrop-blur-md bg-white/20 border border-white/30 text-white",
                    "hover:bg-white/30 hover:border-white/40 hover:shadow-xl",
                  )}
                >
                  <Link
                    href={href}
                    className="flex items-center justify-center"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Watch Now
                  </Link>
                </Button>
                <Button
                  asChild
                  className={cn(
                    "flex-1 font-bold transition-all duration-200 shadow-lg",
                    "backdrop-blur-md bg-white/10 border border-white/30 text-white",
                    "hover:bg-white/20 hover:border-white/40 hover:shadow-xl",
                  )}
                >
                  <Link
                    href={href}
                    className="flex items-center justify-center"
                  >
                    <Info className="mr-2 h-4 w-4" />
                    View Details
                  </Link>
                </Button>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CarouselDetails({
  current,
  items,
  onPosterClick,
}: {
  current: MediaItem;
  items: MediaItem[];
  onPosterClick: (index: number) => void;
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();

  const titleText = match(current)
    .with({ title: P.string }, (movie) => movie.title)
    .otherwise((tvShow) => tvShow.name);

  const year = match(current)
    .with({ title: P.string, release_date: P.string.optional() }, (movie) =>
      movie.release_date?.substring(0, 4),
    )
    .with({ name: P.string, first_air_date: P.string.optional() }, (tvShow) =>
      tvShow.first_air_date?.substring(0, 4),
    )
    .otherwise(() => undefined);

  const href = match(current)
    .with({ title: P.string, id: P.number }, (movie) => `/movies/${movie.id}`)
    .with({ name: P.string, id: P.number }, (tvShow) => `/tvshows/${tvShow.id}`)
    .otherwise(() => "#");

  useEffect(() => {
    if (carouselApi) {
      const currentIndex = items.findIndex((item) => item.id === current.id);
      if (currentIndex !== -1) {
        carouselApi.scrollTo(currentIndex);
      }
    }
  }, [current, items, carouselApi]);

  return (
    <>
      <div className="absolute bottom-0 left-0 p-4 md:p-8 lg:p-12 w-full md:w-3/4 lg:w-1/2">
        <div className={cn("p-4 rounded-lg")}>
          {current.logo ? (
            <div className={`mb-4 max-w-[250px] md:max-w-[350px] w-full`}>
              <Image
                src={`https://image.tmdb.org/t/p/w500${current.logo.file_path}`}
                alt={titleText}
                width={current.logo.width}
                height={current.logo.height}
                className="w-full h-auto object-contain"
              />
            </div>
          ) : (
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 shadow-black/50 text-shadow-lg">
              {titleText}
            </h1>
          )}

          <div className="flex items-center mb-4 space-x-4">
            <div className="flex items-center space-x-1">
              <Star className="text-yellow-400 w-5 h-5" />
              <span className="text-white font-semibold">
                {current.vote_average.toFixed(1)}
              </span>
            </div>
            {year && <span className="text-gray-300">{year}</span>}
          </div>

          <p className="text-white/90 text-sm md:text-base max-w-xl mb-6 line-clamp-2 md:line-clamp-3">
            {current.overview}
          </p>

          <div className="flex items-center space-x-4 mb-6">
            <Button
              asChild
              size="lg"
              className={cn(
                "font-bold transition-all duration-200 shadow-lg",
                "backdrop-blur-md bg-white/20 border border-white/30 text-white",
                "hover:bg-white/30 hover:border-white/40 hover:shadow-xl",
              )}
            >
              <Link href={href}>
                <Play className="mr-2 h-5 w-5" />
                Play
              </Link>
            </Button>
            <Button
              size="lg"
              onClick={() => setShowDialog(true)}
              className={cn(
                "font-bold transition-all duration-200 shadow-lg",
                "backdrop-blur-md bg-white/10 border border-white/30 text-white",
                "hover:bg-white/20 hover:border-white/40 hover:shadow-xl",
              )}
            >
              <Info className="mr-2 h-5 w-5" />
              More Info
            </Button>
          </div>

          <div className="relative">
            <Carousel
              setApi={setCarouselApi}
              opts={{
                align: "start",
                loop: false,
                skipSnaps: true,
                dragFree: true,
              }}
              className="w-full"
            >
              <CarouselContent className="-ml-3">
                {items.map((item, index) => {
                  const isActive = item.id === current.id;
                  const itemTitle = match(item)
                    .with({ title: P.string }, (m) => m.title)
                    .otherwise((t) => t.name);

                  return (
                    <CarouselItem
                      key={item.id}
                      className="pl-3 basis-1/4 md:basis-1/5 lg:basis-1/6"
                      onClick={() => onPosterClick(index)}
                    >
                      <div className="flex flex-col items-center text-center cursor-pointer group">
                        <div
                          className={`relative w-full aspect-[2/3] rounded-lg overflow-hidden transition-all duration-300 transform-gpu ${
                            isActive
                              ? "border-2 border-primary"
                              : "border-2 border-transparent"
                          }`}
                        >
                          <Image
                            src={`https://image.tmdb.org/t/p/w185${item.poster_path}`}
                            alt={itemTitle}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <p
                          className={`mt-2 text-xs font-medium text-white transition-opacity duration-300 line-clamp-2 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                        >
                          {itemTitle}
                        </p>
                      </div>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              <CarouselNext className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white z-10" />
            </Carousel>
          </div>
        </div>
      </div>

      <MediaInfoDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        media={current}
      />
    </>
  );
}

export function MediaCarousel({ items }: MediaCarouselProps) {
  const [mainCarouselApi, setMainCarouselApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Use useEffect with proper cleanup to prevent memory leaks
  useEffect(() => {
    if (!mainCarouselApi) return;

    const onSelect = () => {
      if (mainCarouselApi.selectedScrollSnap() !== currentIndex) {
        setCurrentIndex(mainCarouselApi.selectedScrollSnap());
      }
    };

    mainCarouselApi.on("select", onSelect);

    // Auto-advance carousel
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        mainCarouselApi.scrollNext();
      }
    }, 7000);

    // Clean up event listeners and interval
    return () => {
      mainCarouselApi.off("select", onSelect);
      clearInterval(interval);
    };
  }, [mainCarouselApi, currentIndex]);

  const handlePosterClick = (index: number) => {
    if (mainCarouselApi && index !== currentIndex) {
      setCurrentIndex(index);
      mainCarouselApi.scrollTo(index);
    }
  };

  return (
    <div className="relative h-[90vh] overflow-hidden bg-black">
      <Carousel
        className="w-full h-full"
        setApi={setMainCarouselApi}
        plugins={[Fade()]}
        opts={{ loop: true, duration: 50, containScroll: "trimSnaps" }}
      >
        <CarouselContent className="!ml-0 h-full">
          {items.map((item, index) => (
            <CarouselItem key={item.id} className="pl-0 h-full">
              <div className="relative w-full h-full z-50">
                {item.backdrop_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/original${item.backdrop_path}`}
                    alt={match(item)
                      .with({ title: P.string }, (movie) => movie.title)
                      .with({ name: P.string }, (tvShow) => tvShow.name)
                      .otherwise(() => "Media Item")}
                    width={1920}
                    height={1080}
                    priority={index <= 2}
                    className="object-cover brightness-75 z-50"
                    onError={(e) => {
                      console.error(
                        "Failed to load backdrop image:",
                        item.backdrop_path,
                      );
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {items[currentIndex] && (
        <CarouselDetails
          current={items[currentIndex]}
          items={items}
          onPosterClick={handlePosterClick}
        />
      )}

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 z-10">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => handlePosterClick(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              currentIndex === index ? "w-4 bg-primary" : "bg-white/50"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
