import {
  homeCollectionPartToMediaItem,
  slimMediaItemsForRsc,
} from "@/lib/cards/catalog-dto";
import { CollectionShowcase } from "@/components/collections/collection-showcase";
import { ContentReveal } from "@/components/layout/page-loading/content-reveal";
import { TrendCarousel } from "@/components/trend/trend-client";
import { pages } from "@/config/pages";
import { getHomeCollections } from "@/lib/server/home-collections-data";
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
        items={toSlimCarouselItems(movies)}
      />
    </ContentReveal>
  );
}

const toCollectionMediaItems = (
  parts: Awaited<ReturnType<typeof getHomeCollections>>[number]["parts"],
) => parts.map(homeCollectionPartToMediaItem);

const toSlimCarouselItems = slimMediaItemsForRsc;

export async function HomeCollectionsSection() {
  const collections = await getHomeCollections();
  if (!collections.length) return null;

  return (
    <ContentReveal>
      <section className="space-y-6 md:space-y-8">
        <div className="space-y-1 px-1">
          <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
            Collections
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 xl:gap-6">
          {collections.map((collection, index) => (
            <CollectionShowcase
              key={collection.id}
              collection={collection}
              items={toCollectionMediaItems(collection.parts)}
              priority={index === 0}
            />
          ))}
        </div>
      </section>
    </ContentReveal>
  );
}

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
        items={toSlimCarouselItems(popularMovies.slice(0, 22))}
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
        items={toSlimCarouselItems(tvShows)}
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
        items={toSlimCarouselItems(popularTv.slice(0, 22))}
      />
    </ContentReveal>
  );
}
