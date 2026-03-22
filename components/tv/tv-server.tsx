import React from "react";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { pages } from "@/config";
import { Episode, SeasonDetails, TvShow, TvShowDetails } from "@/tmdb/models";
import { tmdb } from "@/tmdb/api";
import { TvListType, WithCredits, WithImages, WithVideos } from "@/tmdb/api";
import { format, tmdbImage } from "@/tmdb/utils";
import { ArrowRight, Calendar, Clock } from "lucide-react";

import {
  formatValue,
  getRandomItems,
  getUniqueItems,
  getUserTimezone,
  pad,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { TabsProps } from "@radix-ui/react-tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaImages } from "@/components/media";
import {
  MediaBackdrop,
  MediaCreditsList,
  MediaRating,
  MediaVideos,
} from "@/components/media/media-shared";
import { MediaWatchProviders } from "@/components/media/media-watch-providers";
import { ListPagination } from "@/components/shared/list-pagination";
import { TvCard } from "./tv-card";

interface TvHeroItemProps {
  id: string;
  label?: string;
  priority?: boolean;
}

export const TvHeroItem: React.FC<TvHeroItemProps> = async ({
  id,
  label,
  priority,
}) => {
  const item = await tmdb.tv.detail<WithImages>({ id, append: "images" });
  const logo = item.images?.logos.find((logo) => logo.iso_639_1 === "en");

  return (
    <div className="h-hero relative isolate" key={item.id}>
      <div className="absolute inset-0">
        <MediaBackdrop
          image={item.backdrop_path}
          alt={item.name}
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
              alt={item.name}
              height={logo.height}
              width={logo.width}
              unoptimized
            />
          ) : (
            <h1 className="line-clamp-2 text-xl font-medium leading-tight tracking-tighter md:text-3xl lg:text-4xl">
              {item.name}
            </h1>
          )}

          <div>
            <MediaRating average={item.vote_average} count={item.vote_count} />
            {item.genres.map((genre) => (
              <Link
                href={`${pages.tv.catalog.link}?view=discover&with_genres=${genre.id}&mode=results`}
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
              href={`${pages.tv.root.link}/${item.id}`}
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

interface TvHeroProps {
  tvShows: TvShow[];
  label: string;
  count?: number;
  priority?: boolean;
  pick?: "random" | "first";
}

export const TvHero: React.FC<TvHeroProps> = ({
  tvShows,
  label,
  count = 1,
  priority,
  pick = "random",
}) => {
  const items =
    pick === "first"
      ? tvShows.slice(0, Math.min(count, tvShows.length))
      : getRandomItems(tvShows, count);

  return items.map((item) => (
    <TvHeroItem
      key={item.id}
      id={item.id.toString()}
      label={label}
      priority={priority}
    />
  ));
};

export const TvEpisodeCard: React.FC<Episode> = ({
  id,
  name,
  episode_number,
  still_path,
  vote_average,
  vote_count,
  air_date,
  overview,
  runtime,
  season_number,
  show_id,
}) => {
  return (
    <div className="flex flex-col md:flex-row">
      <Link
        href={`${pages.tv.root.link}/${show_id}/seasons/${season_number}/episodes/${episode_number}`}
        className="relative aspect-video md:w-72"
        key={id}
      >
        <MediaBackdrop image={still_path} alt={name} size="w780" />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link
          href={`${pages.tv.root.link}/${show_id}/seasons/${season_number}/episodes/${episode_number}`}
        >
          <h3 className="flex items-center gap-2 font-medium">
            {pad(episode_number)}. {name}
          </h3>
        </Link>

        <div
          className="mb-4 mt-1 line-clamp-6 space-y-2 text-sm leading-relaxed text-muted-foreground"
          dangerouslySetInnerHTML={{
            __html: format.content(overview || "<em>No details</em>"),
          }}
        />

        <div className="mt-auto flex items-center gap-2">
          <MediaRating
            average={vote_average}
            count={vote_count}
            className="leading-none"
          />

          <Badge variant="outline">
            <Clock className="inline size-3" />
            <span className="ml-2">{formatValue(runtime, format.runtime)}</span>
          </Badge>

          <Badge variant="outline">
            <Calendar className="inline size-3" />
            <span className="ml-2">{formatValue(air_date, format.date)}</span>
          </Badge>
        </div>
      </div>
    </div>
  );
};

interface TvSeasonBreadcrumbProps {
  id: string;
  showDetails: TvShowDetails;
  season: number;
  seasonDetails: SeasonDetails;
  episodeDetails?: Episode;
}

export const TvSeasonBreadcrumb = ({
  id,
  showDetails,
  season,
  seasonDetails,
  episodeDetails,
}: TvSeasonBreadcrumbProps) => {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`${pages.tv.root.link}/${id}`}>{showDetails.name}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href={`${pages.tv.root.link}/${id}`}>Seasons</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        <BreadcrumbSeparator />
        <BreadcrumbItem>
          {episodeDetails ? (
            <BreadcrumbLink asChild>
              <Link href={`${pages.tv.root.link}/${id}/seasons/${season}`}>
                {seasonDetails.name}
              </Link>
            </BreadcrumbLink>
          ) : (
            <BreadcrumbPage>{seasonDetails.name}</BreadcrumbPage>
          )}
        </BreadcrumbItem>

        {episodeDetails && (
          <Fragment>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {pad(episodeDetails.episode_number)}. {episodeDetails.name}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </Fragment>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

interface TvEpisodeDetailsProps extends TabsProps {
  id: string;
  season: number;
  episode: number;
}

export const TvEpisodeDetails = async ({
  id,
  season,
  episode,
  ...props
}: TvEpisodeDetailsProps) => {
  const { credits, guest_stars, images } = await tmdb.tvEpisodes.details<
    WithCredits & WithImages
  >({
    id,
    season,
    episode,
    append: "credits,images",
  });

  return (
    <Tabs defaultValue="images" {...props}>
      <TabsList>
        <TabsTrigger value="images">Images</TabsTrigger>
        <TabsTrigger value="credits">Cast</TabsTrigger>
      </TabsList>

      <TabsContent className="mt-4" value="images">
        <MediaImages backdrops={images?.stills} />
      </TabsContent>

      <TabsContent className="mt-4" value="credits">
        <MediaCreditsList
          cast={credits.cast}
          crew={credits.crew}
          guestStars={guest_stars}
        />
      </TabsContent>
    </Tabs>
  );
};

interface TvSeasonDetailsProps extends TabsProps {
  id: string;
  season: number;
}

export const TvSeasonDetails: React.FC<TvSeasonDetailsProps> = async ({
  id,
  season,
  ...props
}) => {
  const {
    episodes,
    videos: { results: videos },
    credits: { cast, crew },
    images: { backdrops, posters },
  } = await tmdb.tvSeasons.details<WithCredits & WithImages & WithVideos>({
    id,
    season,
    append: "credits,videos,images",
    langs: "en",
  });

  const guestStars = getUniqueItems(
    episodes.map((episode) => episode.guest_stars).flat(),
  );

  return (
    <Tabs defaultValue="episodes" {...props}>
      <div className="max-w-screen scrollbar-hidden -mx-8 overflow-x-scroll px-8 lg:m-0 lg:p-0">
        <TabsList>
          <TabsTrigger value="episodes">Episodes</TabsTrigger>
          <TabsTrigger value="watch">Watch</TabsTrigger>
          <TabsTrigger value="credits">Cast</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="episodes" className="mt-4">
        {episodes?.length ? (
          <div className="space-y-4">
            {episodes.map((episode) => (
              <TvEpisodeCard key={episode.id} {...episode} />
            ))}
          </div>
        ) : (
          <div className="empty-box">No episodes</div>
        )}
      </TabsContent>

      <TabsContent value="watch">
        <MediaWatchProviders id={id} season={season} type="tv" />
      </TabsContent>

      <TabsContent value="credits">
        <MediaCreditsList cast={cast} crew={crew} guestStars={guestStars} />
      </TabsContent>

      <TabsContent value="images">
        <MediaImages posters={posters} backdrops={backdrops} />
      </TabsContent>

      <TabsContent value="videos">
        <MediaVideos videos={videos} />
      </TabsContent>
    </Tabs>
  );
};

interface TvListProps {
  list: TvListType;
  page: string;
  title: string;
  description?: string;
}

export const TvList: React.FC<TvListProps> = async ({
  list,
  page,
  title,
  description,
}) => {
  const cookieStore = await cookies();
  const region = cookieStore.get("region")?.value ?? "US";
  const timezone = getUserTimezone();

  const {
    results,
    total_pages: totalPages,
    page: currentPage,
  } = await tmdb.tv.list({
    region,
    list,
    page,
    timezone,
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
        {results?.map((tvShow) => (
          <TvCard key={tvShow.id} {...tvShow} />
        ))}
      </div>

      <ListPagination currentPage={currentPage} totalPages={totalPages} />
    </div>
  );
};
