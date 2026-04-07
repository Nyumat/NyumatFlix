import { InfoTooltip } from "@/components/shared/info-tooltip";
import { buttonVariants } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icons } from "@/components/icons";
import { pages } from "@/config";
import { hasPosterPath } from "@/lib/media-poster-path";
import { cn, formatValue } from "@/lib/utils";
import {
  type Cast,
  type Crew,
  type GuestStar,
  type Movie,
  type TvShow,
} from "@/tmdb/models";
import type { BackdropSize } from "@/tmdb/utils";
import { format, tmdbImage } from "@/tmdb/utils";
import { User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { type ComponentProps } from "react";
import {
  MediaCardContent,
  MediaCardExcerpt,
  MediaCardRoot,
  MediaCardTitle,
  MediaPoster,
} from "./media-display";

interface MediaBackdropProps extends ComponentProps<"div"> {
  image?: string;
  size?: BackdropSize;
  alt: string;
  priority?: boolean;
}

export const MediaBackdrop: React.FC<MediaBackdropProps> = ({
  image,
  size = "original",
  alt,
  className,
  priority,
  ...props
}) => {
  const src = image ? tmdbImage.backdrop(image, size) : null;

  if (!src) {
    return (
      <div
        className={cn(
          "relative min-h-[12rem] w-full rounded-md border bg-muted text-muted-foreground md:min-h-0 md:h-full",
          className,
        )}
        {...props}
      >
        <div className="grid size-full min-h-[inherit] place-items-center">
          <Icons.Logo className="size-12" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-full min-h-[12rem] w-full overflow-hidden rounded-md border bg-muted md:min-h-0",
        className,
      )}
      {...props}
    >
      <Image
        src={src}
        alt={alt}
        priority={priority}
        unoptimized
        fill
        sizes="100vw"
        className="object-cover"
      />
    </div>
  );
};

interface MediaRatingProps extends BadgeProps {
  average: number;
  count?: number;
  showTooltip?: boolean;
}

const ratingBadgeClass =
  "inline-flex w-fit min-w-12 shrink-0 justify-center tabular-nums";

export const MediaRating: React.FC<MediaRatingProps> = ({
  average,
  count,
  className,
  showTooltip = true,
  ...props
}) => {
  const badge = (
    <Badge
      className={cn("items-center gap-1", ratingBadgeClass, className)}
      {...props}
    >
      {average ? average.toFixed(1) : "N/A"}
    </Badge>
  );

  if (!showTooltip || !count) {
    return badge;
  }

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>

        <TooltipContent className="flex items-center gap-1 bg-foreground text-xs text-background">
          <User className="size-3" /> {count}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

type MediaCastCardProps = {
  id: number;
  name: string;
  profile_path?: string | null;
  character: string;
};

export const MediaCastCard: React.FC<MediaCastCardProps> = ({
  id,
  name,
  profile_path,
  character,
}) => (
  <Link href={`${pages.person.detail.link}/${id}`} prefetch={false}>
    <MediaCardRoot>
      <MediaPoster image={profile_path ?? undefined} alt={name} />
      <MediaCardContent>
        <MediaCardTitle>{name}</MediaCardTitle>
        <MediaCardExcerpt>{character}</MediaCardExcerpt>
      </MediaCardContent>
    </MediaCardRoot>
  </Link>
);

export const MediaCrewCard: React.FC<Crew> = ({
  id,
  name,
  profile_path,
  job,
}) => (
  <Link href={`${pages.person.detail.link}/${id}`} prefetch={false}>
    <MediaCardRoot>
      <MediaPoster image={profile_path ?? undefined} alt={name} />
      <MediaCardContent>
        <MediaCardTitle>{name}</MediaCardTitle>
        <MediaCardExcerpt>{job}</MediaCardExcerpt>
      </MediaCardContent>
    </MediaCardRoot>
  </Link>
);

interface MediaCreditsListProps {
  cast?: Cast[];
  crew?: Crew[];
  guestStars?: GuestStar[];
}

export const MediaCreditsList = ({
  cast = [],
  crew = [],
  guestStars,
}: MediaCreditsListProps) => {
  return (
    <section className="space-y-12">
      <div>
        {cast.length > 0 ? (
          <div className="grid-list">
            {cast.map((castMember) => (
              <MediaCastCard key={castMember.credit_id} {...castMember} />
            ))}
          </div>
        ) : (
          <div className="empty-box">No cast information available</div>
        )}
      </div>

      {guestStars && (
        <div>
          <Badge className="mb-4" variant="outline">
            Guest Stars
          </Badge>

          {guestStars.length > 0 ? (
            <div className="grid-list">
              {guestStars.map((guestStar) => (
                <MediaCastCard key={guestStar.credit_id} {...guestStar} />
              ))}
            </div>
          ) : (
            <div className="empty-box">No guest stars available</div>
          )}
        </div>
      )}

      <div>
        <Badge className="mb-4" variant="outline">
          Crew
        </Badge>

        {crew.length > 0 ? (
          <div className="grid-list">
            {crew.map((crewMember) => (
              <MediaCrewCard key={crewMember.credit_id} {...crewMember} />
            ))}
          </div>
        ) : (
          <div className="empty-box">No crew information available</div>
        )}
      </div>
    </section>
  );
};

export const MediaPreview: React.FC<Movie | TvShow> = (props) => {
  const type = "title" in props ? "movie" : "tv";
  const title = "title" in props ? props.title : props.name;
  const originalTitle =
    "original_title" in props ? props.original_title : props.original_name;
  const releaseDate =
    "release_date" in props ? props.release_date : props.first_air_date;

  const {
    backdrop_path,
    poster_path,
    vote_average,
    overview,
    original_language,
  } = props;

  const bgSrc =
    poster_path != null
      ? tmdbImage.poster(poster_path, "w780")
      : backdrop_path != null
        ? tmdbImage.backdrop(backdrop_path, "w780")
        : null;

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-white/15 bg-card/30 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-card/25">
      {bgSrc ? (
        <>
          <div className="pointer-events-none absolute inset-0">
            <Image
              src={bgSrc}
              alt=""
              fill
              sizes="384px"
              unoptimized
              className="scale-110 object-cover blur-2xl saturate-125"
              aria-hidden
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 bg-black/55 backdrop-blur-md"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background/75 via-background/35 to-background/85"
            aria-hidden
          />
        </>
      ) : (
        <div
          className="pointer-events-none absolute inset-0 bg-muted"
          aria-hidden
        />
      )}

      <div className="relative flex gap-3 p-3 sm:gap-4 sm:p-4">
        {hasPosterPath({ poster_path }) ? (
          <div className="flex w-[4.75rem] shrink-0 flex-col justify-center sm:w-24">
            <div className="relative aspect-poster w-full overflow-hidden rounded-md border border-white/15 shadow-lg ring-1 ring-black/20">
              <MediaPoster image={poster_path} alt={title} size="w342" />
            </div>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <h3 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
            {title}
          </h3>

          <div className="mb-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
            <div>
              <span className="text-muted-foreground">Year</span>
              <p className="text-foreground">
                {formatValue(releaseDate, format.year)}
              </p>
            </div>

            <div>
              <span className="text-muted-foreground">Rating</span>
              <p className="text-foreground">
                {vote_average ? vote_average.toFixed(1) : "N/A"}
              </p>
            </div>

            <div>
              <span className="text-muted-foreground">Language</span>
              <p className="text-foreground">
                {formatValue(original_language, format.country)}
              </p>
            </div>

            <div>
              <span className="text-muted-foreground">Original Title</span>
              <p className="line-clamp-2 text-foreground">{originalTitle}</p>
            </div>
          </div>

          <p className="line-clamp-4 text-xs text-muted-foreground">
            {overview}
          </p>

          <Link
            href={
              type === "movie"
                ? `${pages.movie.root.link}/${props.id}`
                : `${pages.tv.root.link}/${props.id}`
            }
            className={cn(
              buttonVariants({ size: "sm", variant: "outline" }),
              "mt-3 border-white/20 bg-background/35 backdrop-blur-sm hover:bg-background/50",
            )}
          >
            Watch Now
          </Link>
        </div>
      </div>
    </div>
  );
};

type MediaProvidersHeadingProps = {
  type: "movie" | "tv";
};

export function MediaProvidersHeading({ type }: MediaProvidersHeadingProps) {
  return (
    <div>
      <h2 className="flex items-center gap-2 text-lg font-medium">
        Where to Watch
        <InfoTooltip className="w-60">
          Streaming availability is from TMDb for the United States (fixed
          region, not based on your location).
        </InfoTooltip>
      </h2>
      <p className="text-muted-foreground">
        Stream, buy or rent this {type === "tv" ? "tv show" : "movie"} from the
        providers below.
      </p>
    </div>
  );
}
