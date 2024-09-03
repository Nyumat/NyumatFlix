import { cn } from "@/lib/utils";
import Link from "next/link";
import { HeroSection } from "../home/render-row";
import Image from "next/image";

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
): Promise<any> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error("TMDB API key is missing");
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.append("api_key", apiKey);

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

export async function getCategoriesForMovie(): Promise<Genre[]> {
  const genres = await fetch(
    `https://api.themoviedb.org/3/genre/movie/list?api_key=${process.env.TMDB_API_KEY}`,
  ).then((res) => res.json());
  return genres.genres;
}

// export default async function Movies() {
//   const fetchAllData = async () => {
//     const [popularMovies, topRatedMovies] =
//       await Promise.all([
//         fetchTMDBData("/movie/popular"),
//         fetchTMDBData("/movie/top_rated"),
//       ]);

//     return {
//       popularMovies: popularMovies.results,
//       topRatedMovies: topRatedMovies.results,
//     };
//   };

//   const buildMoviesWithCategories = async (movies: Movie[]) => {
//     const categories = await getCategoriesForMovie();
//     return movies.map((movie) => {
//       const movieCategories = categories
//         .filter((category) => movie.genre_ids.includes(category.id))
//         .map((category) => category.name);
//       return { ...movie, categories: movieCategories };
//     });
//   };

//   const data = await fetchAllData();

//   const popularMoviesWithCategories = await buildMoviesWithCategories(
//     data.popularMovies,
//   );
//   const topRatedMoviesWithCategories = await buildMoviesWithCategories(
//     data.topRatedMovies,
//   );

//   return (
//     <div className="min-h-screen">
//       <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-70" />
//       <div className="grid place-items-center mx-auto">
//         <Image
//           src={`/movie-hero.svg`}
//           alt="NyumatFlix"
//           width={800}
//           height={500}
//           className="w-full h-[40vh] object-cover rounded-lg"
//         />
//       </div>
//       <main className="mt-4">
//         <ContentRow
//           title="Popular Movies"
//           items={popularMoviesWithCategories}
//           href="/movies"
//         />
//         <ContentRow
//           title="Top Rated Movies"
//           items={topRatedMoviesWithCategories}
//           href="/movies?sort=top_rated"
//         />
//       </main>
//     </div>
//   );
// }

export async function getCategories(type: "movie" | "tv"): Promise<Genre[]> {
  const genres = await fetchTMDBData(`/genre/${type}/list`);
  return genres.genres;
}

export async function buildItemsWithCategories(
  items: any[],
  type: "movie" | "tv" | "multi",
) {
  const movieCategories = await getCategories("movie");
  const tvCategories = await getCategories("tv");

  return items.map((item) => {
    const itemCategories =
      type === "movie" || (type === "multi" && item.media_type === "movie")
        ? movieCategories
        : tvCategories;

    const categories = itemCategories
      .filter((category: Genre) => item.genre_ids.includes(category.id))
      .map((category: Genre) => category.name);

    return { ...item, categories };
  });
}

export function ContentRowActual({
  title,
  items,
  href,
}: {
  title: string;
  items: any[];
  href: string;
}) {
  return (
    <div className="mx-8 mb-8">
      <div className="flex justify-between items-center">
        <h2 className={cn("text-2xl font-bold mb-4 z-10", "text-white")}>
          {title}
        </h2>
        <Link href={href}>
          <span className="text-sm hover:text-secondary hover:underline">
            View all
          </span>
        </Link>
      </div>
      <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
        {items.map((item) => (
          <div key={item.id} className="flex-none w-40">
            <div className="relative w-full h-60">
              <img
                src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                alt={item.title || item.name}
                className="w-full h-full object-cover rounded transition transform hover:scale-95"
              />
            </div>
            <div className="text-white text-center mt-2 overflow-hidden">
              {item.title || item.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function MoviesPage() {
  const [popularMovies, topRatedMovies] = await Promise.all([
    fetchTMDBData("/movie/popular"),
    fetchTMDBData("/movie/top_rated"),
  ]);

  const popularMoviesWithCategories = await buildItemsWithCategories(
    popularMovies.results,
    "movie",
  );
  const topRatedMoviesWithCategories = await buildItemsWithCategories(
    topRatedMovies.results,
    "movie",
  );

  return (
    <>
      <ContentRowActual
        title="Popular Movies"
        items={popularMoviesWithCategories}
        href="/movies?sort=popular"
      />
      <ContentRowActual
        title="Top Rated Movies"
        items={topRatedMoviesWithCategories}
        href="/movies?sort=top_rated"
      />
    </>
  );
}
