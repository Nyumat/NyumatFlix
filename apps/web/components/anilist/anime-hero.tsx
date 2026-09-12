import { getGenreName } from "@/components/content/genre-helpers";
import { FeatureHeroBackdrop } from "@/components/hero/feature-hero-backdrop";
import { FeatureHeroWatchlistInfoPill } from "@/components/hero/feature-hero-watchlist-info-pill";
import { pages } from "@/config/pages";
import type { MediaItem } from "@/lib/domain/typings";
import { tmdbImage } from "@/tmdb/utils";
import { Calendar, Clapperboard, Play, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type AnimeHeroProps = {
  items: MediaItem[];
  label: string;
  count?: number;
  priority?: boolean;
};

type AnimeHeroItem = MediaItem & {
  href?: string;
  sourceAnilistId?: number;
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const getNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getTitle = (item: AnimeHeroItem) =>
  getString("title" in item ? item.title : undefined) ||
  getString("name" in item ? item.name : undefined);

const getYear = (item: AnimeHeroItem) => {
  const date =
    getString("first_air_date" in item ? item.first_air_date : undefined) ||
    getString("release_date" in item ? item.release_date : undefined);

  return date.length >= 4 ? date.slice(0, 4) : null;
};

const getHref = (item: AnimeHeroItem) => {
  if ("href" in item && typeof item.href === "string") return item.href;
  return item.media_type === "movie"
    ? `${pages.movie.root.link}/${item.id}`
    : `${pages.tv.root.link}/${item.id}`;
};

const isInternalDetailHref = (href: string) =>
  /^\/(?:movies|tvshows|anime)\/[^/?#]+(?:[?#].*)?$/.test(href);

const getPlayHref = (item: AnimeHeroItem) => {
  const href = getHref(item);
  if (!isInternalDetailHref(href)) return null;

  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("autoplay", "true");

  return `${path}?${params.toString()}`;
};

export const AnimeHero = ({
  items,
  label,
  count = 1,
  priority,
}: AnimeHeroProps) =>
  items.slice(0, count).map((item) => {
    const heroItem = item as AnimeHeroItem;
    const title = getTitle(heroItem);
    const detailHref = getHref(heroItem);
    const hasDetailHref = isInternalDetailHref(detailHref);
    const playHref = getPlayHref(heroItem);
    const logo = heroItem.logo;
    const rating = getNumber(
      "vote_average" in heroItem ? heroItem.vote_average : undefined,
    );
    const year = getYear(heroItem);
    const mediaType = heroItem.media_type === "movie" ? "movie" : "tv";
    const primaryGenreId = heroItem.genre_ids?.[0];
    const primaryGenre = primaryGenreId
      ? getGenreName(primaryGenreId, mediaType)
      : null;
    const backdropPath =
      getString(item.backdrop_path) || getString(item.poster_path);
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
    const overview = getString(item.overview).trim();

    return (
      <div
        className="index-bleed relative isolate mb-4 h-[85dvh] overflow-visible lg:mb-12"
        key={item.id}
      >
        {backdropUrl ? (
          <FeatureHeroBackdrop imageUrl={backdropUrl} priority={priority} />
        ) : null}

        <div className="absolute inset-0 z-20 flex items-end px-6 pb-20 lg:px-16 lg:pb-24">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 text-center text-white lg:mx-0 lg:items-start lg:gap-6 lg:text-left">
            <span className="sr-only">{label}</span>

            {logo ? (
              <Image
                src={tmdbImage.logo(logo.file_path, "w500")}
                alt={title}
                height={logoHeight}
                width={logoWidth}
                className="h-auto max-h-28 w-auto max-w-full origin-center object-contain drop-shadow-2xl lg:max-h-48 lg:origin-left"
                priority={priority}
              />
            ) : (
              <h2 className="max-w-2xl text-balance text-4xl font-semibold leading-none text-white drop-shadow-2xl sm:text-5xl lg:text-6xl">
                {title}
              </h2>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold text-white drop-shadow-lg lg:justify-start lg:text-base">
              {rating && rating > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="size-4 fill-white text-white" aria-hidden />
                  {rating.toFixed(1)}/10
                </span>
              ) : null}

              {year ? (
                <>
                  {rating && rating > 0 ? (
                    <span aria-hidden="true">•</span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="size-4" aria-hidden />
                    {year}
                  </span>
                </>
              ) : null}

              {primaryGenre && primaryGenre !== "Unknown" ? (
                <>
                  {rating || year ? <span aria-hidden="true">•</span> : null}
                  <span className="inline-flex items-center gap-1.5">
                    <Clapperboard className="size-4" aria-hidden />
                    {primaryGenre}
                  </span>
                </>
              ) : null}
            </div>

            {overview ? (
              <p className="line-clamp-2 max-w-xl text-pretty text-base font-medium leading-5 text-white drop-shadow-lg md:line-clamp-3 lg:text-lg lg:leading-7">
                {overview}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {playHref ? (
                <Link
                  href={playHref}
                  className="inline-flex h-[52px] min-w-[130px] items-center justify-center rounded-full border border-white/80 bg-white/95 px-6 text-lg font-bold text-black shadow-lg shadow-black/25 transition hover:bg-white"
                >
                  <Play className="mr-2 size-5 fill-black text-black" />
                  Play
                </Link>
              ) : null}

              {hasDetailHref ? (
                <FeatureHeroWatchlistInfoPill
                  contentId={heroItem.id}
                  mediaType={mediaType}
                  detailHref={detailHref}
                  title={title}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  });
