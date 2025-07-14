import { SuspenseContentRow } from "@/components/content/suspense-content-row";
import { MediaCarousel } from "@/components/hero";
import { MediaItem } from "@/utils/typings";
import { fetchAndEnrichMediaItems, fetchTMDBData } from "../actions";

// Opt-out of static generation – this page fetches dynamic data and is heavy at build time.
export const dynamic = "force-dynamic";

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
  // Fetch both movies and TV shows for the hero carousel
  const [fanFavoriteMoviesResponse, fanFavoriteTVShowsResponse] =
    await Promise.all([
      fetchTMDBData("/discover/movie", {
        with_genres: "16|10751|12|878|35|28|10765", // Animation, Family, Adventure, Sci-Fi, Comedy, Action, Sci-Fi & Fantasy
        sort_by: "popularity.desc",
        "vote_average.gte": "7.0",
        "release_date.gte": "2023-01-01",
        "release_date.lte": "2025-07-12",
        "vote_count.gte": "1500",
        include_adult: "false",
        language: "en-US",
        region: "US",
      }),
      fetchTMDBData("/discover/tv", {
        with_genres: "16|10751|12|878|35|28|10765", // Animation, Family, Adventure, Sci-Fi, Comedy, Action, Sci-Fi & Fantasy
        sort_by: "popularity.desc",
        "vote_average.gte": "7.0",
        "first_air_date.gte": "2023-01-01",
        "first_air_date.lte": "2025-07-12",
        "vote_count.gte": "1500",
        include_adult: "false",
        language: "en-US",
      }),
    ]);

  const fanFavoriteMovies = fanFavoriteMoviesResponse?.results ?? [];
  const fanFavoriteTVShows = fanFavoriteTVShowsResponse?.results ?? [];

  // Add media_type to each item before combining
  const moviesWithType = fanFavoriteMovies.map((item: MediaItem) => ({
    ...item,
    media_type: "movie" as const,
  }));

  const tvShowsWithType = fanFavoriteTVShows.map((item: MediaItem) => ({
    ...item,
    media_type: "tv" as const,
  }));

  // Combine movies and TV shows
  const combinedFanFavorites = [...moviesWithType, ...tvShowsWithType];

  // Exit if no fan favorite content is available for the hero
  if (combinedFanFavorites.length === 0) {
    return null;
  }

  // Process hero content (both movies and TV shows)
  const seenIds = new Set<number>();
  const filteredFanFavoriteContent = combinedFanFavorites
    .filter((item: MediaItem) => {
      if (!item.poster_path) return false; // Ensure content has a poster
      if (seenIds.has(item.id)) return false; // Avoid duplicates
      if (item.title === "28 Days Later" || item.name === "28 Days Later")
        return false;
      if (item.id === 986056) return false;
      seenIds.add(item.id);
      return true;
    })
    .sort((a, b) => b.vote_average - a.vote_average) // Sort by rating for better quality
    .slice(1, 10); // Take the top 10 for enrichment

  // Separate movies and TV shows for enrichment
  const moviesToEnrich = filteredFanFavoriteContent.filter(
    (item) => item.media_type === "movie",
  );
  const tvShowsToEnrich = filteredFanFavoriteContent.filter(
    (item) => item.media_type === "tv",
  );

  // Enrich movies and TV shows separately with proper media type
  const [enrichedMovies, enrichedTVShows] = await Promise.all([
    moviesToEnrich.length > 0
      ? fetchAndEnrichMediaItems(moviesToEnrich, "movie")
      : Promise.resolve([]),
    tvShowsToEnrich.length > 0
      ? fetchAndEnrichMediaItems(tvShowsToEnrich, "tv")
      : Promise.resolve([]),
  ]);

  // Combine enriched items and sort by vote average again
  const fanFavoriteContentProcessedForHero = [
    ...enrichedMovies,
    ...enrichedTVShows,
  ].sort((a, b) => b.vote_average - a.vote_average);

  return (
    <div>
      <main>
        {/* Hero carousel - remains fully visible */}
        <MediaCarousel items={fanFavoriteContentProcessedForHero} />
        <div className="relative">
          {/* only cover content area, not hero */}
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
            <SuspenseContentRow
              rowId="top-rated-movies"
              title="Top Rated Movies"
              href="/movies/browse?type=top-rated"
              variant="ranked"
            />

            <SuspenseContentRow
              rowId="recent-releases"
              title="New Releases"
              href="/movies/browse?year=2025"
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
