import { Input, MultiSelect, Tooltip } from "@mantine/core";
import { IconAlertCircle, IconChevronDown, IconSearch } from "@tabler/icons";
import { genres } from "@utils/typings";
import { useRouter } from "next/router";
import { useCallback } from "react";

interface SideBarProps {
  filter: string[];
  setFilter: React.Dispatch<React.SetStateAction<string[]>>;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  searchTerm: string;
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentState: React.Dispatch<React.SetStateAction<string>>;
}

const SideBar = ({
  filter,
  setFilter,
  setSearchTerm,
  searchTerm,
  show,
  setShow,
  setCurrentState,
}: SideBarProps) => {
  const router = useRouter();

  const handleChange = (value: string[]) => {
    setCurrentState("filter");
    setShow(false);
    setFilter(value);
  };

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key) {
        if (event.key === "Enter") {
          setCurrentState("search");
          setShow(false);
        }

        if (show) {
          setCurrentState("search");
          setShow(false);
        }

        if (searchTerm.length <= 0) {
          setShow(true);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, searchTerm, setShow, show],
  );
  /*
  If I ever want router.query.q to be the search term
  useEffect(() => {
    const searchTerm = router.query.q;
    if (searchTerm) {
      setSearchTerm(searchTerm.toString());
      router.push({
        pathname: "/search",
        query: { q: searchTerm },
      });
    }

    if (searchTerm === "" || searchTerm === undefined) {
      setSearchTerm("");
    }
  }, [router.query.q]);
*/

  return (
    <div className="container flex flex-col items-center justify-center w-full h-full">
      <div className="flex flex-col items-start justify-start w-full h-full">
        <h1 className="text-white text-lg font-bold my-2">Search</h1>
        <Input
          // style={{ width: 270 }}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          icon={<IconSearch size={16} />}
          value={searchTerm}
          placeholder="Shrek, Boondocks..."
          className="min-w-full"
          rightSection={
            <Tooltip
              label="Search for your favorites"
              position="top-end"
              withArrow
            >
              <div>
                <IconAlertCircle
                  size={18}
                  style={{ display: "block", opacity: 0.5 }}
                />
              </div>
            </Tooltip>
          }
        />
      </div>

      <div className="container flex flex-col items-start justify-center w-full h-full my-4">
        <h1 className="text-white text-lg font-bold my-2">Filter by Genre</h1>
        <MultiSelect
          value={filter}
          onChange={handleChange}
          data={genres.map((genre) => ({
            value: genre.id.toString(),
            label: genre.name,
          }))}
          placeholder="Select All That Apply."
          label="Genres"
          className="min-w-full"
          clearable
          clearButtonLabel="Clear selection"
          searchable
          nothingFound="No genres found"
          rightSection={
            <IconChevronDown
              size={18}
              style={{ display: "block", opacity: 0.5 }}
            />
          }
        />

        {/* <Chip.Group value={filter} onChange={handleChange} multiple>
          <Chip value="28">Action</Chip>
          <Chip value="12">Adventure</Chip>
          <Chip value="16">Animation</Chip>
          <Chip value="35">Comedy</Chip>
          <Chip value="80">Crime</Chip>
          <Chip value="99">Documentary</Chip>
          <Chip value="18">Drama</Chip>
          <Chip value="10751">Family</Chip>
          <Chip value="14">Fantasy</Chip>
          <Chip value="36">History</Chip>
          <Chip value="27">Horror</Chip>
          <Chip value="10402">Music</Chip>
          <Chip value="9648">Mystery</Chip>
          <Chip value="10749">Romance</Chip>
          <Chip value="878">Science Fiction</Chip>
          <Chip value="10770">TV Movie</Chip>
          <Chip value="53">Thriller</Chip>
          <Chip value="10752">War</Chip>
        </Chip.Group> */}
      </div>
    </div>
  );
};

export default SideBar;
