"use client";

import {
  fetchMovieCredits,
  fetchMovieImages,
  fetchMovieRecommendationsPage,
  fetchMovieReviewsPage,
  fetchMovieSimilarPage,
  fetchMovieVideos,
  getMovieDetailsForQuery,
} from "@/app/actions/media-detail-tab-data";
import { MovieCard } from "@/components/movie/movie-card";
import { MovieOverviewTab } from "@/components/movie/movie-overview-tab";
import { MediaImages } from "@/components/media/media-client";
import { MediaCreditsList, MediaVideos } from "@/components/media/media-shared";
import { MediaReviewCard } from "@/components/media/media-review-card";
import { ListPagination } from "@/components/shared/list-pagination";
import { useMediaDetailTab } from "@/lib/stores/media-detail-tab-store";
import { queryKeys } from "@/lib/query-keys";
import type { MovieDetails } from "@/tmdb/models";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

type MovieDetailTabPanelsProps = {
  movieId: string;
};

export const MovieDetailTabPanels = ({
  movieId,
}: MovieDetailTabPanelsProps) => {
  const searchParams = useSearchParams();
  const rawTab = useMediaDetailTab("movie", movieId);
  const activeTab = !rawTab || rawTab === "overview" ? undefined : rawTab;
  const listPage = searchParams.get("page") ?? "1";
  const numId = Number.parseInt(movieId, 10);

  const { data: raw } = useQuery({
    queryKey: queryKeys.movieDetails(numId),
    queryFn: async () => {
      const m = await getMovieDetailsForQuery(movieId);
      if (!m || !("title" in m)) throw new Error("Movie not found");
      return m;
    },
  });

  const details = raw as unknown as MovieDetails | undefined;

  const { data: credits } = useQuery({
    queryKey: queryKeys.movieTabCredits(movieId),
    queryFn: () => fetchMovieCredits(movieId),
    enabled: activeTab === "credits",
  });

  const { data: images } = useQuery({
    queryKey: queryKeys.movieTabImages(movieId),
    queryFn: () => fetchMovieImages(movieId),
    enabled: activeTab === "images",
  });

  const { data: videos } = useQuery({
    queryKey: queryKeys.movieTabVideos(movieId),
    queryFn: () => fetchMovieVideos(movieId),
    enabled: activeTab === "videos",
  });

  const { data: reviewsData } = useQuery({
    queryKey: queryKeys.movieTabReviews(movieId, listPage),
    queryFn: () => fetchMovieReviewsPage(movieId, listPage),
    enabled: activeTab === "reviews",
  });

  const { data: recommendationsData } = useQuery({
    queryKey: queryKeys.movieTabRecommendations(movieId, listPage),
    queryFn: () => fetchMovieRecommendationsPage(movieId, listPage),
    enabled: activeTab === "recommendations",
  });

  const { data: similarData } = useQuery({
    queryKey: queryKeys.movieTabSimilar(movieId, listPage),
    queryFn: () => fetchMovieSimilarPage(movieId, listPage),
    enabled: activeTab === "similar",
  });

  if (!activeTab) {
    return details ? <MovieOverviewTab details={details} /> : null;
  }

  switch (activeTab) {
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
            {recommendationsData.results.map((movie) => (
              <MovieCard key={movie.id} {...movie} />
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
            {similarData.results.map((movie) => (
              <MovieCard key={movie.id} {...movie} />
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
