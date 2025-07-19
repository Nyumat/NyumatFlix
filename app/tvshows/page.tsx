import { SuspenseContentRow } from "@/components/content/suspense-content-row";
import { MediaCarousel } from "@/components/hero";
import { ContentContainer } from "@/components/layout/content-container";
import { MediaItem } from "@/utils/typings";
import { Metadata } from "next";
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

// Opt-out of static generation – dynamic data is fetched.
export const dynamic = "force-dynamic";

export default async function TVShowsPage() {
  const trendingTVResponse = await fetchTMDBData("/discover/tv", {
    sort_by: "popularity.desc",
    "vote_average.gte": "7.0",
    "release_date.gte": "2023-01-01",
    "release_date.lte": "2025-07-12",
    "vote_count.gte": "1500",
    include_adult: "false",
    language: "en-US",
    region: "US",
  });
  // Only take a few items for the hero carousel to keep build time low
  const basicTrendingItems = trendingTVResponse.results?.slice(0, 5) || [];

  const enrichedTrendingItems = await fetchAndEnrichMediaItems(
    basicTrendingItems as MediaItem[],
    "tv",
  );

  return (
    <>
      <main>
        {/* Hero carousel for trending TV shows - remains fully visible */}
        <MediaCarousel items={enrichedTrendingItems} />
      </main>

      {/* Content rows section with background */}
      <div className="relative">
        {/* Fix: Position background to only cover content area, not hero */}
        <div className="absolute inset-0 w-full h-full z-0">
          <div
            className="w-full h-full bg-repeat bg-center"
            style={{
              backgroundImage: "url('/movie-banner.jpg')",
              filter: "blur(8px)",
              opacity: 0.3,
            }}
          />
        </div>
        {/* Content with sufficient min-height to prevent shifts */}
        <div className="relative z-10 min-h-[200vh]">
          <ContentContainer>
            <SuspenseContentRow
              rowId="top-rated-tvshows"
              title="Top Rated TV Shows"
              href="/tvshows/browse?filter=tv-top-rated"
              variant="ranked"
            />

            <SuspenseContentRow
              rowId="reality-tv"
              title="Reality TV Hits"
              enrich
              href="/tvshows/browse?filter=tv-reality"
            />

            {/*

            <SuspenseContentRow
              rowId="tv-on-the-air"
              title="Currently Airing"
              href="/tvshows/browse?filter=tv-on-the-air"
            />

            <SuspenseContentRow
              rowId="popular-tvshows"
              title="Popular TV Shows"
              href="/tvshows/browse?filter=tv-popular"
            />
            */}

            <SuspenseContentRow
              rowId="cartoon-network"
              title="Cartoon Network"
              href="/tvshows/browse?filter=tv-network-cartoon-network"
            />

            <SuspenseContentRow
              rowId="tv-crime"
              title="Crime & Mystery"
              href="/tvshows/browse?filter=tv-genre-crime"
            />

            <SuspenseContentRow
              rowId="miniseries"
              title="Critically Acclaimed Miniseries"
              href="/tvshows/browse?filter=tv-limited-series"
            />

            <SuspenseContentRow
              rowId="tv-comedy"
              title="Comedies"
              href="/tvshows/browse?filter=tv-genre-comedy"
            />

            <SuspenseContentRow
              rowId="mind-bending-scifi"
              title="Mind-Bending Sci-Fi"
              enrich
              href="/tvshows/browse?filter=tv-mind-bending-scifi"
            />

            <SuspenseContentRow
              rowId="nickelodeon"
              title="Nickelodeon"
              href="/tvshows/browse?filter=tv-network-nickelodeon"
            />

            <SuspenseContentRow
              rowId="tv-drama"
              title="Critically Acclaimed Dramas"
              href="/tvshows/browse?filter=tv-genre-drama"
            />

            <SuspenseContentRow
              rowId="teen-supernatural"
              title="Teen Supernatural Dramas"
              href="/tvshows/browse?filter=tv-teen-supernatural"
            />

            <SuspenseContentRow
              rowId="cooking-food"
              title="Cooking & Food Shows"
              href="/tvshows/browse?filter=tv-cooking-shows"
            />

            <SuspenseContentRow
              rowId="disneyxd"
              title="Disney XD"
              href="/tvshows/browse?filter=tv-network-disney-xd"
            />

            {/* <SuspenseContentRow
              rowId="period-dramas"
              title="Period Piece Dramas"
              href="/tvshows/browse?filter=tv-period-dramas"
            /> */}

            <SuspenseContentRow
              rowId="tv-scifi-fantasy"
              title="Sci-Fi & Fantasy Adventures"
              href="/tvshows/browse?filter=tv-genre-scifi-fantasy"
            />

            <SuspenseContentRow
              rowId="tv-animation"
              title="Animated Shows"
              href="/tvshows/browse?filter=tv-genre-animation"
            />
            <SuspenseContentRow
              rowId="network-hits"
              title="Network TV Hits"
              href="/tvshows/browse?filter=tv-network-hits"
            />
            <SuspenseContentRow
              rowId="tv-sitcoms"
              title="Classic Sitcoms"
              href="/tvshows/browse?filter=tv-sitcoms"
            />
            <SuspenseContentRow
              rowId="disney-channel"
              title="Disney Channel"
              href="/tvshows/browse?filter=tv-network-disney-channel"
            />
            <SuspenseContentRow
              rowId="family"
              title="Family Favorites"
              href="/tvshows/browse?filter=tv-family"
            />

            <SuspenseContentRow
              rowId="kdrama"
              title="Popular K-Dramas"
              href="/tvshows/browse?filter=tv-kdrama"
            />

            {/* <SuspenseContentRow
              rowId="kdrama-romance"
              title="K-Drama Romances"
              href="/tvshows/browse?filter=tv-kdrama-romance"
            /> */}
            <SuspenseContentRow
              rowId="2010s-mystery"
              title="Mystery Shows"
              href="/tvshows/browse?filter=tv-mystery"
            />
            <SuspenseContentRow
              rowId="tv-kids"
              title="Kids Shows"
              href="/tvshows/browse?filter=tv-genre-kids"
            />
            <SuspenseContentRow
              rowId="90s-cartoons"
              title="90s Cartoons"
              href="/tvshows/browse?filter=tv-90s-cartoons"
            />
          </ContentContainer>
        </div>
      </div>
    </>
  );
}
