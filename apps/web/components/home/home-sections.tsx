import { prepareCatalogRowItemsForRsc } from "@/lib/server/prepare-catalog-row-items";
import { ContentReveal } from "@/components/layout/page-loading/content-reveal";
import { TrendCarousel } from "@/components/trend/trend-client";
import { pages } from "@/config/pages";
import {
  getHomePopularMovies,
  getHomePopularTv,
  getHomeTrendingMovies,
  getHomeTrendingTv,
} from "@/lib/server/home-hub-data";

export async function HomeTrendingMoviesCarousel() {
  const movies = await getHomeTrendingMovies();

  return (
    <ContentReveal>
      <TrendCarousel
        type="movie"
        title="Trending Movies"
        link={pages.trending.movie.link}
        compact
        bleed
        items={await toSlimCarouselItems(movies)}
      />
    </ContentReveal>
  );
}

const toSlimCarouselItems = prepareCatalogRowItemsForRsc;

export async function HomePopularMoviesCarousel() {
  const popularMovies = await getHomePopularMovies();

  return (
    <ContentReveal>
      <TrendCarousel
        type="movie"
        title="Popular Movies"
        link={pages.movie.popular.link}
        compact
        bleed
        items={await toSlimCarouselItems(popularMovies.slice(0, 22))}
      />
    </ContentReveal>
  );
}

export async function HomeTrendingTvCarousel() {
  const tvShows = await getHomeTrendingTv();

  return (
    <ContentReveal>
      <TrendCarousel
        type="tv"
        title="Trending TV"
        link={pages.trending.tv.link}
        compact
        bleed
        items={await toSlimCarouselItems(tvShows)}
      />
    </ContentReveal>
  );
}

export async function HomePopularTvCarousel() {
  const popularTv = await getHomePopularTv();

  return (
    <ContentReveal>
      <TrendCarousel
        type="tv"
        title="Popular TV"
        link={pages.tv.popular.link}
        compact
        bleed
        items={await toSlimCarouselItems(popularTv.slice(0, 22))}
      />
    </ContentReveal>
  );
}
