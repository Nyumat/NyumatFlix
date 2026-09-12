import {
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import { enrichPeopleWithDeathday } from "@/lib/server/person-enrichment";
import { notFound } from "next/navigation";
import { tmdb } from "@/tmdb/api";
import type { Movie, TvShow } from "@/tmdb/models";

import { IndexHeader } from "@/components/catalog/index-header";
import { IndexPage } from "@/components/catalog/index-page";
import { MovieCard } from "@/components/movie/movie-card";
import { PersonCard } from "@/components/person/person-card";
import { ListPagination } from "@/components/shared/list-pagination";
import { TvCard } from "@/components/tv/tv-card";

interface TrendListProps {
  type: "movie" | "tv" | "people";
  time: "day" | "week";
  page: string;
  title?: string;
  description?: string;
}

export const TrendList: React.FC<TrendListProps> = async ({
  type,
  time,
  page,
  title,
  description,
}) => {
  const {
    results: rawTrends,
    total_pages: totalPages,
    page: currentPage,
  } = await tmdb.trending[type]({
    time,
    page,
  });

  const trends =
    type === "movie"
      ? filterReleasedMovies(rawTrends as Movie[])
      : type === "tv"
        ? filterReleasedTvShows(rawTrends as TvShow[])
        : rawTrends;

  if (!trends?.length) {
    return notFound();
  }

  const trendsWithDeathday =
    type === "people"
      ? await enrichPeopleWithDeathday(
          trends as Array<{ id: number; media_type?: string }>,
        )
      : trends;

  return (
    <IndexPage
      header={
        <IndexHeader title={title ?? "Trending"} description={description} />
      }
    >
      <div className="grid-list">
        {trendsWithDeathday.map((item) =>
          item.media_type === "tv" ? (
            <TvCard key={item.id} {...item} />
          ) : item.media_type === "person" ? (
            <PersonCard key={item.id} {...item} />
          ) : (
            <MovieCard key={item.id} {...item} />
          ),
        )}
      </div>

      <ListPagination currentPage={currentPage} totalPages={totalPages} />
    </IndexPage>
  );
};
