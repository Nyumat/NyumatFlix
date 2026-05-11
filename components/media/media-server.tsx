import { WatchlistItem } from "@/app/watchlist/actions";
import { MediaDetailHero } from "@/components/hero/index";
import type { TvHeroEpisodeData } from "@/components/hero/types";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { StableBackground } from "@/components/layout/stable-background";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { selectPrimaryTrailerVideo } from "@/lib/select-primary-trailer-video";
import { cn } from "@/lib/utils";
import type { Video } from "@/tmdb/models";
import { yt } from "@/tmdb/utils";
import { Episode, MediaItem } from "@/utils/typings";
import { Play } from "lucide-react";
import Link from "next/link";
import React, { type ComponentProps } from "react";

const DetailRoot: React.FC<ComponentProps<"div">> = ({
  className,
  ...props
}) => {
  return <div className={cn("overflow-hidden", className)} {...props} />;
};

const DetailBackdrop: React.FC<ComponentProps<"div">> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn("container", className)} {...props}>
      <div className="md:h-hero relative hidden aspect-poster w-full md:block">
        {children}
      </div>
    </div>
  );
};

const DetailHero: React.FC<ComponentProps<"div">> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn("container md:mt-8 md:px-16 xl:mt-12 xl:px-32", className)}
      {...props}
    >
      <div className="grid gap-4 md:grid-cols-[auto_1fr] md:gap-10 xl:gap-16">
        {children}
      </div>
    </div>
  );
};

const DetailPoster: React.FC<ComponentProps<"div">> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "relative aspect-poster w-full place-self-start md:-mt-32 md:block md:w-56 lg:w-64 xl:-mt-64 xl:w-80",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const DetailContent: React.FC<ComponentProps<"div">> = ({
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "container mt-4 md:mt-8 md:px-16 xl:mt-12 xl:px-32",
        className,
      )}
      {...props}
    />
  );
};

const DetailGenres: React.FC<ComponentProps<"div">> = ({
  className,
  ...props
}) => {
  return <div className={cn("flex flex-wrap gap-2", className)} {...props} />;
};

const DetailGenre: React.FC<BadgeProps> = ({
  variant = "secondary",
  ...props
}) => {
  return <Badge variant={variant} {...props} />;
};

const DetailTitle: React.FC<ComponentProps<"h1">> = ({
  className,
  ...props
}) => {
  return (
    <h1
      className={cn("text-2xl font-medium xl:text-4xl", className)}
      {...props}
    />
  );
};

const DetailOverview: React.FC<ComponentProps<"p">> = ({
  className,
  ...props
}) => {
  return (
    <div
      className={cn("space-y-4 text-muted-foreground xl:text-lg", className)}
      {...props}
    />
  );
};

export const MediaDetailView = {
  Root: DetailRoot,
  Backdrop: DetailBackdrop,
  Hero: DetailHero,
  Content: DetailContent,
  Poster: DetailPoster,
  Genres: DetailGenres,
  Genre: DetailGenre,
  Title: DetailTitle,
  Overview: DetailOverview,
};

export const SkeletonMediaDetail = () => (
  <MediaDetailView.Root>
    <MediaDetailView.Backdrop>
      <Skeleton className="size-full rounded-md" />
    </MediaDetailView.Backdrop>

    <MediaDetailView.Hero>
      <MediaDetailView.Poster>
        <Skeleton className="size-full rounded-md" />
      </MediaDetailView.Poster>

      <div className="space-y-4">
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-4 w-60 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
      </div>
    </MediaDetailView.Hero>

    <MediaDetailView.Content>
      <Skeleton className="mt-4 h-[30vh] w-full rounded-md" />
    </MediaDetailView.Content>
  </MediaDetailView.Root>
);

interface MediaTrailerDialogProps {
  videos: Video[];
}

export const MediaTrailerDialog: React.FC<MediaTrailerDialogProps> = ({
  videos,
}) => {
  const trailer = selectPrimaryTrailerVideo(videos ?? []);

  return (
    <Dialog modal>
      <DialogTrigger className={cn(buttonVariants())} disabled={!trailer}>
        <Play className="mr-2 size-4" /> Watch Trailer
      </DialogTrigger>

      {trailer && (
        <DialogContent className="max-w-(--breakpoint-lg)">
          <iframe
            className="aspect-square size-full rounded-md sm:aspect-video"
            src={yt.video(trailer.key, true)}
            allow="autoplay; encrypted-media"
            allowFullScreen={true}
          />
        </DialogContent>
      )}
    </Dialog>
  );
};

type MediaErrorPageProps = {
  mediaType: "movie" | "tv";
  title: string;
  message?: string;
};

export function MediaErrorPage({
  mediaType,
  title,
  message,
}: MediaErrorPageProps) {
  const backLink = mediaType === "movie" ? "/movies" : "/tvshows";
  const backText =
    mediaType === "movie" ? "Back to Movies" : "Back to TV Shows";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-2xl font-bold text-foreground mb-4">{title}</h1>
      <p className="text-muted-foreground mb-4">
        {message ||
          `There was an error loading this ${mediaType === "movie" ? "movie" : "TV show"}.`}
      </p>
      <Link href={backLink} className="mt-4 text-primary hover:underline">
        {backText}
      </Link>
    </div>
  );
}

type MediaNotFoundErrorProps = {
  mediaType: "movie" | "tv";
  title: string;
  message?: string;
};

export function MediaNotFoundError({
  mediaType,
  title,
  message,
}: MediaNotFoundErrorProps) {
  const backLink = mediaType === "movie" ? "/movies" : "/tvshows";
  const backText =
    mediaType === "movie" ? "Back to Movies" : "Back to TV Shows";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-2xl font-bold text-foreground mb-4">{title}</h1>
      <p className="text-muted-foreground mb-4">
        {message ||
          `The requested ${mediaType === "movie" ? "movie" : "TV show"} could not be found.`}
      </p>
      <Link href={backLink} className="mt-4 text-primary hover:underline">
        {backText}
      </Link>
    </div>
  );
}

export type { TvHeroEpisodeData } from "@/components/hero/types";

type MediaDetailLayoutProps = {
  media: MediaItem[];
  mediaType: "movie" | "tv";
  anilistId?: number | null | undefined;
  isUpcoming?: boolean;
  children: React.ReactNode;
  contentContainerClassName?: string;
  sectionNav?: React.ReactNode;
  watchlistItem?: WatchlistItem | null;
  initialEpisode?: Episode | null;
  initialSeasonNumber?: number | null;
  tvHeroEpisodeData?: TvHeroEpisodeData | null;
};

export function MediaDetailLayout({
  media,
  mediaType,
  anilistId,
  isUpcoming,
  children,
  contentContainerClassName,
  sectionNav,
  watchlistItem,
  initialEpisode,
  initialSeasonNumber,
  tvHeroEpisodeData,
}: MediaDetailLayoutProps) {
  return (
    <PageContainer className="pb-16">
      <MediaDetailHero
        media={media}
        noSlide
        isWatch
        mediaType={mediaType}
        isUpcoming={isUpcoming}
        anilistId={anilistId}
        watchlistItem={watchlistItem}
        initialEpisode={initialEpisode}
        initialSeasonNumber={initialSeasonNumber}
        tvHeroEpisodeData={tvHeroEpisodeData}
      />

      <div className="relative">
        <StableBackground />
        <div className="relative">
          <ContentContainer
            className={
              contentContainerClassName ||
              "container mx-auto px-3 sm:px-4 lg:px-4 pt-2! sm:pt-4! lg:pt-6! mt-0!"
            }
          >
            {sectionNav}
            {children}
          </ContentContainer>
        </div>
      </div>
    </PageContainer>
  );
}
