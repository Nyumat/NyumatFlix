import { SuspenseContentRow } from "@/components/content/suspense-content-row";
import { MediaCarousel } from "@/components/hero";
import { MediaItem } from "@/utils/typings";
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
            <SuspenseContentRow
              rowId="recent-releases"
              title="New Releases"
              href="/movies/browse?year=2023"
            />

            <SuspenseContentRow
              rowId="upcoming-movies"
              title="Coming Soon"
              href="/movies/browse?type=upcoming"
            />

            <SuspenseContentRow
              rowId="popular-movies"
              title="Popular Movies"
              href="/movies/browse"
            />

            <SuspenseContentRow
              rowId="popular-tvshows"
              title="Popular TV Shows"
              href="/tvshows/browse?filter=tv-popular"
            />

            <SuspenseContentRow
              rowId="action-movies"
              title="Action-Packed Adventures"
              href="/movies/browse?genre=28"
            />

            <SuspenseContentRow
              rowId="nolan-films"
              title="Christopher Nolan Films"
              href="/movies/browse?type=director-nolan"
            />

            <SuspenseContentRow
              rowId="top-rated-movies"
              title="Top Rated Movies"
              href="/movies/browse?type=top-rated"
              variant="ranked"
            />

            <SuspenseContentRow
              rowId="scifi-fantasy-movies"
              title="Sci-Fi & Fantasy Worlds"
              href="/movies/browse?genre=878,14"
            />

            <SuspenseContentRow
              rowId="binge-worthy-series"
              title="Binge-Worthy Series"
              href="/tvshows/browse?filter=tv-popular"
            />

            <SuspenseContentRow
              rowId="comedy-movies"
              title="Laugh Out Loud (Comedies)"
              href="/movies/browse?genre=35"
            />

            <SuspenseContentRow
              rowId="a24-films"
              title="A24 Films"
              href="/movies/browse?type=studio-a24"
            />

            <SuspenseContentRow
              rowId="thriller-movies"
              title="Edge-of-Your-Seat Thrillers"
              href="/movies/browse?genre=53"
            />

            <SuspenseContentRow
              rowId="limited-series"
              title="Limited Series That Hit Hard"
              href="/tvshows/browse?filter=tv-limited-series"
            />

            <SuspenseContentRow
              rowId="drama-movies"
              title="Heartfelt Dramas"
              href="/movies/browse?genre=18"
            />

            <SuspenseContentRow
              rowId="critically-acclaimed"
              title="Critically Acclaimed"
              href="/movies/browse?filter=critically_acclaimed"
            />

            <SuspenseContentRow
              rowId="eighties-movies"
              title="80s Throwbacks"
              href="/movies/browse?year=1980-1989"
            />

            <SuspenseContentRow
              rowId="reality-tv"
              title="Reality TV Picks"
              href="/tvshows/browse?filter=tv-reality"
            />

            <SuspenseContentRow
              rowId="nineties-movies"
              title="90s Favorites"
              href="/movies/browse?year=1990-1999"
            />

            <SuspenseContentRow
              rowId="romcom-movies"
              title="Chill with Rom-Coms"
              href="/movies/browse?genre=10749,35"
            />

            <SuspenseContentRow
              rowId="docuseries"
              title="Docuseries You Can't Miss"
              href="/tvshows/browse?filter=tv-docuseries"
            />

            <SuspenseContentRow
              rowId="early-2000s-movies"
              title="Early 2000s Nostalgia"
              href="/movies/browse?year=2000-2009"
            />

            <SuspenseContentRow
              rowId="hidden-gems"
              title="Hidden Gems"
              href="/movies/browse?filter=hidden_gems"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
