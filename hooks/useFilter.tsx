import axios from "axios";
import { useEffect, useState } from "react";
import { Movie, TvShow } from "../utils/typings";
interface FilterHookProps {
  filter: string[] | string | undefined;
}

type Data = {
  filter_data: Movie[] | TvShow[];
};

const useFilter = ({ filter }: FilterHookProps) => {
  const filterString = Array.isArray(filter) ? filter.join(",") : filter;
  const [filterData, setData] = useState<Data>({ filter_data: [] });
  const [filterLoading, setIsLoading] = useState(false);
  const [filterError, setError] = useState(false);
  const [page] = useState(1);

  let capitalFirstLetter = filterString?.charAt(0).toUpperCase();
  if (capitalFirstLetter === undefined) {
    capitalFirstLetter = "";
  }

  //   const genresInFilter = filterString?.split(",");
  //   const genres = genresInFilter?.map((genre) => MapGenreMovie[parseInt(genre)]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const result = await axios(`/api/filter`, {
        params: {
          filter: filterString,
          page: page,
        },
      });
      setData(result.data);
    } catch (error) {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!filter) {
      return;
    }

    if (filter === undefined) {
      return;
    }

    if (filter.length >= 1) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return { filterData, filterLoading, filterError };
};

export default useFilter;
