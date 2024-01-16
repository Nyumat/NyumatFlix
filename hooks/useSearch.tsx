import axios from "axios";
import { useEffect, useState } from "react";
import { Movie } from "../utils/typings";
import useDebounceSearch from "./useDebounceSearch";

interface useSearchProps {
  search: string;
}

const useSearch = ({ search }: useSearchProps) => {
  const debouncedSearch = useDebounceSearch(search, 800);
  const [searchLoading, setLoading] = useState<boolean>(false);
  const [searchData, setSearchData] = useState<Movie[]>([]);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [searchError, setError] = useState<boolean>(false);

  useEffect(() => {
    if (debouncedSearch.length === 0) {
      setLoading(false);
      setSearchData([]);
    }

    if (debouncedSearch) {
      setLoading(true);
      axios
        .get(`/api/search`, {
          params: {
            query: search,
            page: page,
          },
        })
        .then((res) => {
          const data = res.data.search_data.filter((item: Movie) => {
            return item.poster_path !== null && item.vote_average !== 0;
          });
          setTimeout(() => {
            setLoading(false);
            setSearchData(data);
            setTotalPages(res.data.total_pages);
          }, 1000);
        })
        .catch(() => {
          setError(true);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, page]);

  return { searchLoading, searchData, totalPages, page, setPage, searchError };
};

export default useSearch;
