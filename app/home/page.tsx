import { HeroSection } from "./render-row";
import { buildMoviesWithCategories, fetchAllData } from "../actions";
import { ContentRowActual } from "@/components/content-row";

// export const metadata = {
//   title: "Shadcn - Landing template",
//   description: "Free Shadcn landing page for developers",
//   openGraph: {
//     type: "website",
//     url: "https://github.com/nobruf/shadcn-landing-page.git",
//     title: "Shadcn - Landing template",
//     description: "Free Shadcn landing page for developers",
//     images: [
//       {
//         url: "https://res.cloudinary.com/dbzv9xfjp/image/upload/v1723499276/og-images/shadcn-vue.jpg",
//         width: 1200,
//         height: 630,
//         alt: "Shadcn - Landing template",
//       },
//     ],
//   },
//   twitter: {
//     card: "summary_large_image",
//     site: "https://github.com/nobruf/shadcn-landing-page.git",
//     title: "Shadcn - Landing template",
//     description: "Free Shadcn landing page for developers",
//     images: [
//       "https://res.cloudinary.com/dbzv9xfjp/image/upload/v1723499276/og-images/shadcn-vue.jpg",
//     ],
//   },
// };

export default async function Home() {
  const data = await fetchAllData();

  const popularMoviesWithCategories = await buildMoviesWithCategories(
    data.popularMovies,
  );
  const topRatedMoviesWithCategories = await buildMoviesWithCategories(
    data.topRatedMovies,
  );
  const popularTVShowsWithCategories = await buildMoviesWithCategories(
    data.popularTVShows,
  );

  const topRatedTVShowsWithCategories = await buildMoviesWithCategories(
    data.topRatedTVShows,
  );

  return (
    <div>
      <main>
        {/* Only show the (very) popular movies with a backdrop path */}
        <HeroSection
          movies={popularMoviesWithCategories.filter(
            (movie) => movie.popularity > 1500 && movie.backdrop_path,
          )}
        />
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
