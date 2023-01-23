import Image from "next/image";
import { Movie, TvShow } from "../typings";
import moment from "moment";
import Link from "next/link";
import { useRouter } from "next/router";

const MovieCard = ({ movie }: { movie: Movie }) => {
  const router = useRouter();

  const handleClick = () => {
    router.push({
      pathname: `/movies/watch/[id]`,
      query: { id: movie.id },
    });
  };

  if (movie.poster_path === null) return null;
  if (moment(movie.release_date).isAfter(moment())) return null;
  return (
    <div className="bg-shark-900 p-2 shadow-sm rounded-lg h-full">
      <div className="flex flex-col items-center">
        <div className="relative z-10 hover:scale-105 transition duration-500 ease-in-out">
          <Image
            className="rounded-lg inset-0 bg-cover bg-center z-0"
            src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
            alt={movie.title}
            width={500}
            onClick={handleClick}
            height={550}
          />
        </div>
      </div>
      <div className="mx-2 my-2 flex flex-row justify-between">
        <div className="flex flex-col">
          <h1 className="text-white text-lg font-bold mr-4">{movie.title}</h1>
          <p className="text-white text-sm">
            {moment(movie.release_date).format("MMMM Do, YYYY")}
          </p>
        </div>
        <p className="text-white text-sm flex flex-row">{movie.vote_average}</p>
      </div>
    </div>
  );
};

const TvShowCard = ({ tvShow }: { tvShow: TvShow }) => {
  if (tvShow.poster_path === null) return null;
  if (tvShow.vote_average === 0) return null;
  return (
    <div className="bg-shark-900 p-2 shadow-sm rounded-lg h-full">
      <div className="flex flex-col items-center">
        <div className="relative z-10 hover:scale-105 transition duration-500 ease-in-out">
          <Image
            className="rounded-lg inset-0 bg-cover bg-center z-0"
            src={`https://image.tmdb.org/t/p/w500/${tvShow.poster_path}`}
            alt={tvShow.name}
            width={500}
            height={550}
          />
        </div>
      </div>
      <div className="mx-2 my-2 flex flex-col justify-between">
        <h1 className="text-white text-lg font-bold">{tvShow.name}</h1>
        <p className="text-white text-sm">
          {moment(tvShow.first_air_date).format("MMMM Do, YYYY")}
        </p>
        <p className="text-white text-sm">{tvShow.vote_average}</p>
      </div>
    </div>
  );
};

const Card = ({ item }: { item: any }) => {
  if (!item) return null;
  if (item.media_type === "person") return null;
  return (
    <div className="container mx-auto">
      {item.name ? <TvShowCard tvShow={item} /> : <MovieCard movie={item} />}
    </div>
  );
};

export default Card;
