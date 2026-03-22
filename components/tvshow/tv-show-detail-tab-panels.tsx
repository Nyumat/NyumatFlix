"use client";

import {
  fetchTvCredits,
  fetchTvImages,
  fetchTvRecommendationsPage,
  fetchTvReviewsPage,
  fetchTvSimilarPage,
  fetchTvVideos,
  getTvAllSeasonsForQuery,
  getTvShowDetailsForQuery,
} from "@/app/actions/media-detail-tab-data";
import { HeroTvEpisodePanel } from "@/components/hero/hero-tv-episode-panel";
import { MediaImages } from "@/components/media/media-client";
import { MediaCreditsList, MediaVideos } from "@/components/media/media-shared";
import { MediaReviewCard } from "@/components/media/media-review-card";
import { ListPagination } from "@/components/shared/list-pagination";
import { TvShowOverviewTab } from "@/components/tvshow/tv-show-overview-tab";
import { TvShowRootRedirect } from "@/components/tvshow/tv-show-root-redirect";
import { TvShowSeasonsPage } from "@/components/tvshow/tvshow-seasons-page";
import { TvCard } from "@/components/tv/tv-card";
import { useMediaDetailTab } from "@/lib/stores/media-detail-tab-store";
import { queryKeys } from "@/lib/query-keys";
import type { TvShowDetails } from "@/utils/typings";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

type TvShowDetailTabPanelsProps = {
  tvId: string;
  numberOfEpisodes: number;
};

export const TvShowDetailTabPanels = ({
  tvId,
  numberOfEpisodes,
}: TvShowDetailTabPanelsProps) => {
  const searchParams = useSearchParams();
  const activeTab = useMediaDetailTab("tv", tvId);
  const listPage = searchParams.get("page") ?? "1";
  const numId = Number.parseInt(tvId, 10);

  const { data: details } = useQuery({
    queryKey: queryKeys.tvDetails(numId),
    queryFn: async () => {
      const d = await getTvShowDetailsForQuery(tvId);
      if (!d) throw new Error("TV show not found");
      return d;
    },
  });

  const { data: allSeasonDetails } = useQuery({
    queryKey: queryKeys.tvAllSeasons(tvId),
    queryFn: () => getTvAllSeasonsForQuery(tvId),
  });

  const { data: credits } = useQuery({
    queryKey: queryKeys.tvTabCredits(tvId),
    queryFn: () => fetchTvCredits(tvId),
    enabled: activeTab === "credits",
  });

  const { data: images } = useQuery({
    queryKey: queryKeys.tvTabImages(tvId),
    queryFn: () => fetchTvImages(tvId),
    enabled: activeTab === "images",
  });

  const { data: videos } = useQuery({
    queryKey: queryKeys.tvTabVideos(tvId),
    queryFn: () => fetchTvVideos(tvId),
    enabled: activeTab === "videos",
  });

  const { data: reviewsData } = useQuery({
    queryKey: queryKeys.tvTabReviews(tvId, listPage),
    queryFn: () => fetchTvReviewsPage(tvId, listPage),
    enabled: activeTab === "reviews",
  });

  const { data: recommendationsData } = useQuery({
    queryKey: queryKeys.tvTabRecommendations(tvId, listPage),
    queryFn: () => fetchTvRecommendationsPage(tvId, listPage),
    enabled: activeTab === "recommendations",
  });

  const { data: similarData } = useQuery({
    queryKey: queryKeys.tvTabSimilar(tvId, listPage),
    queryFn: () => fetchTvSimilarPage(tvId, listPage),
    enabled: activeTab === "similar",
  });

  const resolvedDetails = details as TvShowDetails | undefined;

  if (!activeTab) {
    return <TvShowRootRedirect id={tvId} numberOfEpisodes={numberOfEpisodes} />;
  }

  switch (activeTab) {
    case "overview":
      return resolvedDetails ? (
        <TvShowOverviewTab details={resolvedDetails} id={tvId} />
      ) : null;
    case "seasons-episodes":
      if (!resolvedDetails || !allSeasonDetails) return null;
      return (
        <section
          id="seasons-episodes-panel"
          data-episode-browser
          className="scroll-mt-24"
        >
          <HeroTvEpisodePanel
            tvId={tvId}
            details={resolvedDetails}
            allSeasonDetails={allSeasonDetails}
          />
        </section>
      );
    case "credits":
      return credits ? (
        <MediaCreditsList cast={credits.cast} crew={credits.crew} />
      ) : null;
    case "reviews":
      if (!reviewsData) return null;
      if (!reviewsData.results.length) {
        return <div className="empty-box">No reviews</div>;
      }
      return (
        <section className="space-y-8">
          {reviewsData.results.map((review) => (
            <MediaReviewCard key={review.id} review={review} />
          ))}
          <ListPagination
            currentPage={reviewsData.page}
            totalPages={reviewsData.total_pages}
          />
        </section>
      );
    case "series-graph":
      return allSeasonDetails ? (
        <TvShowSeasonsPage allSeasonDetails={allSeasonDetails} />
      ) : null;
    case "images":
      return images ? (
        <MediaImages posters={images.posters} backdrops={images.backdrops} />
      ) : null;
    case "videos":
      return videos ? <MediaVideos videos={videos.results} /> : null;
    case "recommendations":
      if (!recommendationsData) return null;
      if (!recommendationsData.results?.length) {
        return <div className="empty-box">No recommendations</div>;
      }
      return (
        <div className="space-y-4">
          <section className="grid-list">
            {recommendationsData.results.map((show) => (
              <TvCard key={show.id} {...show} />
            ))}
          </section>
          <ListPagination
            currentPage={recommendationsData.page}
            totalPages={recommendationsData.total_pages}
          />
        </div>
      );
    case "similar":
      if (!similarData) return null;
      if (!similarData.results?.length) {
        return <div className="empty-box">No similar titles</div>;
      }
      return (
        <div className="space-y-4">
          <section className="grid-list">
            {similarData.results.map((show) => (
              <TvCard key={show.id} {...show} />
            ))}
          </section>
          <ListPagination
            currentPage={similarData.page}
            totalPages={similarData.total_pages}
          />
        </div>
      );
    default:
      return null;
  }
};
