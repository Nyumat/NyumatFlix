import { useState, useEffect } from "react";
import { Movie, TvShow } from "../typings";
import axios from "axios";

interface FilterHookProps {
  filter: string[];
}

type Data = {
  filter_data: Movie[] | TvShow[];
};

const useFilter = ({ filter }: FilterHookProps) => {
  let parsedFilterString = filter.join(",").substring(1);
  const [filterData, setData] = useState<Data>({ filter_data: [] });
  const [filterLoading, setIsLoading] = useState(false);
  const [filterError, setError] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const result = await axios(`/api/filter`, {
          params: {
            filter: parsedFilterString,
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

    fetchData();
  }, [parsedFilterString]);

  return { filterData, filterLoading, filterError };
};

export default useFilter;
