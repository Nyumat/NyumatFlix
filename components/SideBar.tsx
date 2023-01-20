import { IconSearch, IconAlertCircle } from "@tabler/icons";
import { Button, Input, Tooltip, Chip } from "@mantine/core";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { MapGenreMovie, Movie } from "../typings";

interface SideBarProps {
  filter: string[];
  setFilter: React.Dispatch<React.SetStateAction<string[]>>;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
}

const SideBar = ({ filter, setFilter, setSearchTerm }: SideBarProps) => {
  const router = useRouter();

  const handleChange = (value: string[]) => {
    setFilter(value);
    let res = value.map((item) => {
      return MapGenreMovie[parseInt(item)];
    });
    let parsed = res.join(",").substring(1).toLowerCase();
    router.push(
      {
        pathname: router.pathname,
        query: { filter: value },
      },
      `${router.pathname}?filter=${parsed}`,
      { shallow: true },
    );
  };

  useEffect(() => {
    if (filter.length === 1) {
      router.push(
        {
          pathname: router.pathname,
          query: { filter: [] },
        },
        `${router.pathname}`,
        { shallow: true },
      );
    }
  }, [router.query.filter]);

  return (
    <div className="container flex flex-col items-center justify-center w-full h-full">
      <div className="flex flex-col items-start justify-start w-full h-full">
        <h1 className="text-white text-lg font-bold mb-2">Search</h1>
        <Input
          // style={{ width: 270 }}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          icon={<IconSearch size={16} />}
          placeholder="Shrek, Boondocks..."
          rightSection={
            <Tooltip label="Search!" position="top-end" withArrow>
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

      <div className="container flex flex-col items-start justify-center w-full h-full mt-4">
        <h1 className="text-white text-lg font-bold">Genres</h1>
        <ul className="flex flex-col  items-start justify-center w-full h-full mt-2">
          <Chip.Group value={filter} onChange={handleChange} multiple>
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
          </Chip.Group>
        </ul>
      </div>
    </div>
  );
};

export default SideBar;
