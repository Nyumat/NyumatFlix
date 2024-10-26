import { Badge, MediaQuery } from "@mantine/core";
import { MapGenreMovie } from "@utils/typings";

interface GenreBadgesProps {
  genres: {
    id: number;
    name: string;
  }[];
  poster_path?: string; // will be used for gradient
  backdrop_path?: string; // will be used for gradient (if poster_path is not available)
}

const GenreBadges = ({ genres }: GenreBadgesProps) => {
  return (
    <>
      <MediaQuery
        smallerThan="lg"
        largerThan="xs"
        styles={{
          display: "none",
        }}
      >
        <div
          // className="flex flex-row items-center justify-center mx-8 sm:mx-16 md:mx-32 lg:mx-64 pb-8 gap-2 flex-wrap"
          className="inline-flex flex-row items-center justify-center mx-8 sm:mx-16 md:mx-32 lg:mx-64 pb-8 gap-2 flex-wrap"
        >
          {genres &&
            genres.map((genre, index) => {
              return (
                <Badge
                  key={index}
                  variant="gradient"
                  // gradient={{ from: "gray", to: `${color}` }}
                  gradient={{ from: "darkgray", to: "darkgray" }}
                  radius="md"
                  size="xl"
                  className="mx-2 text-black"
                >
                  {MapGenreMovie[genre.id]}
                </Badge>
              );
            })}
        </div>
      </MediaQuery>
    </>
  );
};

export default GenreBadges;
