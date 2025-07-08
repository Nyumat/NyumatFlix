import { ContentRowLoader } from "@/components/content/content-row-loader";
import { MediaCarousel } from "@/components/hero";
import { MediaItem } from "@/utils/typings";
import { Suspense } from "react";
import { fetchAllData, fetchAndEnrichMediaItems } from "../actions";

export const metadata = {
  title: "Home | NyumatFlix",
  description:
    "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
  openGraph: {
    type: "website",
    url: "https://nyumatflix.com",
    title: "Home | NyumatFlix",
    description:
      "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
    images: [
      {
        url: "https://nyumatflix.com/nyumatflix-alt.webp",
        width: 1200,
        height: 630,
        alt: "Home | NyumatFlix",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://nyumatflix.com",
    title: "Home |NyumatFlix",
    description:
      "Nyumatflix is an open-source, no-cost, and ad-free movie and tv show stream aggregator.",
    images: ["https://nyumatflix.com/nyumatflix-alt.webp"],
  },
};

export default async function Home() {
  // Only fetch data for the hero carousel
  const { fanFavoriteClassicsForHero } = await fetchAllData();

  // Exit if no fan favorite classics are available for the hero
  if (!fanFavoriteClassicsForHero) {
    return null;
  }

  // Process hero movies
  const seenIds = new Set<number>();
  const filteredFanFavoriteClassics = fanFavoriteClassicsForHero
    .filter((item: MediaItem) => {
      if (!item.poster_path) return false; // Ensure movies have a poster
      if (seenIds.has(item.id)) return false; // Avoid duplicates if any
      if (item.title === "28 Days Later") return false;
      seenIds.add(item.id);
      return true;
    })
    .slice(0, 10); // Take the top 10 for enrichment

  // Enrich these items with logos and full video details
  const fanFavoriteClassicsProcessedForHero = await fetchAndEnrichMediaItems(
    filteredFanFavoriteClassics,
    "movie",
  );

  return (
    <div>
      <main>
        <MediaCarousel items={fanFavoriteClassicsProcessedForHero} />
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
            <Suspense>
              <ContentRowLoader
                rowId="recent-releases"
                title="New Releases"
                href="/movies/browse?year=2023"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="upcoming-movies"
                title="Coming Soon"
                href="/movies/browse?type=upcoming"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="popular-movies"
                title="Popular Movies"
                href="/movies/browse"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="popular-tvshows"
                title="Popular TV Shows"
                href="/tvshows/browse?filter=tv-popular"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="action-movies"
                title="Action-Packed Adventures"
                href="/movies/browse?genre=28"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="nolan-films"
                title="Christopher Nolan Films"
                href="/movies/browse?type=director-nolan"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="top-rated-movies"
                title="Top Rated Movies"
                href="/movies/browse?type=top-rated"
                variant="ranked"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="scifi-fantasy-movies"
                title="Sci-Fi & Fantasy Worlds"
                href="/movies/browse?genre=878,14"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="binge-worthy-series"
                title="Binge-Worthy Series"
                href="/tvshows/browse?filter=tv-popular"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="comedy-movies"
                title="Laugh Out Loud (Comedies)"
                href="/movies/browse?genre=35"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="a24-films"
                title="A24 Films"
                href="/movies/browse?type=studio-a24"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="thriller-movies"
                title="Edge-of-Your-Seat Thrillers"
                href="/movies/browse?genre=53"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="limited-series"
                title="Limited Series That Hit Hard"
                href="/tvshows/browse?filter=tv-limited-series"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="drama-movies"
                title="Heartfelt Dramas"
                href="/movies/browse?genre=18"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="critically-acclaimed"
                title="Critically Acclaimed"
                href="/movies/browse?filter=critically_acclaimed"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="eighties-movies"
                title="80s Throwbacks"
                href="/movies/browse?year=1980-1989"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="reality-tv"
                title="Reality TV Picks"
                href="/tvshows/browse?filter=tv-reality"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="nineties-movies"
                title="90s Favorites"
                href="/movies/browse?year=1990-1999"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="romcom-movies"
                title="Chill with Rom-Coms"
                href="/movies/browse?genre=10749,35"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="docuseries"
                title="Docuseries You Can't Miss"
                href="/tvshows/browse?filter=tv-docuseries"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="early-2000s-movies"
                title="Early 2000s Nostalgia"
                href="/movies/browse?year=2000-2009"
              />
            </Suspense>

            <Suspense>
              <ContentRowLoader
                rowId="hidden-gems"
                title="Hidden Gems"
                href="/movies/browse?filter=hidden_gems"
              />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
