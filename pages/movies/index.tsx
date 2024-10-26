import Card from "@components/Card";
import PageTransition from "@components/Transition";
import { MOVIE_CATEGORIES } from "@utils/requests";
import { Movie } from "@utils/typings";
import axios from "axios";
import { ChevronRight } from "lucide-react";
import Head from "next/head";
import Link from "next/link";
import { filterMovies } from "./[category]";

interface MovieCategory {
  title: string;
  movies: Movie[];
  query: string;
}

interface Props {
  categories: MovieCategory[];
}

const Page = ({ categories }: Props) => {
  return (
    <>
      <Head>
        <title>Movies | NyumatFlix</title>
        <meta
          name="description"
          content="View the latest movies on NyumatFlix."
        />
      </Head>
      <PageTransition>
        <div>
          {categories.map((category) => (
            <div key={category.query} className="mb-8">
              <div className="flex items-center justify-between mb-4 px-4">
                <h1 className="text-xl md:text-2xl lg:text-4xl font-bold text-white">
                  {category.title}
                </h1>
                <Link
                  href={`/movies/${category.query}`}
                  className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
                >
                  View All
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
              <div className="relative">
                <div className="flex overflow-x-scroll scrollbar-hide space-x-4 px-4">
                  {category.movies.map((movie: Movie) => (
                    <div key={movie.id} className="flex-none w-[200px]">
                      <Card item={movie} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </PageTransition>
    </>
  );
};

async function fetchMoviesUntilCount(
  categoryKey: string,
  category: (typeof MOVIE_CATEGORIES)[keyof typeof MOVIE_CATEGORIES],
  targetCount: number = 20,
): Promise<Movie[]> {
  let allMovies: Movie[] = [];
  let page = 1;
  const maxPages = 5;

  while (allMovies.length < targetCount && page <= maxPages) {
    const url = `${category.url}&page=${page}`;
    const response = await axios.get(url);
    const filteredMovies = filterMovies(response.data.results);
    allMovies = [...allMovies, ...filteredMovies];
    if (response.data.results.length === 0) break;
    page++;
  }

  return allMovies.slice(0, targetCount);
}

export async function getStaticProps() {
  try {
    const categoriesToShow = [
      "popular",
      "top_rated",
      "now_playing",
      "action",
      "animation",
      "adventure",
      "comedy",
      "drama",
      "thriller",
      "horror",
      "science_fiction",
      "fantasy",
      "family",
      "upcoming",
      "romance",
      "crime",
      "mystery",
      "documentary",
      "history",
      "music",
      "war",
      "western",
    ];

    const categoryPromises = categoriesToShow.map(async (categoryKey) => {
      const category =
        MOVIE_CATEGORIES[categoryKey as keyof typeof MOVIE_CATEGORIES];
      const movies = await fetchMoviesUntilCount(categoryKey, category);
      return {
        query: categoryKey,
        title: category.title,
        movies,
      };
    });

    const categories = await Promise.all(categoryPromises);

    return {
      props: {
        categories,
      },
      revalidate: 60 * 60,
    };
  } catch (error) {
    console.error("Error fetching movies:", error);
    return {
      props: {
        categories: [],
      },
      revalidate: 60,
    };
  }
}

export default Page;
