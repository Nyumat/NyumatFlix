import { cn } from "@/lib/utils";
import { HeroSection } from "./render-row";
import Link from "next/link";
import { ContentRowActual } from "../movies/page";

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

interface Genre {
  id: number;
  name: string;
}

export interface Movie {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
  categories?: string[]; // Optional field for the genre names
}

interface TVShow {
  id: number;
  name: string;
  genre_ids: number[];
  poster_path: string;
  categories?: string[];
}

interface TMDBResponse<T> {
  results: T[];
}

const TMDB_BASE_URL = "https://api.themoviedb.org/3";

interface Params {
  [key: string]: string;
}

export async function fetchTMDBData(
  endpoint: string,
  params: Params = {},
  page: number = 1, // Default to page 1 if not provided
): Promise<TMDBResponse<any>> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB API key is missing");
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append("api_key", apiKey);
  url.searchParams.append("page", page.toString()); // Add the page parameter

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, value);
  }

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(
      `TMDB API error: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

async function getCategoriesForMovie(): Promise<Genre[]> {
  const genres = await fetch(
    `https://api.themoviedb.org/3/genre/movie/list?api_key=${process.env.TMDB_API_KEY}`,
  ).then((res) => res.json());
  return genres.genres;
}

export default async function Home() {
  const fetchAllData = async () => {
    const [popularMovies, topRatedMovies, popularTVShows, topRatedTVShows] =
      await Promise.all([
        fetchTMDBData("/movie/popular"),
        fetchTMDBData("/movie/top_rated"),
        fetchTMDBData("/tv/popular"),
        fetchTMDBData("/tv/top_rated"),
      ]);

    return {
      popularMovies: popularMovies.results,
      topRatedMovies: topRatedMovies.results,
      popularTVShows: popularTVShows.results,
      topRatedTVShows: topRatedTVShows.results,
    };
  };

  const buildMoviesWithCategories = async (movies: Movie[]) => {
    const categories = await getCategoriesForMovie();
    return movies.map((movie) => {
      const movieCategories = categories
        .filter((category) => movie.genre_ids.includes(category.id))
        .map((category) => category.name);
      return { ...movie, categories: movieCategories };
    });
  };

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

// function ContentRow({ title, items, href }: { title: string; items: any[], href: string }) {
//   return (
//     <div className="mx-8 mb-8">
//       <div className="flex justify-between items-center">
//       <h2 className={cn("text-2xl font-bold mb-4 z-10", "text-white")}>{title}</h2>
//         <Link href={href}>
//           <span className="text-sm hover:text-secondary hover:underline">View all</span>
//         </Link>
//       </div>
//       <div className="flex space-x-4 overflow-x-auto pb-4">
//         {items.map((item) => (
//           <div key={item.id} className="flex-none w-40">
//             <img
//               src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
//               alt={item.title || item.name}
//               className="w-full h-60 object-cover rounded transition transform hover:scale-105"
//             />
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }
