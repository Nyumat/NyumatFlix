"use client";

export const BrowseWrap = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>;
};

import { getMovies } from "@/app/actions";
import { ContentGrid } from "@/components/content-grid";
import { MovieResult } from "moviedb-promise";
import { useCallback, useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

export function InfiniteScrollMovies({
  initialMovies,
  title,
}: {
  initialMovies: MovieResult[];
  type: string;
  title: string;
}) {
  const [movies, setMovies] = useState(initialMovies);
  const [page, setPage] = useState(1);
  const [ref, inView] = useInView();

  useEffect(() => {
    if (inView) {
      loadMore();
    }
    // eslint-disable-next-line
  }, [inView]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    const res = await getMovies("popular", nextPage);
    const moviesRaw = res.results!;
    setMovies([...movies, ...moviesRaw]);
    setPage(nextPage);
  }, [page, movies]);

  return (
    <>
      {movies.length > 0 ? (
        <>
          <ContentGrid items={movies} title={title} />
          <div ref={ref} style={{ height: "20px" }}></div>
        </>
      ) : (
        <p>Loading...</p>
      )}
    </>
  );
}
