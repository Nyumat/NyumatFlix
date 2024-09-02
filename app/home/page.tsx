import { cn } from "@/lib/utils";
import { HeroSection } from "./render-row";

export const metadata = {
  title: "Shadcn - Landing template",
  description: "Free Shadcn landing page for developers",
  openGraph: {
    type: "website",
    url: "https://github.com/nobruf/shadcn-landing-page.git",
    title: "Shadcn - Landing template",
    description: "Free Shadcn landing page for developers",
    images: [
      {
        url: "https://res.cloudinary.com/dbzv9xfjp/image/upload/v1723499276/og-images/shadcn-vue.jpg",
        width: 1200,
        height: 630,
        alt: "Shadcn - Landing template",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "https://github.com/nobruf/shadcn-landing-page.git",
    title: "Shadcn - Landing template",
    description: "Free Shadcn landing page for developers",
    images: [
      "https://res.cloudinary.com/dbzv9xfjp/image/upload/v1723499276/og-images/shadcn-vue.jpg",
    ],
  },
};

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

// export default async function Home() {
//   const fetchAllData = async () => {
//     const [popularMovies, topRatedMovies, popularTVShows] = await Promise.all([
//       fetchTMDBData('/movie/popular'),
//       fetchTMDBData('/movie/top_rated'),
//       fetchTMDBData('/tv/popular'),
//     ]);

//     return {
//       popularMovies: popularMovies.results,
//       topRatedMovies: topRatedMovies.results,
//       popularTVShows: popularTVShows.results,
//     };
//   };

//   const data = await fetchAllData();

//   return (
    // <div className="bg-black text-white min-h-screen">
    //   <header className="py-4 px-8">
    //     <h1 className="text-red-600 text-4xl font-bold">NEXTFLIX</h1>
    //   </header>
    //   <main className="px-8">
    //     <HeroSection movie={data.popularMovies[0]} />
    //     <ContentRow title="Popular Movies" items={data.popularMovies} />
    //     <ContentRow title="Top Rated Movies" items={data.topRatedMovies} />
    //     <ContentRow title="Popular TV Shows" items={data.popularTVShows} />
    //   </main>
    // </div>
//   );
// }

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

async function getCategoriesForMovie(): Promise<Genre[]> {
  const genres = await fetch(
    `https://api.themoviedb.org/3/genre/movie/list?api_key=${process.env.TMDB_API_KEY}`,
  ).then((res) => res.json());
  return genres.genres;
}

export default async function Home() {
  const fetchAllData = async () => {
    const [popularMovies, topRatedMovies, popularTVShows] = await Promise.all([
      fetchTMDBData("/movie/popular"),
      fetchTMDBData("/movie/top_rated"),
      fetchTMDBData("/tv/popular"),
    ]);

    return {
      popularMovies: popularMovies.results,
      topRatedMovies: topRatedMovies.results,
      popularTVShows: popularTVShows.results,
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

  return (
    <div className="min-h-screen">
    <main>
      {/* Only show the movies (very) popular */}
      <HeroSection movies={popularMoviesWithCategories.filter((movie => movie.popularity > 1500))} />
      <ContentRow title="Popular Movies" items={popularMoviesWithCategories} />
      <ContentRow
        title="Top Rated Movies"
        items={topRatedMoviesWithCategories}
      />
      <ContentRow
        title="Popular TV Shows"
        items={popularTVShowsWithCategories}
      />
    </main>
  </div>
  );
}

function ContentRow({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="mx-8 mb-8">
      <h2 className={cn("text-2xl font-bold mb-4 z-10", "text-white")}>{title}</h2>
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {items.map((item) => (
          <div key={item.id} className="flex-none w-40">
            <img
              src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
              alt={item.title || item.name}
              className="w-full h-60 object-cover rounded transition transform hover:scale-105"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
