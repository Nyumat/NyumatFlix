import { getGenreName } from "@/components/content/genre-helpers";
import { FeatureHeroBackdrop } from "@/components/hero/feature-hero-backdrop";
import { FeatureHeroWatchlistInfoPill } from "@/components/hero/feature-hero-watchlist-info-pill";
import { pages } from "@/config/pages";
import { tmdbImage } from "@/tmdb/utils";
import { Calendar, Clapperboard, Play, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type FeatureLogoSeed = {
  file_path?: string | null;
  iso_639_1?: string | null;
  width?: number;
  height?: number;
  aspect_ratio?: number;
};

type FeatureLogo = FeatureLogoSeed & {
  file_path: string;
};

export type IndexFeatureHeroItem = {
  id: number;
  title?: string | null;
  name?: string | null;
  overview?: string | null;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
  runtime?: number | null;
  number_of_seasons?: number | null;
  genre_ids?: number[] | null;
  genres?: Array<{ id: number; name: string }> | null;
  images?: {
    logos?: FeatureLogoSeed[] | null;
  } | null;
};

type IndexFeatureHeroProps = {
  mediaType: "movie" | "tv";
  item: IndexFeatureHeroItem;
  label?: string;
  priority?: boolean;
};

const getTitle = (item: IndexFeatureHeroItem, mediaType: "movie" | "tv") =>
  mediaType === "movie"
    ? (item.title ?? item.name ?? "")
    : (item.name ?? item.title ?? "");

const getLogo = (item: IndexFeatureHeroItem) => {
  const logos = item.images?.logos ?? [];
  const isUsable = (
    logo: FeatureLogoSeed | null | undefined,
  ): logo is FeatureLogo => Boolean(logo?.file_path);

  return (
    logos.find(
      (logo): logo is FeatureLogo => isUsable(logo) && logo.iso_639_1 === "en",
    ) ??
    logos.find(
      (logo): logo is FeatureLogo => isUsable(logo) && !logo.iso_639_1,
    ) ??
    logos.find(isUsable)
  );
};

const getYear = (item: IndexFeatureHeroItem, mediaType: "movie" | "tv") => {
  const date =
    mediaType === "movie"
      ? item.release_date
      : (item.first_air_date ?? item.release_date);
  return typeof date === "string" && date.length >= 4 ? date.slice(0, 4) : null;
};

const getGenres = (item: IndexFeatureHeroItem, mediaType: "movie" | "tv") => {
  if (item.genres?.length) return item.genres;

  return (item.genre_ids ?? [])
    .map((genreId) => ({
      id: genreId,
      name: getGenreName(genreId, mediaType),
    }))
    .filter((genre) => genre.name !== "Unknown" && genre.name !== "N/A");
};

const getDetailHref = (item: IndexFeatureHeroItem, mediaType: "movie" | "tv") =>
  `${mediaType === "movie" ? pages.movie.root.link : pages.tv.root.link}/${item.id}`;

const getCatalogHref = (mediaType: "movie" | "tv", genreId: number) =>
  `${
    mediaType === "movie" ? pages.movie.catalog.link : pages.tv.catalog.link
  }?view=discover&with_genres=${genreId}&mode=results`;

export function IndexFeatureHero({
  mediaType,
  item,
  label,
  priority,
}: IndexFeatureHeroProps) {
  const title = getTitle(item, mediaType);
  const logo = getLogo(item);
  const rating =
    typeof item.vote_average === "number" && item.vote_average > 0
      ? item.vote_average.toFixed(1)
      : null;
  const year = getYear(item, mediaType);
  const primaryGenre = getGenres(item, mediaType)[0];
  const detailHref = getDetailHref(item, mediaType);
  const overview = item.overview?.trim();
  const backdropPath = item.backdrop_path ?? item.poster_path;
  const backdropUrl = backdropPath
    ? tmdbImage.backdrop(backdropPath, "w1280")
    : null;
  const logoWidth = logo?.width && logo.width > 0 ? logo.width : 500;
  const logoHeight =
    logo?.height && logo.height > 0
      ? logo.height
      : logo?.aspect_ratio && logo.aspect_ratio > 0
        ? Math.round(logoWidth / logo.aspect_ratio)
        : 281;

  if (!title) return null;

  return (
    <section className="index-bleed relative isolate mb-4 h-[85dvh] w-auto overflow-visible lg:mb-12">
      {backdropUrl ? (
        <FeatureHeroBackdrop imageUrl={backdropUrl} priority={priority} />
      ) : null}

      <div className="absolute inset-0 z-20 flex items-end px-6 pb-20 lg:px-16 lg:pb-24">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 text-center text-white lg:mx-0 lg:items-start lg:gap-6 lg:text-left">
          {label ? <span className="sr-only">{label}</span> : null}

          {logo ? (
            <>
              <h2 className="sr-only">{title}</h2>
              <Image
                src={tmdbImage.logo(logo.file_path, "w500")}
                alt={title}
                width={logoWidth}
                height={logoHeight}
                className="h-auto max-h-28 w-auto max-w-full origin-center object-contain drop-shadow-2xl lg:max-h-48 lg:origin-left"
                priority={priority}
              />
            </>
          ) : (
            <h2 className="max-w-2xl text-balance text-4xl font-semibold leading-none text-white drop-shadow-2xl sm:text-5xl lg:text-6xl">
              {title}
            </h2>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold text-white drop-shadow-lg lg:justify-start lg:text-base">
            {rating ? (
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-4 fill-white text-white" aria-hidden />
                {rating}/10
              </span>
            ) : null}

            {year ? (
              <>
                {rating ? <span aria-hidden="true">•</span> : null}
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-4" aria-hidden />
                  {year}
                </span>
              </>
            ) : null}

            {primaryGenre ? (
              <>
                {rating || year ? <span aria-hidden="true">•</span> : null}
                <Link
                  className="inline-flex items-center gap-1.5 text-white transition hover:text-white/80"
                  href={getCatalogHref(mediaType, primaryGenre.id)}
                >
                  <Clapperboard className="size-4" aria-hidden />
                  {primaryGenre.name}
                </Link>
              </>
            ) : null}
          </div>

          {overview ? (
            <p className="line-clamp-2 max-w-xl text-pretty text-base font-medium leading-5 text-white drop-shadow-lg md:line-clamp-3 lg:text-lg lg:leading-7">
              {overview}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href={`${detailHref}?autoplay=true`}
              className="inline-flex h-[52px] min-w-[130px] items-center justify-center rounded-full border border-white/80 bg-white/95 px-6 text-lg font-bold text-black shadow-lg shadow-black/25 transition hover:bg-white"
            >
              <Play className="mr-2 size-5 fill-black text-black" />
              Play
            </Link>

            <FeatureHeroWatchlistInfoPill
              contentId={item.id}
              mediaType={mediaType}
              detailHref={detailHref}
              title={title}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
