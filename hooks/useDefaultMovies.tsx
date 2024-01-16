import React, { useEffect } from "react";
import { Movie } from "../utils/typings";
const useDefaultMovies = (page: number) => {
  const [defaultData, setData] = React.useState<Movie[]>([]);
  const [defaultLoading, setLoading] = React.useState(true);
  const [defaultError, setError] = React.useState(false);
  const [totalPages, setTotalPages] = React.useState(0);

  useEffect(() => {
    fetch(`/api/movies?page=${page}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data.movies);
        setTotalPages(data.total_pages);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
      });
  }, [page]);

  return { defaultData, defaultLoading, defaultError, totalPages };
};

export default useDefaultMovies;
