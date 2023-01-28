import React from "react";
import { useRouter } from "next/router";
import PopOutTransition from "../../../../components/PopOutTransition";
import { useEffect } from "react";
import Hero from "../../../../components/Hero";
import axios from "axios";
import { Movie } from "../../../../typings";
import GenreBadges from "../../../../components/GenreBadges";
import moment from "moment";
import CastCarousel from "../../../../components/CastCarousel";
import { Text, Rating, Group, Stack } from "@mantine/core";
import { Actor, CreditsReponse } from "../../../../typings";
import MoviePlayer from "../../../../components/MoviePlayer";
import useAvailable from "../../../../hooks/useAvailable";

interface PlayerProps {
  movie: Movie;
  actors: Actor[];
}

const Player = ({ movie, actors }: PlayerProps) => {
  const router = useRouter();
  const { id } = router.query;
  const ts_id = parseInt(id as string);

  const [isAvailable] = useAvailable(ts_id);

  console.log(isAvailable);

  return (
    <div className="h-screen w-full">
      <Text
        component="span"
        variant="gradient"
        gradient={{ from: "#c5c9c6", to: `aliceblue` }}
        className="z-50 font-bold text-2xl xs:text-lg sm:text-xl absolute bottom-[50%] text-white mr-8 p-2 w-full text-right"
      >
        {moment(movie.release_date).format("MMMM Do, YYYY")}
      </Text>

      <Hero
        backdrop_path={movie.backdrop_path}
        title={movie.title}
        poster_path={movie.poster_path}
        genres={movie.genres}
      />

      <div className="flex flex-row items-center justify-center">
        <p className="text-white font-bold text-2xl absolute bottom-[42vh] tracking-wide">
          Cast List
        </p>
        <div className="absolute transform -translate-y-1/2 top-[105vh] w-full h-full my-10 z-10">
          <CastCarousel actors={actors} />
        </div>
        <div className="absolute transform -translate-y-1/2 top-[140vh] w-full h-full my-10 z-10">
          <div className="flex flex-row items-end justify-center">
            <GenreBadges
              genres={movie.genres}
              poster_path={movie.poster_path}
              backdrop_path={movie.backdrop_path}
            />
          </div>
          <h1 className="py-8 text-center align-middle text-2xl h-min text-white">
            {movie.overview}
          </h1>

          <div className="flex flex-col items-center justify-center my-12">
            <Rating
              value={movie.vote_average}
              size="xl"
              count={10}
              color="blue"
              readOnly
              fractions={movie.vote_average}
              defaultValue={movie.vote_average}
            />
            <p className="mt-2 tracking-wide">{movie.vote_average} / 10</p>
          </div>

          <>
            {isAvailable ? (
              <MoviePlayer id={ts_id.toString()} />
            ) : (
              <p className="tracking-wide text-center text-2xl">
                The movie you are trying to watch is currently not available on
                NyumatFlix.
              </p>
            )}
          </>
        </div>
      </div>
    </div>
  );
};

export async function getServerSideProps(context: any) {
  const { id } = context.query;

  let movieDetails = await axios.get(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.API_KEY}&language=en-US`,
  );

  let staffData = await axios.get(
    `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${process.env.API_KEY}&language=en-US`,
  );

  let nonNullPosterCast = staffData.data.cast.filter((actor: Actor) => {
    return actor.profile_path !== null;
  });

  let sortedTopTenCast = nonNullPosterCast
    .sort((a: Actor, b: Actor) => {
      return b.popularity - a.popularity;
    })
    .slice(0, 10);

  return {
    props: {
      movie: movieDetails.data,
      actors: sortedTopTenCast,
    },
  };
}

export default Player;
