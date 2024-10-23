"use client";

import { Movie } from "@/app/actions";
import { cn } from "@/lib/utils";
import { isMovie, MediaItem } from "@/utils/typings";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// async function fetchMoreItems(
//   currentPage: number,
//   endpoint: string,
// ): Promise<MediaItem[]> {
//   const nextPage = currentPage + 1;
//   const data = await fetchTMDBData(endpoint, {}, nextPage);

//   if (!data.results) {
//     return [] as MediaItem[];
//   }

//   return data.results;
// }

// export function Wrap({
//   popularMoviesWithCategories,
//   topRatedMoviesWithCategories,
// }: {
//   popularMoviesWithCategories: Movie[];
//   topRatedMoviesWithCategories: Movie[];
// }) {
//   const [popularMoviesPage, setPopularMoviesPage] = useState(1);
//   const [topRatedMoviesPage, setTopRatedMoviesPage] = useState(1);

//   return (
//     <main className="mt-4">
//       {/* <ContentRow
//         title="Popular Movies"
//         items={popularMoviesWithCategories}
//         href="/movies"
//         fetchMoreItems={() =>
//             fetchMoreItems(popularMoviesPage, "/movie/popular").then(
//                 (newItems) => {
//                 setPopularMoviesPage((prevPage) => prevPage + 1);
//                 return newItems;
//                 },
//             )
//         }
//       />
//       <ContentRow
//         title="Top Rated Movies"
//         items={topRatedMoviesWithCategories}
//         href="/movies?sort=top_rated"
//         fetchMoreItems={() =>
//           fetchMoreItems(topRatedMoviesPage, "/movie/top_rated").then(
//             (newItems) => {
//               setTopRatedMoviesPage((prevPage) => prevPage + 1);
//               return newItems;
//             },
//           )
//         }
//       /> */}
//     </main>
//   );
// }

export function ContentRow({
  title,
  items,
  href,
  fetchMoreItems,
}: {
  title: string;
  items: Movie[];
  href: string;
  fetchMoreItems: () => Promise<Movie[]>;
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

    const currentObserverRef = observerRef.current;

    if (currentObserverRef) {
      observer.observe(currentObserverRef);
    }

    return () => {
      if (currentObserverRef) {
        observer.unobserve(currentObserverRef);
      }
    };
    // eslint-disable-next-line
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
            <Image
              width={160}
              height={240}
              src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
              alt={item.title}
              className="w-full h-full object-cover rounded transition transform hover:scale-95"
            />
            <div className="text-white text-center">{item.title}</div>
          </div>
        ))}

        <div ref={observerRef} className="h-10" />
      </div>
    </div>
  );
}

export function ContentRowActual<T extends MediaItem>({
  title,
  items,
  href,
}: {
  title: string;
  items: T[];
  href: string;
}) {
  return (
    <div className="mx-8 mb-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold mb-4 z-10 text-white">{title}</h2>
        <Link href={href}>
          <span className="text-sm hover:text-secondary hover:underline">
            View all
          </span>
        </Link>
      </div>
      <div className="flex space-x-4 overflow-x-auto pb-4 scrollbar-hide">
        {items.map((item) => (
          <Link
            key={item.id}
            className="flex-none w-40"
            href={`/watch/${item.id}`}
          >
            <div className="relative w-full h-60 group">
              <Image
                width={300}
                height={450}
                src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
                alt={isMovie(item) ? item.title : item.name}
                className="w-full h-full object-cover rounded transition transform group-hover:scale-95"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-70 transition-opacity duration-300 flex items-center justify-center">
                <div className="text-white text-center p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
                  {isMovie(item) ? item.title : item.name}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
