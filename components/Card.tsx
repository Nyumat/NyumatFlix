import { IconPlayerPlay } from "@tabler/icons";
import moment from "moment";
import Image from "next/image";
import { useRouter } from "next/router";
import { Movie, TvShow } from "../utils/typings";

const IMAGE_WIDTH = 500;
const IMAGE_HEIGHT = 550;

interface MovieCardProps {
  movie: Movie;
}

const MovieCard = ({ movie }: MovieCardProps) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/movies/watch/${movie.id}`);
  };

  return (
    <div
      className="card cursor-pointer"
      onClick={handleClick}
      tabIndex={0}
      aria-label={movie.title}
      role="button"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          handleClick();
        }
      }}
    >
      <div className="image-container">
        <Image
          className="image"
          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
          alt={movie.title}
          aria-label={movie.title}
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
        />
      </div>
      <div className="info">
        <IconPlayerPlay
          className="opacity-50 hover:opacity-100 cursor-pointer absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          size={48}
          stroke={1}
          color={"rgba(251, 244, 244, 0.75)"}
        />
        <h1 className="title">{movie.title}</h1>
        <p className="date">
          {moment(movie.release_date).format("MMMM Do, YYYY")}
        </p>
        <p className="rating">
          {movie.vote_average === 0 ? "Upcoming" : movie.vote_average}
        </p>
      </div>
    </div>
  );
};

const TvShowCard = ({ tvShow }: { tvShow: TvShow }) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/tvshows/watch/${tvShow.id}`);
  };

  return (
    <div
      className="card cursor-pointer"
      onClick={handleClick}
      tabIndex={0}
      role="button"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          handleClick();
        }
      }}
    >
      <div className="image-container">
        <Image
          className="image"
          src={`https://image.tmdb.org/t/p/w500/${tvShow.poster_path}`}
          alt={tvShow.name}
          width={IMAGE_WIDTH}
          height={IMAGE_HEIGHT}
        />
      </div>
      <div className="info">
        <IconPlayerPlay
          className="opacity-50 hover:opacity-100 cursor-pointer absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          size={48}
          stroke={1}
          color={"rgba(251, 244, 244, 0.75)"}
        />
        <h1 className="title">{tvShow.name}</h1>
        <p className="date">
          {moment(tvShow.first_air_date).format("MMMM Do, YYYY")}
        </p>
        <p className="rating">{tvShow.vote_average}</p>
      </div>
    </div>
  );
};

interface CardProps {
  item: Movie | TvShow;
  selected?: boolean;
  setSelected?: React.Dispatch<React.SetStateAction<boolean>>;
}

const Card = ({ item }: CardProps) => {
  if (!item || item.media_type === "person") return null;
  return (
    <div className="container mx-auto">
      {item.name ? (
        <TvShowCard tvShow={item as TvShow} />
      ) : (
        <MovieCard movie={item as Movie} />
      )}
    </div>
  );
};

export default Card;
