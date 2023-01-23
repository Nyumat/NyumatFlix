import React from "react";
import { useRouter } from "next/router";
import PopOutTransition from "../../../../components/PopOutTransition";
import { useEffect } from "react";
import Hero from "../../../../components/Hero";
import axios from "axios";
import { Movie } from "../../../../typings";
import GenreBadges from "../../../../components/GenreBadges";
import { Text } from "@mantine/core";
import moment from "moment";

interface PlayerProps {
  movie: Movie;
}

const Player = ({ movie }: PlayerProps) => {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    console.log(id);
  }, [id]);

  return (
    <>
      <div className="flex flex-col items-center justify-center h-screen">
        <Hero
          backdrop_path={movie.backdrop_path}
          title={movie.title}
          poster_path={movie.poster_path}
          genres={movie.genres}
        />
      </div>

      <Text
        component="span"
        variant="gradient"
        gradient={{ from: "#c5c9c6", to: `aliceblue` }}
        className="relative -top-[20rem] text-2xl font-bold text-white text-start mx-6 my-2"
      >
        Released: {moment(movie.release_date).format("MMMM Do, YYYY")}
      </Text>

      {/* Badges don't have a great spot yet. */}

      <div className="flex flex-col items-center justify-center h-fit absolute transform -translate-y-1/2 top-[62%] w-full">
        <h1 className="text-4xl font-bold text-white my-2 text-center mb-2">
          <Text
            component="span"
            variant="gradient"
            gradient={{ from: "#c5c9c6", to: `aliceblue` }}
            styles={{
              fontFamily: "Source Sans Pro, sans-serif",
            }}
          >
            Genres
          </Text>
        </h1>

        <GenreBadges
          genres={movie.genres}
          poster_path={movie.poster_path}
          backdrop_path={movie.backdrop_path}
        />
      </div>

      <div className="flex flex-row absolute top-[70%] my-8 mx-4">
        <h1 className="text-4xl font-bold text-white text-start">
          <Text
            component="span"
            variant="gradient"
            gradient={{ from: "#c5c9c6", to: `aliceblue` }}
            styles={{
              fontFamily: "Source Sans Pro, sans-serif",
            }}
          >
            Overview:
          </Text>
        </h1>
        <p className="text-2xl font-bold text-white text-start mx-6 my-2 indent-2">
          <Text
            component="span"
            variant="gradient"
            gradient={{ from: "#c5c9c6", to: `aliceblue` }}
            styles={{
              fontFamily: "Source Sans Pro, sans-serif",
            }}
          >
            {movie.overview}
          </Text>
        </p>
      </div>
    </>
  );
};

export async function getServerSideProps(context: any) {
  const { id } = context.query;

  let response = await axios.get(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.API_KEY}&language=en-US`,
  );

  console.log(response.data.genres.map((genre: any) => [genre.id, genre.name]));

  return {
    props: {
      movie: response.data,
    },
  };
}

export default Player;
