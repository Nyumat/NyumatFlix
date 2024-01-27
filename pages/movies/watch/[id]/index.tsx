/* eslint-disable @typescript-eslint/no-explicit-any */
import CastCarousel from "@components/CastCarousel";
import GenreBadges from "@components/GenreBadges";
import Hero from "@components/Hero";
import { Player as MoviePlayer } from "@components/Player";
import PageTransition from "@components/Transition";
import { Rating, Text } from "@mantine/core";
import { Actor, Movie } from "@utils/typings";
import axios from "axios";
import moment from "moment";
import { useRouter } from "next/router";

interface PlayerProps {
  movie: Movie;
  actors: Actor[];
  url?: string;
}

const WatchMovie = ({ movie, actors, url }: PlayerProps) => {
  const router = useRouter();

  const { id } = router.query;
  const ts_id = parseInt(id as string);

  // const { isAvailable } = useAvailable(ts_id);
  //console.log(url);
  if (!url) {
    return (
      <div>
        <p>Movie not available</p>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="h-screen w-full">
        <Hero
          backdrop_path={movie.backdrop_path}
          title={movie.title}
          poster_path={movie.poster_path}
          genres={movie.genres}
          release_date={movie.release_date ?? "Unknown"}
        />

        <div className="flex flex-col items-center justify-center">
          <Text
            component="span"
            variant="gradient"
            gradient={{ from: "#c5c9c6", to: `aliceblue` }}
            className="font-bold text-2xl xs:text-xl sm:text-xl text-white w-full text-center mt-20"
          >
            Released: {moment(movie.release_date).format("MMMM Do, YYYY")}
          </Text>
          <p className="text-white font-bold text-2xl tracking-wide mt-12">
            Cast List
          </p>
          <div className="w-full h-full my-10 z-10">
            <CastCarousel actors={actors} />
          </div>
          <div className="w-full h-full my-10 z-10">
            <div className="flex flex-row items-end justify-center">
              <GenreBadges
                genres={movie.genres}
                poster_path={movie.poster_path}
                backdrop_path={movie.backdrop_path}
              />
            </div>
            <h1 className="py-8 text-center align-middle text-2xl h-min text-white md:max-w-lg xl:max-w-2xl xs:max-w-xs  mx-auto">
              {movie.overview.split(" ").slice(0, 30).join(" ")}...
            </h1>

            <div className="flex flex-col items-center justify-center my-12 scale-100 md:scale-75 xs:scale-75 lg:scale-100 sm:scale-75">
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
              <MoviePlayer url={url} id={ts_id.toString()} />
            </>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export async function getServerSideProps(context: any) {
  const { id } = context.query;
  const url = process.env.NYUMATFLIX_VPS + `${id}`;

  if (id === undefined) {
    return {
      notFound: true,
    };
  }

  const movieDetails = await axios.get(
    `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.API_KEY}&language=en-US`,
  );

  const staffData = await axios.get(
    `https://api.themoviedb.org/3/movie/${id}/credits?api_key=${process.env.API_KEY}&language=en-US`,
  );

  const nonNullPosterCast = staffData.data.cast.filter((actor: Actor) => {
    return actor.profile_path !== null;
  });

  const sortedTopTenCast = nonNullPosterCast
    .sort((a: Actor, b: Actor) => {
      return b.popularity - a.popularity;
    })
    .slice(0, 10);

  return {
    props: {
      movie: movieDetails.data,
      actors: sortedTopTenCast,
      url: url,
    },
  };
}

export default WatchMovie;
