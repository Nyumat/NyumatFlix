/* eslint-disable react/display-name */
import { Chip, Loader } from "@mantine/core";
import React, { forwardRef, useCallback, useState } from "react";
import { MapGenreMovie, Movie, TvShow } from "../utils/typings";
import Card from "./Card";

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
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setFilter: React.Dispatch<React.SetStateAction<string[]>>;
  searchTerm?: string;
  setCurrentState: React.Dispatch<React.SetStateAction<string>>;
}

const ChipComponent = React.memo(({ genre }: { genre: string }) => (
  <Chip color="cyan">{MapGenreMovie[parseInt(genre)]}</Chip>
));

const CardComponent = React.memo(
  ({ data, onClick }: { data: Movie | TvShow; onClick: () => void }) => (
    <span onClick={onClick} role="button" tabIndex={0} onKeyDown={onClick}>
      <Card item={data} />
    </span>
  ),
);

const ChipList = ({ filter }: { filter: string[] }) => (
  <div className="flex flex-wrap gap-2 my-4">
    {filter[0] !== "" &&
      !filter[1] &&
      filter
        .filter((genre) => genre !== "")
        .map((genre, index) => <ChipComponent key={index} genre={genre} />)}
  </div>
);

const MovieList = ({
  filterData,
  handleShow,
}: {
  filterData: Data | undefined;
  handleShow: () => void;
}) => {
  return (
    <>
      {filterData && filterData.filter_data.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filterData.filter_data.map(
            (movie: Movie | TvShow, index: number) => (
              <CardComponent key={index} data={movie} onClick={handleShow} />
            ),
          )}
        </div>
      ) : (
        <h1 className="text-2xl text-center">
          No movies found with these filters.
        </h1>
      )}
    </>
  );
};

export const renderChips = (
  filter: string[],
  filterData: Data | undefined,
  show: boolean,
  children: React.ReactNode,
  handleShow: () => void,
) => {
  if (filter.length > 0) {
    return (
      <>
        <div>
          <ChipList filter={filter} />
        </div>

        {show && children}
        {!show && (
          <>
            <MovieList filterData={filterData} handleShow={handleShow} />
          </>
        )}
      </>
    );
  }
};

export const renderSearch = (
  searchData: Movie[] | undefined,
  isLoaded: boolean | undefined,
  show: boolean,
  setShow: React.Dispatch<React.SetStateAction<boolean>>,
  children: React.ReactNode,
) => {
  if (searchData) {
    // TODO: Fix bug where no such results found shows on first keypress regardless of search term
    const renderMessage = () => {
      return (
        <div className="text-center text-2xl font-bold text-gray-500 pt-4">
          No Results Found
        </div>
      );
    };

    const filteredSearchData = searchData.filter((item) => {
      return item.media_type !== "person";
    });

    return (
      <>
        {isLoaded && searchData.length === 0 && (
          <div className="flex justify-center">{renderMessage()}</div>
        )}

        {show && children}
        {!show && (
          <>
            {!isLoaded ? (
              <div className="flex justify-center">
                <Loader />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredSearchData.map(
                  (movie: Movie | TvShow, index: number) => (
                    <div
                      className="cursor-pointer flex flex-grow"
                      key={index}
                      onClick={() => setShow(true)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={() => setShow(true)}
                    >
                      <Card key={index} item={movie} />
                    </div>
                  ),
                )}
              </div>
            )}
          </>
        )}
      </>
    );
  }
};

const Body = forwardRef(
  (
    {
      children,
      filter,
      searchData,
      currentState,
      filterData,
      isLoaded,
    }: BodyProps,
    ref: React.Ref<HTMLDivElement>,
  ) => {
    const [show, setShow] = useState<boolean>(false);

    const handleShow = useCallback(() => setShow(true), []);

    return (
      <div className="w-full" ref={ref}>
        {currentState === "search" &&
          renderSearch(searchData, isLoaded, show, setShow, children)}
        {currentState === "filter" &&
          renderChips(filter, filterData, show, children, handleShow)}
        {currentState === "all" && children}
      </div>
    );
  },
);

export default Body;
