import { WatchlistItem } from "@/app/watchlist/actions";
import { MediaDetailHero } from "@/components/hero/index";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { StableBackground } from "@/components/layout/stable-background";
import { Episode, MediaItem } from "@/utils/typings";
import { ReactNode } from "react";

type MediaDetailLayoutProps = {
  media: MediaItem[];
  mediaType: "movie" | "tv";
  anilistId?: number | null | undefined;
  isUpcoming?: boolean;
  children: ReactNode;
  contentContainerClassName?: string;
  watchlistItem?: WatchlistItem | null;
  initialEpisode?: Episode | null;
  initialSeasonNumber?: number | null;
};

export function MediaDetailLayout({
  media,
  mediaType,
  anilistId,
  isUpcoming,
  children,
  contentContainerClassName,
  watchlistItem,
  initialEpisode,
  initialSeasonNumber,
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
      />

      <div className="relative">
        <StableBackground />
        <div className="relative">
          <ContentContainer
            className={
              contentContainerClassName ||
              "container mx-auto px-3 sm:px-4 lg:px-4 !pt-2 sm:!pt-4 lg:!pt-6 !mt-0"
            }
          >
            {children}
          </ContentContainer>
        </div>
      </div>
    </PageContainer>
  );
}
