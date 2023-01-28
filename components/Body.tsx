import { MapGenreMovie, Movie, TvShow } from "../typings";
import Card from "./Card";
import { Chip, Loader } from "@mantine/core";
import { useAutoAnimate } from "@formkit/auto-animate/react";

type Data = {
  filter_data: TvShow[] | Movie[];
};

interface BodyProps {
  children: React.ReactNode;
  filter: string[];
  movies?: Movie[];
  searchData?: Movie[];
  currentState?: string;
  filterData?: Data;
  isLoaded?: boolean;
  filterLoading?: boolean;
}

const Body = ({
  children,
  filter,
  searchData,
  currentState,
  filterData,
  isLoaded,
  filterLoading,
}: BodyProps) => {
  const [parent] = useAutoAnimate({
    duration: 650,
    easing: "ease-in-out",
  });

  const renderChips = () => {
    if (filter.length > 1) {
      return (
        <>
          <div>
            <div className="flex flex-wrap gap-2 my-4">
              {filter[0] === "" && !filter[1] ? (
                <Chip color="cyan">All</Chip>
              ) : (
                filter
                  .filter((genre) => genre !== "")
                  .map((genre, index) => (
                    <Chip key={index} color="cyan">
                      {MapGenreMovie[parseInt(genre)]}
                    </Chip>
                  ))
              )}
            </div>
          </div>
          {filterLoading ? (
            <div className="flex justify-center">
              <Loader />
            </div>
          ) : null}

          {filterData && filterData.filter_data.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filterData.filter_data.map((movie, index) => (
                  <Card key={index} item={movie} />
              ))}
            </div>
          ) : (
            <h1 className="text-2xl text-center">
              No movies found with these filters.
            </h1>
          )}
          {/* {searchData && searchData.length > 0 ? renderSearch() : <Loader />}
           */}
        </>
      );
    }
  };

  const renderSearch = () => {
    if (searchData) {
      const renderMessage = () => {
        return (
          <div className="text-center text-2xl font-bold text-gray-500 pt-4">
            No Results Found
          </div>
        );
      };

      return (
        <>
          {isLoaded && searchData.length === 0 ? (
            <div className="flex justify-center">{renderMessage()}</div>
          ) : null}

          {!isLoaded ? (
            <div className="flex justify-center">
              <Loader />
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {searchData.map((movie, index) => (
                  <div key={index} className="w-full">
                    <Card key={index} item={movie} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      );
    }
  };
  return (
    <div ref={parent as React.RefObject<HTMLDivElement>} className="w-full">
      {currentState === "search" ? renderSearch() : null}
      {currentState === "filter" ? renderChips() : null}
      {currentState === "all" ? children : null}
    </div>
  );
};

export default Body;
