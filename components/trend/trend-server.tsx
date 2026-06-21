import {
  filterReleasedMovies,
  filterReleasedTvShows,
} from "@/lib/released-media";
import { enrichPeopleWithDeathday } from "@/lib/server/person-enrichment";
import { notFound } from "next/navigation";
import { tmdb } from "@/tmdb/api";
import type { Movie, TvShow } from "@/tmdb/models";

import { StaticHero } from "@/components/hero/hero-static";
import { ContentContainer } from "@/components/layout/content-container";
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
    <div className="flex w-full flex-col">
      <StaticHero imageUrl="/movie-banner.webp" title="" route="" hideTitle />

      <ContentContainer className="relative z-10 flex w-full flex-col items-center">
        <div className="container max-w-7xl space-y-8 px-2 pb-12 pt-14 sm:px-4 md:pt-16">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              {title}
            </h1>
            {description ? (
              <p className="mx-auto mt-2 max-w-3xl text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>

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
        </div>
      </ContentContainer>
    </div>
  );
};
