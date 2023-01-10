import { IconSearch, IconAlertCircle } from "@tabler/icons";
import { Button, Input, Tooltip, Chip } from "@mantine/core";
import { useState } from "react";

const SideBar = () => {
  const [value, setValue] = useState([""]);

  return (
    <div className="container flex flex-col items-center justify-center w-full h-full">
      <div className="flex flex-col items-start justify-start w-full h-full">
        <h1 className="text-white text-lg font-bold mb-2">Search</h1>
        <Input
          // style={{ width: 270 }}
          icon={<IconSearch size={16} />}
          placeholder="Movies, TvShows, People..."
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
          <Chip.Group value={value} onChange={setValue} multiple>
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
