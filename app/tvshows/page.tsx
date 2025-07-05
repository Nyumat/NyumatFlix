import { ContentRow } from "@/components/content/content-row";
import { ContentRowLoader } from "@/components/content/content-row-loader";
import { MediaCarousel } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";
import { Suspense } from "react";
import {
  buildItemsWithCategories,
  fetchAndEnrichMediaItems,
  fetchTMDBData,
} from "../actions";

export const metadata: Metadata = {
  title: "TV Shows | NyumatFlix",
  description: "Discover your next binge-worthy series on NyumatFlix.",
  openGraph: {
    title: "TV Shows | NyumatFlix",
    description: "Discover your next binge-worthy series on NyumatFlix.",
    type: "website",
    siteName: "NyumatFlix",
  },
  twitter: {
    title: "TV Shows | NyumatFlix",
    description: "Discover your next binge-worthy series on NyumatFlix.",
  },
};

export default async function TVShowsPage() {
  // Fetch trending TV shows for hero carousel
  const trendingTVResponse = await fetchTMDBData("/trending/tv/week");
  const basicTrendingItems = trendingTVResponse.results?.slice(0, 10) || [];

  // Enrich these items with logos and full video details
  const enrichedTrendingItems = await fetchAndEnrichMediaItems(
    basicTrendingItems as MediaItem[],
    "tv",
  );

  const [popularShows, topRatedShows] = await Promise.all([
    fetchTMDBData("/tv/popular"),
    fetchTMDBData("/tv/top_rated"),
  ]);

  const popularShowsWithCategories = await buildItemsWithCategories<MediaItem>(
    popularShows.results ?? [],
    "tv",
  );
  const topRatedShowsWithCategories = await buildItemsWithCategories<MediaItem>(
    topRatedShows.results ?? [],
    "tv",
  );

  return (
    <>
      <main>
        <MediaCarousel items={enrichedTrendingItems.slice(0, 5)} />
      </main>

      <ContentContainer>
        {/* Currently Airing - Order 1 */}
        <Suspense>
          <ContentRowLoader
            rowId="tv-on-the-air"
            title="Currently Airing"
            href="/tvshows/browse?filter=tv-on-the-air"
          />
        </Suspense>

        {/* Popular Shows - Order 2 */}
        <ContentRow
          title="Popular TV Shows"
          items={popularShowsWithCategories}
          href="/tvshows/browse?filter=tv-popular"
          variant="ranked"
        />

        {/* Top Rated - Order 3 */}
        <ContentRow
          title="Top Rated TV Shows"
          items={topRatedShowsWithCategories}
          href="/tvshows/browse?filter=tv-top-rated"
          variant="ranked"
        />

        {/* Popular K-Dramas - Order 4 */}
        <Suspense>
          <ContentRowLoader
            rowId="kdrama"
            title="Popular K-Dramas"
            href="/tvshows/browse?filter=tv-kdrama"
          />
        </Suspense>

        {/* Crime & Mystery - Order 5 */}
        <Suspense>
          <ContentRowLoader
            rowId="tv-crime"
            title="Crime & Mystery"
            href="/tvshows/browse?filter=tv-genre-crime"
          />
        </Suspense>

        {/* Cartoon Network - Order 6 */}
        <Suspense>
          <ContentRowLoader
            rowId="cartoon-network"
            title="Cartoon Network"
            href="/tvshows/browse?filter=tv-network-cartoon-network"
          />
        </Suspense>

        {/* Critically Acclaimed Miniseries - Order 7 */}
        <Suspense>
          <ContentRowLoader
            rowId="miniseries"
            title="Critically Acclaimed Miniseries"
            href="/tvshows/browse?filter=tv-limited-series"
          />
        </Suspense>

        {/* Laugh Out Loud Comedies - Order 8 */}
        <Suspense>
          <ContentRowLoader
            rowId="tv-comedy"
            title="Laugh Out Loud Comedies"
            href="/tvshows/browse?filter=tv-genre-comedy"
          />
        </Suspense>

        {/* Mind-Bending Sci-Fi - Order 9 */}
        <Suspense>
          <ContentRowLoader
            rowId="mind-bending-scifi"
            title="Mind-Bending Sci-Fi"
            href="/tvshows/browse?filter=tv-mind-bending-scifi"
          />
        </Suspense>

        {/* Nickelodeon - Order 10 */}
        <Suspense>
          <ContentRowLoader
            rowId="nickelodeon"
            title="Nickelodeon"
            href="/tvshows/browse?filter=tv-network-nickelodeon"
          />
        </Suspense>

        {/* Critically Acclaimed Dramas - Order 11 */}
        <Suspense>
          <ContentRowLoader
            rowId="tv-drama"
            title="Critically Acclaimed Dramas"
            href="/tvshows/browse?filter=tv-genre-drama"
          />
        </Suspense>

        {/* Teen Supernatural Dramas - Order 12 */}
        <Suspense>
          <ContentRowLoader
            rowId="teen-supernatural"
            title="Teen Supernatural Dramas"
            href="/tvshows/browse?filter=tv-teen-supernatural"
          />
        </Suspense>

        {/* Cooking & Food Shows - Order 13 */}
        <Suspense>
          <ContentRowLoader
            rowId="cooking-food"
            title="Cooking & Food Shows"
            href="/tvshows/browse?filter=tv-cooking-shows"
          />
        </Suspense>

        {/* Disney XD - Order 14 */}
        <Suspense>
          <ContentRowLoader
            rowId="disneyxd"
            title="Disney XD"
            href="/tvshows/browse?filter=tv-network-disney-xd"
          />
        </Suspense>

        {/* Period Piece Dramas - Order 15 */}
        <Suspense>
          <ContentRowLoader
            rowId="period-dramas"
            title="Period Piece Dramas"
            href="/tvshows/browse?filter=tv-period-dramas"
          />
        </Suspense>

        {/* Sci-Fi & Fantasy Adventures - Order 16 */}
        <Suspense>
          <ContentRowLoader
            rowId="tv-scifi-fantasy"
            title="Sci-Fi & Fantasy Adventures"
            href="/tvshows/browse?filter=tv-genre-scifi-fantasy"
          />
        </Suspense>

        {/* Reality TV Hits - Order 17 */}
        <Suspense>
          <ContentRowLoader
            rowId="tv-reality"
            title="Reality TV Hits"
            href="/tvshows/browse?filter=tv-reality"
          />
        </Suspense>

        {/* Animated Shows - Order 18 */}
        <Suspense>
          <ContentRowLoader
            rowId="tv-animation"
            title="Animated Shows"
            href="/tvshows/browse?filter=tv-genre-animation"
          />
        </Suspense>

        {/* Network TV Hits - Order 19 */}
        <Suspense>
          <ContentRowLoader
            rowId="network-hits"
            title="Network TV Hits"
            href="/tvshows/browse?filter=tv-network-hits"
          />
        </Suspense>

        {/* Classic Sitcoms - Order 20 */}
        <Suspense>
          <ContentRowLoader
            rowId="tv-sitcoms"
            title="Classic Sitcoms"
            href="/tvshows/browse?filter=tv-sitcoms"
          />
        </Suspense>

        {/* Disney Channel - Order 21 */}
        <Suspense>
          <ContentRowLoader
            rowId="disney-channel"
            title="Disney Channel"
            href="/tvshows/browse?filter=tv-network-disney-channel"
          />
        </Suspense>

        {/* Romantic Crime Dramas - Order 22 */}
        <Suspense>
          <ContentRowLoader
            rowId="romantic-crime"
            title="Romantic Crime Dramas"
            href="/tvshows/browse?filter=tv-romantic-crime"
          />
        </Suspense>

        {/* Family Favorites - Order 23 */}
        <Suspense>
          <ContentRowLoader
            rowId="family"
            title="Family Favorites"
            href="/tvshows/browse?filter=tv-family"
          />
        </Suspense>

        {/* K-Drama Romances - Order 24 */}
        <Suspense>
          <ContentRowLoader
            rowId="kdrama-romance"
            title="K-Drama Romances"
            href="/tvshows/browse?filter=tv-kdrama-romance"
          />
        </Suspense>

        {/* Workplace Comedies - Order 25 */}
        <Suspense>
          <ContentRowLoader
            rowId="workplace-comedies"
            title="Workplace Comedies"
            href="/tvshows/browse?filter=tv-workplace-comedies"
          />
        </Suspense>

        {/* Mystery Shows - Order 26 */}
        <Suspense>
          <ContentRowLoader
            rowId="2010s-mystery"
            title="Mystery Shows"
            href="/tvshows/browse?filter=tv-mystery"
          />
        </Suspense>

        {/* Kids Shows - Order 27 */}
        <Suspense>
          <ContentRowLoader
            rowId="tv-kids"
            title="Kids Shows"
            href="/tvshows/browse?filter=tv-genre-kids"
          />
        </Suspense>

        {/* 90s Cartoons - Order 28 */}
        <Suspense>
          <ContentRowLoader
            rowId="90s-cartoons"
            title="90s Cartoons"
            href="/tvshows/browse?filter=tv-90s-cartoons"
          />
        </Suspense>
      </ContentContainer>
    </>
  );
}
