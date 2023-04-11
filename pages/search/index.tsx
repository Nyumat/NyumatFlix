import {
  TextInput,
  TextInputProps,
  ActionIcon,
  useMantineTheme,
  Loader,
} from "@mantine/core";
import { IconSearch, IconArrowRight, IconArrowLeft } from "@tabler/icons";
import { useEffect, useState } from "react";
import axios from "axios";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import Card from "../../components/Card";
import { Movie, TvShow } from "../../typings";
import useDebounceSearch from "../../hooks/useDebounceSearch";

const Search = (props: TextInputProps) => {
  const theme = useMantineTheme();
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounceSearch(search, 500);
  const [page, setPage] = useState<number>(1);
  const [searchData, setSearchData] = useState<any>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // const [parent] = useAutoAnimate<HTMLDivElement>();

  useEffect(() => {
    if (debouncedSearch.length === 0) {
      setIsLoading(false);
      setSearchData([]);
    }

    if (debouncedSearch.length > 0) {
      setIsLoading(true);
      axios
        .get(`/api/search`, {
          params: {
            query: search,
            page: page,
          },
        })
        .then((res) => {
          let data = res.data.search_data.filter((item: Movie | TvShow) => {
            return item.poster_path !== null && item.vote_average !== 0;
          });
          setTimeout(() => {
            setIsLoading(false);
            setSearchData(data);
            setTotalPages(res.data.total_pages);
          }, 800);
        });
    }
  }, [debouncedSearch]);

  const renderMessage = () => {
    if (searchData.length === 0) {
      return (
        <div className="text-center text-2xl font-bold text-gray-500 pt-4">
          No Results Found
        </div>
      );
    }
  };

  return (
    <>
      <TextInput
        icon={<IconSearch size={18} stroke={1.5} />}
        radius="xl"
        size="md"
        onChange={(e) => setSearch(e.currentTarget.value)}
        rightSection={
          <ActionIcon
            size={32}
            radius="xl"
            color={theme.primaryColor}
            variant="filled"
          >
            {theme.dir === "ltr" ? (
              <IconArrowRight size={18} stroke={1.5} />
            ) : (
              <IconArrowLeft size={18} stroke={1.5} />
            )}
          </ActionIcon>
        }
        placeholder="Search For a Movie or TV Show here."
        rightSectionWidth={42}
        {...props}
      />

      {isLoading ? (
        <div className="flex justify-center items-center h-96">
          <Loader className="m-auto" color="indigo" size="lg" variant="dots" />
        </div>
      ) : (
        <>{searchData.length === 0 && renderMessage()}</>
      )}

      {!isLoading && (
        <div
          // ref={parent}
          className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-4 gap-4 my-4"
        >
          {searchData &&
            searchData.map((movie: any) => {
              if (movie.poster_path !== null || movie.vote_average !== 0) {
                return <Card key={movie.id} item={movie} />;
              } else {
                return null;
              }
            })}
        </div>
      )}
    </>
  );
};

export default Search;
