import React from "react";
import { Text } from "@mantine/core";
import GenreBadges from "./GenreBadges";
import { MediaQuery } from "@mantine/core";

interface HeroProps {
  backdrop_path: string;
  title: string;
  poster_path: string;
  genres: { id: number; name: string }[];
}

const Hero = ({ backdrop_path, title, poster_path, genres }: HeroProps) => {
  return (
    <div
      id="hero"
      className="flex flex-col w-full h-2/4 bg-cover top-0 bg-no-repeat absolute left-1/2 transform -translate-x-1/2"
      style={{
        backgroundImage: `url(https://image.tmdb.org/t/p/original${backdrop_path})`,
        borderRadius: "10px",
        boxShadow: "0 0 3px 3px rgba(0,0,0,0.5)",
      }}
    >
      <div className="flex flex-col items-center justify-center w-full h-full">
        <div className="absolute top-auto left-0 h-0 w-0 scale-[0.5] px-8 py-auto z-10">
          <div
            className="w-full h-full absolute top-0"
            style={{
              backgroundImage: `url(http://image.tmdb.org/t/p/w185${poster_path})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              width: "200px",
              height: "300px",
              margin: "auto",
              marginTop: "100px",
              borderRadius: "10px",
              boxShadow: "0 0 10px 10px rgba(0,0,0,0.5)",
            }}
          ></div>
        </div>
        <div className="flex flex-col items-center justify-center w-full h-full bg-black bg-opacity-70">
          <h1 className="text-4xl font-bold text-white md:text-4xl lg:text-6xl mx-8 pb-8 text-center w-full">
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
  );
};

export default Hero;
