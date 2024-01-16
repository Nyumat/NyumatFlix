import { renderChips, renderSearch } from "@components/Body";
import SideBar from "@components/SideBar";
import PageTransition from "@components/Transition";
import useCurrentState from "@hooks/useCurrentState";
import useDefaultMovies from "@hooks/useDefaultMovies";
import useFilter from "@hooks/useFilter";
import useLoading from "@hooks/useLoading";
import useSearch from "@hooks/useSearch";
import { Loader, Text } from "@mantine/core";
import { useState } from "react";
const Page = () => {
  const [filter, setFilter] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { currentState } = useCurrentState({
    filter,
    searchTerm,
  });
  const { filterData, filterLoading } = useFilter({ filter });
  const { searchData, searchLoading } = useSearch({ search: searchTerm });
  const { defaultLoading } = useDefaultMovies(1);

  const isLoaded = useLoading({ filterLoading, searchLoading, defaultLoading });

  const [show, setShow] = useState(false);
  const handleShow = () => setShow(!show);

  const filteredSearchData = searchData.filter((item) => {
    return item.media_type !== "person";
  });

  const children = (
    <>
      <div className="w-full flex flex-wrap justify-center mt-32">
        <Text className="text-2xl font-bold">
          {searchTerm.length === 0
            ? `Results Will Appear Here`
            : `Results for "${searchTerm}"`}
        </Text>
      </div>
    </>
  );

  // TODO: Fix bug where no such results found is not showing (Body.tsx)

  return (
    <>
      <PageTransition>
        <Text className="text-3xl font-bold">Find By Genre or Search</Text>
        <div className="w-full xs:w-full sm:w-full md:w-full lg:w-full xl:w-full flex flex-row">
          <SideBar
            searchTerm={searchTerm}
            filter={filter}
            setFilter={setFilter}
            setSearchTerm={setSearchTerm}
          />
        </div>

        {isLoaded ? (
          <div className="w-full">
            {currentState === "search" &&
              renderSearch(
                filteredSearchData,
                isLoaded,
                show,
                setShow,
                children,
              )}
            {currentState === "filter" &&
              renderChips(filter, filterData, show, children, handleShow)}
            {currentState === "all" && children}
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <Loader
              className="m-auto"
              color="indigo"
              size="lg"
              variant="dots"
            />
          </div>
        )}
      </PageTransition>
    </>
  );
};

export default Page;
