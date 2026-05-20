import {
  MediaBackdrop,
  mediaMetaBadgeClass,
} from "@/components/media/media-shared";
import { Badge } from "@/components/ui/badge";
import { pages } from "@/config";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/tmdb/utils";
import type { MediaItem } from "@/utils/typings";
import { Info, Play } from "lucide-react";
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
  genres?: Array<{ id: number; name?: string }>;
  sourceAnilistId?: number;
};

const getString = (value: unknown) => (typeof value === "string" ? value : "");

const getTitle = (item: AnimeHeroItem) =>
  getString("title" in item ? item.title : undefined) ||
  getString("name" in item ? item.name : undefined);

const getHref = (item: AnimeHeroItem) => {
  if ("href" in item && typeof item.href === "string") return item.href;
  return item.media_type === "movie"
    ? `${pages.movie.root.link}/${item.id}`
    : `${pages.tv.root.link}/${item.id}`;
};

const isInternalDetailHref = (href: string) =>
  /^\/(?:movies|tvshows)\/[^/?#]+(?:[?#].*)?$/.test(href);

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
    const genres = Array.isArray(heroItem.genres) ? heroItem.genres : [];
    const logo = heroItem.logo;

    return (
      <div className="h-hero relative isolate" key={item.id}>
        <div className="absolute inset-0">
          <MediaBackdrop
            image={
              getString(item.backdrop_path) ||
              getString(item.poster_path) ||
              undefined
            }
            alt={title}
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
                className="mx-auto my-2 w-[min(58%,15rem)] md:my-2 md:w-[min(48%,14rem)] lg:w-[min(42%,15rem)]"
                alt={title}
                height={logo.height}
                width={logo.width}
              />
            ) : (
              <h2 className="line-clamp-2 text-xl font-medium leading-tight tracking-tighter md:text-3xl lg:text-4xl">
                {title}
              </h2>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2">
              {genres.slice(0, 3).map((genre) => (
                <Badge
                  variant="secondary"
                  className={cn(mediaMetaBadgeClass, "select-none font-medium")}
                  key={genre.id}
                >
                  {genre.name}
                </Badge>
              ))}
            </div>

            <p className="mx-auto line-clamp-3 max-w-xl text-sm text-muted-foreground md:text-lg">
              {getString(item.overview)}
            </p>

            <div className="flex items-center justify-center gap-3">
              {playHref ? (
                <Link
                  href={playHref}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/60 bg-white px-4 py-2 text-sm font-bold text-black shadow-lg transition hover:border-white/70 hover:bg-white/90 hover:shadow-xl"
                >
                  <Play className="mr-2 size-4 fill-black text-black" />
                  Play
                </Link>
              ) : null}

              {hasDetailHref ? (
                <Link
                  href={detailHref}
                  className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:border-white/40 hover:bg-white/20 hover:shadow-xl"
                >
                  <Info className="mr-2 size-4" />
                  See More
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  });
