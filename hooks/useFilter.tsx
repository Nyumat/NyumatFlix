import { useState, useEffect, useMemo } from "react";
import { MapGenreMovie, Movie, TvShow } from "../typings";
import axios from "axios";
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
  const [page, setPage] = useState(1);

  let capitalFirstLetter = filterString?.charAt(0).toUpperCase();
  if (capitalFirstLetter === undefined) {
    capitalFirstLetter = "";
  }
  let restOfWord = filterString?.slice(1);
  let capitalFirstLetterAndRestOfWord = capitalFirstLetter + restOfWord;

  const genresInFilter = filterString?.split(",");
  const genres = genresInFilter?.map((genre) => MapGenreMovie[parseInt(genre)]);


  console.log("filterString", filterString);
  console.log("capitalFirstLetter", capitalFirstLetter);
  console.log("restOfWord", restOfWord);
  console.log("capitalFirstLetterAndRestOfWord", capitalFirstLetterAndRestOfWord);
  console.log("genresInFilter", genresInFilter);
  console.log("genres", genres);

  const fetchData = async () => {
    console.log("fetching data");
    console.log(filterString);
    setIsLoading(true);
    try {
      const result = await axios(`/api/filter`, {
        params: {
          filter: filterString,
          page: page,
        },
      });
      console.log(result.data);
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

    if (filter.length > 1) {
      fetchData();
    }
  }, [filter]);

  return { filterData, filterLoading, filterError };
};

export default useFilter;
