"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Logo, MediaItem } from "@/utils/typings";
import Fade from "embla-carousel-fade";
import { Info, Play } from "lucide-react";
import Image from "next/legacy/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { match, P } from "ts-pattern";
import { Button } from "./ui/button";

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
        layout="fill"
        objectFit="cover"
        objectPosition="center center"
        priority
        className="rounded-lg"
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
                layout="responsive"
                objectFit="contain"
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

function CarouselDetails({ current }: { current: MediaItem }) {
  const titleText = match(current)
    .with({ title: P.string }, (movie) => movie.title)
    .otherwise((tvShow) => tvShow.name);

  const year = match(current)
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

  const href = match(current)
    .with({ title: P.string, id: P.number }, (movie) => `/movies/${movie.id}`)
    .with({ name: P.string, id: P.number }, (tvShow) => `/tvshows/${tvShow.id}`)
    .otherwise(() => "#");

  return (
    <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 flex flex-col items-start pointer-events-none">
      {current.logo ? (
        <div className={`mb-2 max-w-[200px] md:max-w-[300px] w-full`}>
          <Image
            src={`https://image.tmdb.org/t/p/w342${current.logo.file_path}`}
            alt={titleText}
            width={current.logo.width}
            height={current.logo.height}
            layout="responsive"
            objectFit="contain"
          />
        </div>
      ) : (
        <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-2">
          {titleText}
        </h1>
      )}

      <div className="flex items-center mb-4 space-x-4">
        <div className="flex items-center space-x-1">
          <span className="text-yellow-400">★</span>
          <span className="text-white">{current.vote_average.toFixed(1)}</span>
        </div>

        {year && <span className="text-gray-300">{year}</span>}
      </div>

      <p className="text-white/80 text-sm md:text-base max-w-2xl mb-6 line-clamp-2 md:line-clamp-3">
        {current.overview}
      </p>

      <div className="flex items-center space-x-4 pointer-events-auto">
        <Button asChild>
          <Link
            href={href}
            className="bg-primary hover:bg-primary/80 text-white font-semibold py-2 px-6 rounded transition-colors"
          >
            <Play className="mr-2 h-5 w-5" />
            <span>Play</span>
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link
            href={href}
            className="bg-secondary/20 hover:bg-secondary/40 text-white font-semibold py-2 px-6 rounded transition-colors"
          >
            <Info className="mr-2 h-5 w-5" />
            <span>More Info</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function MediaCarousel({ items }: MediaCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const handleSizeChange = () => {
    setIsMobile(window.innerWidth < 768);
  };

  useEffect(() => {
    handleSizeChange();
    window.addEventListener("resize", handleSizeChange);
    return () => window.removeEventListener("resize", handleSizeChange);
  }, []);

  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrentIndex(api.selectedScrollSnap());
    };

    api.on("select", onSelect);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        if (api.canScrollNext()) {
          api.scrollNext();
        } else {
          api.scrollTo(0);
        }
      }
    }, 7000);

    return () => {
      api.off("select", onSelect);
      clearInterval(interval);
    };
  }, [api]);

  return (
    <div className="relative">
      <Carousel
        className="w-full"
        setApi={setApi}
        plugins={[Fade()]}
        opts={{ loop: true, containScroll: false, duration: 300 }}
      >
        <CarouselContent className="!ml-0">
          {items.map((item, index) => (
            <CarouselItem key={item.id} className="pl-0">
              <div className="relative w-full md:h-[60vh] xl:h-[60vh] h-[70vh]">
                <Image
                  src={`https://image.tmdb.org/t/p/original${item.backdrop_path}`}
                  alt={match(item)
                    .with({ title: P.string }, (movie) => movie.title)
                    .with({ name: P.string }, (tvShow) => tvShow.name)
                    .otherwise(() => "Media Item")}
                  layout="fill"
                  objectFit="cover"
                  priority={index === 0}
                  className="brightness-50 select-none pointer-events-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-20" />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Details and Overlays moved outside of CarouselContent to prevent hydration issues */}
      {items[currentIndex] && <CarouselDetails current={items[currentIndex]} />}

      {isMobile && items[currentIndex] && (
        <div className="md:hidden absolute bottom-72 sm:bottom-52 right-4 w-32 h-48 rounded-lg overflow-hidden shadow-lg pointer-events-auto xs:bottom-40">
          <Link
            href={match(items[currentIndex])
              .with(
                { title: P.string, id: P.number },
                (movie) => `/movies/${movie.id}`,
              )
              .with(
                { name: P.string, id: P.number },
                (tvShow) => `/tvshows/${tvShow.id}`,
              )
              .otherwise(() => "#")}
          >
            <div className="relative w-full h-full">
              <Image
                src={`https://image.tmdb.org/t/p/w500${items[currentIndex].poster_path}`}
                alt={match(items[currentIndex])
                  .with({ title: P.string }, (movie) => movie.title)
                  .with({ name: P.string }, (tvShow) => tvShow.name)
                  .otherwise(() => "Media Poster")}
                layout="fill"
                objectFit="cover"
                priority
                className="pt-12"
              />
            </div>
          </Link>
        </div>
      )}

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 z-10">
        {items.map((_, index) => (
          <button
            key={index}
            onClick={() => api?.scrollTo(index)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              currentIndex === index ? "bg-primary" : "bg-white/50"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
