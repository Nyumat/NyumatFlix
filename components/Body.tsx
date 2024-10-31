/* eslint-disable react/display-name */
import { Chip, Loader } from "@mantine/core";
import React, { forwardRef } from "react";
import { MapGenreMovie, MediaItem, Movie, TvShow } from "../utils/typings";
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
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
}

const ChipComponent = React.memo(({ genre }: { genre: string }) => (
  <Chip color="cyan">{MapGenreMovie[parseInt(genre)]}</Chip>
));

const CardComponent = React.memo(
  ({ data, onClick }: { data: Movie | TvShow; onClick: () => void }) => (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      className="cursor-pointer"
      onKeyDown={onClick}
    >
      {data.media_type === "movie" ? (
        <Card item={data} mediaType="movie" />
      ) : (
        <Card item={data} mediaType="tv" />
      )}
    </div>
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
      {filterData ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filterData?.filter_data.map(
            (item: Movie | TvShow, index: number) => (
              <>
                {item.media_type === "movie" ? (
                  <CardComponent key={index} data={item} onClick={handleShow} />
                ) : (
                  <CardComponent key={index} data={item} onClick={handleShow} />
                )}
              </>
            ),
          )}
        </div>
      ) : (
        <h1 className="text-2xl text-center">
          No content found with these filters.
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
        {!show && (
          <>
            <div>
              <ChipList filter={filter} />
            </div>
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
  if (searchData && isLoaded && !show) {
    const filteredSearchData = searchData.filter(
      (item: MediaItem) => item.media_type !== "person",
    );

    const renderMessage = () => (
      <div className="text-center text-2xl font-bold text-gray-500 pt-4">
        No Results Found
      </div>
    );

    return (
      <>
        {isLoaded && filteredSearchData.length === 0 && (
          <div className="flex justify-center">{renderMessage()}</div>
        )}

        {isLoaded && filteredSearchData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredSearchData.map((item: Movie | TvShow, index: number) => (
              <CardComponent
                key={index}
                data={item}
                onClick={() => setShow(true)}
              />
            ))}
          </div>
        )}
      </>
    );
  } else if (show === true && children) {
    return <>{children}</>;
  } else {
    return (
      <div className="flex justify-center">
        <Loader size="xl" />
      </div>
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
      show,
      setShow,
    }: BodyProps,
    ref: React.Ref<HTMLDivElement>,
  ) => {
    const handleShow = () => {
      if (currentState === "all") setShow(true);
      else setShow((prev) => !prev);
    };

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
