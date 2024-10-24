import { ContentRowActual } from "@/components/content-row";
import { buildMaybeItemsWithCategories, fetchAllData } from "../actions";
import { HeroSection } from "./render-row";

export const metadata = {
  title: "NyumatFlix - Watch Movies and TV Shows Online",
  description:
    "Tired of Netflix? Try NyumatFlix! Watch movies and TV shows online. No subscription required. No sign-up required. Just watch.",
  openGraph: {
    type: "website",
    url: "https://github.com/nyumat/nyumatflix",
    title: "NyumatFlix - Watch Movies and TV Shows Online",
    description:
      "Tired of Netflix? Try NyumatFlix! Watch movies and TV shows online. No subscription required. No sign-up required. Just watch.",
    images: [
      {
        url: "https://res.cloudinary.com/dbzv9xfjp/image/upload/v1723499276/og-images/shadcn-vue.jpg",
        width: 1200,
        height: 630,
        alt: "NyumatFlix - Watch Movies and TV Shows Online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://github.com/nobruf/shadcn-landing-page.git",
    title: "NyumatFlix - Watch Movies and TV Shows Online",
    description:
      "Tired of Netflix? Try NyumatFlix! Watch movies and TV shows online. No subscription required. No sign-up required. Just watch.",
    images: [
      "https://res.cloudinary.com/dbzv9xfjp/image/upload/v1723499276/og-images/shadcn-vue.jpg",
    ],
  },
};

export default async function Home() {
  const data = await fetchAllData();

  const { popularMovies, topRatedMovies, popularTVShows, topRatedTVShows } =
    data;

  if (
    !popularMovies ||
    !topRatedMovies ||
    !popularTVShows ||
    !topRatedTVShows
  ) {
    return null;
  }

  const popularMoviesWithCategories = await buildMaybeItemsWithCategories(
    popularMovies,
    "movie",
  );

  const topRatedMoviesWithCategories = await buildMaybeItemsWithCategories(
    topRatedMovies,
    "movie",
  );

  const popularTVShowsWithCategories = await buildMaybeItemsWithCategories(
    popularTVShows,
    "tv",
  );

  const topRatedTVShowsWithCategories = await buildMaybeItemsWithCategories(
    topRatedTVShows,
    "tv",
  );

  async function attachVideosToPopularMovies() {
    const popularMoviesWithVideos = await Promise.all(
      popularMoviesWithCategories.map(async (movie) => {
        const movieDetailsVideosAppend = await fetch(
          `https://api.themoviedb.org/3/movie/${movie.id}?&append_to_response=videos&api_key=${process.env.TMDB_API_KEY}`,
        );
        const movieDetailsVideos = await movieDetailsVideosAppend.json();
        return {
          ...movie,
          videos: movieDetailsVideos.videos.results,
        };
      }),
    );
    return popularMoviesWithVideos;
  }

  const popularMoviesWithVideos = await attachVideosToPopularMovies();
  return (
    <div>
      <main>
        <HeroSection media={popularMoviesWithVideos.slice(0, 5)} />
        <ContentRowActual
          title="Popular Movies"
          items={popularMoviesWithCategories}
          href="/movies"
        />
        <ContentRowActual
          title="Top Rated Movies"
          items={topRatedMoviesWithCategories}
          href="/movies?sort=top_rated"
        />
        <ContentRowActual
          title="Popular TV Shows"
          items={popularTVShowsWithCategories}
          href="/tvshows"
        />
        <ContentRowActual
          title="Top Rated TV Shows"
          items={topRatedTVShowsWithCategories}
          href="/tvshows?sort=top_rated"
        />
      </main>
    </div>
  );
}
