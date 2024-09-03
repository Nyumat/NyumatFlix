"use client";
import { fetchTMDBData, Movie } from "@/app/home/page";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

async function fetchMoreItems(
  currentPage: number,
  endpoint: string,
): Promise<Movie[]> {
  const nextPage = currentPage + 1;
  const data = await fetchTMDBData(endpoint, {}, nextPage);

  return data.results; // Return the newly fetched items
}

export function Wrap({
  popularMoviesWithCategories,
  topRatedMoviesWithCategories,
}: {
  popularMoviesWithCategories: Movie[];
  topRatedMoviesWithCategories: Movie[];
}) {
  const [popularMoviesPage, setPopularMoviesPage] = useState(1);
  const [topRatedMoviesPage, setTopRatedMoviesPage] = useState(1);

  return (
    <main className="mt-4">
      <ContentRow
        title="Popular Movies"
        items={popularMoviesWithCategories}
        href="/movies"
        fetchMoreItems={() =>
          fetchMoreItems(popularMoviesPage, "/movie/popular").then(
            (newItems) => {
              setPopularMoviesPage((prevPage) => prevPage + 1);
              return newItems;
            },
          )
        }
      />
      <ContentRow
        title="Top Rated Movies"
        items={topRatedMoviesWithCategories}
        href="/movies?sort=top_rated"
        fetchMoreItems={() =>
          fetchMoreItems(topRatedMoviesPage, "/movie/top_rated").then(
            (newItems) => {
              setTopRatedMoviesPage((prevPage) => prevPage + 1);
              return newItems;
            },
          )
        }
      />
    </main>
  );
}

export function ContentRow({
  title,
  items,
  href,
  fetchMoreItems,
}: {
  title: string;
  items: any[];
  href: string;
  fetchMoreItems: () => Promise<any[]>;
}) {
  const [currentItems, setCurrentItems] = useState(items);
  const observerRef = useRef<HTMLDivElement | null>(null);

  const handleObserver = async (entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting) {
      const newItems = await fetchMoreItems();
      setCurrentItems((prevItems) => [...prevItems, ...newItems]);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "20px",
      threshold: 0.5,
    });

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
      }
    };
  }, []);

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
      <div className="flex space-x-4 overflow-x-auto pb-4">
        {currentItems.map((item) => (
          <div key={item.id} className="flex-none w-40">
            <img
              src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
              alt={item.title || item.name}
              className="w-full h-full object-cover rounded transition transform hover:scale-95"
            />
            <div className="text-white text-center">
              {item.title || item.name}
            </div>
          </div>
        ))}
        {/* Observer element */}
        <div ref={observerRef} className="h-10" />
      </div>
    </div>
  );
}
