import Card from "@components/Card";
import PageTransition from "@components/Transition";
import useDebounceSearch from "@hooks/useDebounceSearch";
import {
  ActionIcon,
  Loader,
  TextInput,
  TextInputProps,
  useMantineTheme,
} from "@mantine/core";
import { IconArrowLeft, IconArrowRight, IconSearch } from "@tabler/icons";
import { Movie, TvShow } from "@utils/typings";
import axios from "axios";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const Search = (props: TextInputProps) => {
  const theme = useMantineTheme();
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounceSearch(search, 500);
  const [page] = useState<number>(1);
  const router = useRouter();
  const [searchData, setSearchData] = useState<Movie[] | TvShow[]>([]);
  const [, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // const [parent] = useAutoAnimate<HTMLDivElement>();

  const filteredSearchData = searchData.filter((item: Movie | TvShow) => {
    return item.media_type !== "person";
  });

  const handleClick = (
    e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
    movie_id: number,
  ) => {
    e.preventDefault();
    router.push({
      pathname: `/tvshows/watch/[id]`,
      query: { id: movie_id },
    });
  };

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
          const data = res.data.search_data.filter((item: Movie | TvShow) => {
            return item.poster_path !== null && item.vote_average !== 0;
          });
          setTimeout(() => {
            setIsLoading(false);
            setSearchData(data);
            setTotalPages(res.data.total_pages);
          }, 800);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const renderMessage = () => {
    if (searchData.length === 0 && search.length > 0) {
      return (
        <div className="text-center text-2xl font-bold text-gray-500 pt-32 ">
          No Results Found
        </div>
      );
    }
  };

  return (
    <>
      <PageTransition>
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
            <Loader
              className="m-auto"
              color="indigo"
              size="lg"
              variant="dots"
            />
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
              filteredSearchData.map((item: Movie | TvShow) => {
                if (item.poster_path !== null || item.vote_average !== 0) {
                  return (
                    <div
                      key={item.id}
                      onClick={(e) => {
                        handleClick(e, item.id);
                      }}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        handleClick(e, item.id);
                      }}
                    >
                      <Card key={item.id} item={item} />
                    </div>
                  );
                } else {
                  return null;
                }
              })}
          </div>
        )}
      </PageTransition>
    </>
  );
};

export default Search;
