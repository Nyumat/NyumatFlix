"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { EnhancedLink } from "@/components/ui/enhanced-link";
import { Logo, MediaItem } from "@/utils/typings";
import Fade from "embla-carousel-fade";
import Image from "next/legacy/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { match, P } from "ts-pattern";

interface HeroProps {
  imageUrl: string;
  title: string;
  subtitle?: string;
  route?: string;
  logo?: Logo;
}

function BackgroundImage({
  isFullPage,
  imageUrl,
  title,
  logo,
}: HeroProps & { isFullPage: boolean }) {
  const backgroundImage = imageUrl;
  return (
    <div
      className={`${
        isFullPage ? "fixed -mt-5 h-screen w-full" : "absolute w-full h-[40vh]"
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
      {(isFullPage || logo) && title && (
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
            <h1 className="text-6xl md:text-7xl font-bold text-white tracking-tight px-4">
              {title}
            </h1>
          )}
        </div>
      )}
    </div>
  );
}

export function HeaderHero({ imageUrl, title, route, logo }: HeroProps) {
  const pathname = usePathname();
  const isSearchPage = pathname === "/search" || !!route;
  const isBrowsePage = pathname.includes("/browse");
  const isFullPageBackground = isSearchPage || isBrowsePage;

  return (
    <>
      <BackgroundImage
        isFullPage={isFullPageBackground}
        imageUrl={imageUrl}
        title={route || title}
        logo={logo}
      />
      <div className="absolute inset-0 bg-black opacity-70 -z-10" />
    </>
  );
}

interface TrendingHeroCarouselProps {
  items: MediaItem[];
}

function CarouselSlide({ item, index }: { item: MediaItem; index: number }) {
  return (
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
  );
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

  return (
    <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16 flex flex-col items-start pointer-events-none">
      {/* <Badge className="mb-4 bg-black/50 text-white backdrop-blur-sm">
        Now Playing
      </Badge> */}
      {current.logo ? (
        <div className="mb-2 max-w-[300px] md:max-w-[400px] w-full">
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
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
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

      <EnhancedLink
        href={match(current)
          .with(
            { title: P.string, id: P.number },
            (movie) => `/movies/${movie.id}`,
          )
          .with(
            { name: P.string, id: P.number },
            (tvShow) => `/tvshows/${tvShow.id}`,
          )
          .otherwise(() => "#")}
        className="bg-primary hover:bg-primary/80 text-white font-semibold py-2 px-6 rounded transition-colors pointer-events-auto"
        mediaItem={current}
        prefetchDelay={0}
      >
        Watch Now
      </EnhancedLink>
    </div>
  );
}

export function TrendingHeroCarousel({ items }: TrendingHeroCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const handleSizeChange = useCallback(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  useEffect(() => {
    handleSizeChange();
    window.addEventListener("resize", handleSizeChange);
    return () => window.removeEventListener("resize", handleSizeChange);
  }, [handleSizeChange]);

  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrentIndex(api.selectedScrollSnap());
    };

    api.on("select", onSelect);

    const interval = setInterval(() => {
      if (api.canScrollNext()) {
        api.scrollNext();
      } else {
        api.scrollTo(0);
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
            <CarouselSlide key={item.id} item={item} index={index} />
          ))}
        </CarouselContent>
      </Carousel>

      {items[currentIndex] && <CarouselDetails current={items[currentIndex]} />}

      {isMobile && items[currentIndex] && (
        <div className="md:hidden absolute bottom-72 sm:bottom-52 right-4 w-32 h-48 rounded-lg overflow-hidden shadow-lg pointer-events-auto xs:bottom-40">
          <EnhancedLink
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
            mediaItem={items[currentIndex]}
            prefetchDelay={0}
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
              />
            </div>
          </EnhancedLink>
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
