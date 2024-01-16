import { Text, Tooltip } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { useRouter } from "next/router";
interface HeroProps {
  backdrop_path: string;
  title: string;
  poster_path: string;
  genres: { id: number; name: string }[];
  release_date?: string;
}

const Hero = ({ backdrop_path, title, poster_path }: HeroProps) => {
  const router = useRouter();
  const handleGoBack = () => {
    router.back();
  };
  return (
    <>
      <Tooltip label="Go Back" position="top" transition="pop">
        <IconChevronLeft
          className="translate-y-10 translate-x-4 cursor-pointer w-6 h-6"
          onClick={handleGoBack}
        />
      </Tooltip>
      <div
        id="hero"
        className="flex flex-col w-full h-2/4 bg-cover top-0 bg-no-repeat"
        style={{
          backgroundImage: `url(https://image.tmdb.org/t/p/original${backdrop_path})`,
          borderRadius: "10px",
          boxShadow: "0 0 3px 3px rgba(0,0,0,0.5)",
          WebkitBoxShadow: "0 0 3px 3px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex flex-col items-center justify-center w-full h-full">
          <div className="absolute top-auto h-0 scale-[0.5] py-auto w-0 left-48 sm:left-10 xs:left-12 md:left-48 lg:left-48 xl:left-48">
            <div className="relative w-full h-full">
              <div
                className="w-full h-full absolute  top-0"
                style={{
                  backgroundImage: `url(http://image.tmdb.org/t/p/w185${poster_path})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  width: "200px",
                  height: "300px",
                  margin: "auto",
                  marginTop: "200px",
                  borderRadius: "10px",
                  boxShadow: "0 0 10px 10px rgba(0,0,0,0.5)",
                }}
              ></div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center w-full h-full bg-black bg-opacity-70">
            <h1 className="text-4xl font-bold text-white md:text-4xl lg:text-6xl pb-8 text-center w-full max-w-4xl px-12">
              {/* Possibly get secondary color to form better gradient */}
              <Text
                component="span"
                variant="gradient"
                gradient={{ from: "#c5c9c6", to: `aliceblue` }}
              >
                {title}
              </Text>
            </h1>

            {/* <GenreBadges
      genres={genres}
      poster_path={poster_path}
      backdrop_path={backdrop_path}
    /> */}
          </div>
        </div>

        {/* <div <--- Blur effect may be needed later
        className="absolute bottom-0 left-0 w-full h-32 bg-transparent bg-gradient-to-t
         from-gray-900 to-transparent drop-shadow-3xl opacity-75 backdrop-filter
         backdrop-blur-sm bg-blend-screen"
      ></div> */}
      </div>
    </>
  );
};

export default Hero;
