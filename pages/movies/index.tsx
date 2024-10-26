import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import PageTransition from "@components/Transition";
import Card from "@components/Card";
import { MOVIE_CATEGORIES } from "@utils/requests";
import { Movie } from "@utils/typings";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { filterMovies } from "./[category]";
import axios from "axios";

interface MovieCategory {
  title: string;
  movies: Movie[];
  query: string;
}

interface Props {
  initialCategories: MovieCategory[];
  categoryKeys: string[];
}

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

const CategoryRow = ({ category }: { category: MovieCategory }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="mb-8">
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
          {isLoaded
            ? category.movies.map((movie: Movie) => (
                <div key={movie.id} className="flex-none w-[200px]">
                  <Card item={movie} />
                </div>
              ))
            : [...Array(5)].map((_, i) => (
                <div key={i} className="flex-none w-[200px] animate-pulse">
                  <div className="w-full aspect-[2/3] bg-gray-700 rounded-lg mb-2" />
                  <div className="h-4 bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-700 rounded w-1/2" />
                </div>
              ))}
        </div>
      </div>
    </div>
  );
};

const Page = ({ initialCategories, categoryKeys }: Props) => {
  const [loadedCategories, setLoadedCategories] =
    useState<MovieCategory[]>(initialCategories);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const remainingKeysRef = useRef(categoryKeys.slice(5));

  const fetchNextCategories = async () => {
    const nextKeys = remainingKeysRef.current.slice(0, 5);
    if (nextKeys.length === 0) return;

    const categories = await Promise.all(
      nextKeys.map(async (categoryKey) => {
        const category =
          MOVIE_CATEGORIES[categoryKey as keyof typeof MOVIE_CATEGORIES];
        const movies = await fetchMoviesUntilCount(categoryKey, category, 10);
        return {
          query: categoryKey,
          title: category.title,
          movies,
        };
      }),
    );

    remainingKeysRef.current = remainingKeysRef.current.slice(5);
    return categories;
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        if (
          entries[0].isIntersecting &&
          !isLoading &&
          remainingKeysRef.current.length > 0
        ) {
          setIsLoading(true);
          const newCategories = await fetchNextCategories();
          if (newCategories) {
            setLoadedCategories((prev) => [...prev, ...newCategories]);
          }
          setIsLoading(false);
        }
      },
      { rootMargin: "200px" },
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [isLoading]);

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
          {loadedCategories.map((category) => (
            <CategoryRow key={category.query} category={category} />
          ))}
          {remainingKeysRef.current.length > 0 && (
            <div
              ref={loaderRef}
              className="h-20 flex items-center justify-center"
            >
              {isLoading && (
                <div className="w-8 h-8 border-4 border-t-white border-white/20 rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>
      </PageTransition>
    </>
  );
};

export async function getStaticProps() {
  try {
    const allCategories = [
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

    const initialCategories = await Promise.all(
      allCategories.slice(0, 5).map(async (categoryKey) => {
        const category =
          MOVIE_CATEGORIES[categoryKey as keyof typeof MOVIE_CATEGORIES];
        const movies = await fetchMoviesUntilCount(categoryKey, category, 10);
        return {
          query: categoryKey,
          title: category.title,
          movies,
        };
      }),
    );

    return {
      props: {
        initialCategories,
        categoryKeys: allCategories,
      },
      revalidate: 60 * 60, // Revalidate every hour
    };
  } catch (error) {
    console.error("Error fetching movies:", error);
    return {
      props: {
        initialCategories: [],
        categoryKeys: [],
      },
      revalidate: 60,
    };
  }
}

export default Page;
