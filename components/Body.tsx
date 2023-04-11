import { MapGenreMovie, Movie, TvShow } from "../typings";
import Card from "./Card";
import { Chip, Loader } from "@mantine/core";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import React, { useState } from "react";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/router";

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

const Body = ({
  children,
  filter,
  setCurrentState,
  searchData,
  currentState,
  filterData,
  isLoaded,
  filterLoading,
  setSearchTerm,
  setFilter,
  searchTerm,
}: BodyProps) => {
  const [parent] = useAutoAnimate({
    duration: 400,
    easing: "ease-out",
  });

  const [show, setShow] = useState<boolean>(false);
  const router = useRouter();
  const memoizedSearchTerm = useMemo(() => searchTerm, [searchTerm]);
  // const memoizedFilter = useMemo(() => filter, [filter]);

  useEffect(() => {
    if (currentState !== "all" && searchTerm!.length === 0) {
      router.push({
        pathname: `/movies/`,
      });
    }

    if (router.pathname.includes("watch")) {
      setShow(false);
    }
  }, [memoizedSearchTerm]);

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
          {/* {filterLoading ? (
            <div className="flex justify-center">
              <Loader />
            </div>
          ) : null} */}

          {show ? (
            children
          ) : (
            <>
              {filterData && filterData.filter_data.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filterData.filter_data.map((movie, index) => (
                    <span key={index} onClick={() => setShow(true)}>
                      <Card key={index} item={movie} />
                    </span>
                  ))}
                </div>
              ) : (
                <h1 className="text-2xl text-center">
                  No movies found with these filters.
                </h1>
              )}
            </>
          )}

          {/* {searchData && searchData.length > 0 ? renderSearch() : <Loader />}
           */}
        </>
      );
    }
  };

  const renderSearch = (children: React.ReactNode) => {
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

          {show && children}
          {!show && (
            <>
              {!isLoaded ? (
                <div className="flex justify-center">
                  <Loader />
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {searchData.map((movie, index) => (
                      <div
                        className="cursor-pointer flex flex-grow"
                        key={index}
                        onClick={() => setShow(true)}
                      >
                        <Card key={index} item={movie} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      );
    }
  };
  return (
    <div ref={parent as any} className="w-full">
      {currentState === "search" ? renderSearch(children) : null}
      {currentState === "filter" ? renderChips() : null}
      {currentState === "all" ? children : null}
    </div>
  );
};

export default Body;
