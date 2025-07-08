import { ContentRowLoader } from "@/components/content/content-row-loader";
import { MediaCarousel } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";
import { Suspense } from "react";
import { fetchAndEnrichMediaItems, fetchTMDBData } from "../actions";

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
  const trendingTVResponse = await fetchTMDBData("/trending/tv/week");
  const basicTrendingItems = trendingTVResponse.results?.slice(0, 10) || [];

  const enrichedTrendingItems = await fetchAndEnrichMediaItems(
    basicTrendingItems as MediaItem[],
    "tv",
  );

  return (
    <>
      <main>
        <MediaCarousel items={enrichedTrendingItems.slice(0, 5)} />
      </main>

      {/* Content rows section with background */}
      <div className="relative min-h-screen">
        <div className="absolute inset-0 w-full min-h-full z-0">
          <div
            className="w-full min-h-full bg-repeat bg-center"
            style={{
              backgroundImage: "url('/movie-banner.jpg')",
              filter: "blur(8px)",
              opacity: 0.3,
            }}
          />
        </div>
        <div className="relative z-10">
          <ContentContainer>
            <Suspense>
              <ContentRowLoader
                rowId="tv-on-the-air"
                title="Currently Airing"
                href="/tvshows/browse?filter=tv-on-the-air"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="popular-tvshows"
                title="Popular TV Shows"
                href="/tvshows/browse?filter=tv-popular"
                variant="ranked"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="top-rated-tvshows"
                title="Top Rated TV Shows"
                href="/tvshows/browse?filter=tv-top-rated"
                variant="ranked"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="kdrama"
                title="Popular K-Dramas"
                href="/tvshows/browse?filter=tv-kdrama"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="tv-crime"
                title="Crime & Mystery"
                href="/tvshows/browse?filter=tv-genre-crime"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="cartoon-network"
                title="Cartoon Network"
                href="/tvshows/browse?filter=tv-network-cartoon-network"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="miniseries"
                title="Critically Acclaimed Miniseries"
                href="/tvshows/browse?filter=tv-limited-series"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="tv-comedy"
                title="Laugh Out Loud Comedies"
                href="/tvshows/browse?filter=tv-genre-comedy"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="mind-bending-scifi"
                title="Mind-Bending Sci-Fi"
                href="/tvshows/browse?filter=tv-mind-bending-scifi"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="nickelodeon"
                title="Nickelodeon"
                href="/tvshows/browse?filter=tv-network-nickelodeon"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="tv-drama"
                title="Critically Acclaimed Dramas"
                href="/tvshows/browse?filter=tv-genre-drama"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="teen-supernatural"
                title="Teen Supernatural Dramas"
                href="/tvshows/browse?filter=tv-teen-supernatural"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="cooking-food"
                title="Cooking & Food Shows"
                href="/tvshows/browse?filter=tv-cooking-shows"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="disneyxd"
                title="Disney XD"
                href="/tvshows/browse?filter=tv-network-disney-xd"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="period-dramas"
                title="Period Piece Dramas"
                href="/tvshows/browse?filter=tv-period-dramas"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="tv-scifi-fantasy"
                title="Sci-Fi & Fantasy Adventures"
                href="/tvshows/browse?filter=tv-genre-scifi-fantasy"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="reality-tv"
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

            {/* Family Favorites - Order 22 */}
            <Suspense>
              <ContentRowLoader
                rowId="family"
                title="Family Favorites"
                href="/tvshows/browse?filter=tv-family"
              />
            </Suspense>

            {/* K-Drama Romances - Order 23 */}
            <Suspense>
              <ContentRowLoader
                rowId="kdrama-romance"
                title="K-Drama Romances"
                href="/tvshows/browse?filter=tv-kdrama-romance"
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
        </div>
      </div>
    </>
  );
}
