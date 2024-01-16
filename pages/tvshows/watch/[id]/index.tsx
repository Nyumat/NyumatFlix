import CastCarousel from "@components/CastCarousel";
import GenreBadges from "@components/GenreBadges";
import Hero from "@components/Hero";
import { Player as TvPlayer } from "@components/Player";
import PageTransition from "@components/Transition";
import { Rating, Text } from "@mantine/core";
import { Actor, TvShow } from "@utils/typings";
import axios from "axios";
import moment from "moment";
import { useRouter } from "next/router";

interface TVPlayerProps {
  tvshow: TvShow;
  actors: Actor[];
  url?: string;
}

const WatchTvPage = ({ tvshow, actors, url }: TVPlayerProps) => {
  const router = useRouter();

  // useEffect(() => {
  //       if (!router.isReady) return;
  // }, [router.isReady]);

  const { id } = router.query;
  const ts_id = parseInt(id as string);

  // const { isAvailable } = useAvailable(ts_id);
  //   const isAvailable = true;

  //console.log(tvshow);

  return (
    <PageTransition>
      <div className="h-screen w-full">
        <Hero
          backdrop_path={tvshow.backdrop_path}
          title={tvshow.name}
          poster_path={tvshow.poster_path}
          genres={tvshow.genres}
          release_date={tvshow.first_air_date ?? "Unknown"}
        />

        <div className="flex flex-col items-center justify-center">
          <Text
            component="span"
            variant="gradient"
            gradient={{ from: "#c5c9c6", to: `aliceblue` }}
            className="font-bold text-2xl xs:text-xl sm:text-xl text-white w-full text-center mt-20"
          >
            Released: {moment(tvshow.first_air_date).format("MMMM Do, YYYY")}
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
                genres={tvshow.genres}
                poster_path={tvshow.poster_path}
                backdrop_path={tvshow.backdrop_path}
              />
            </div>
            <h1 className="py-8 text-center align-middle text-2xl h-min text-white md:max-w-lg xl:max-w-2xl xs:max-w-xs  mx-auto">
              {tvshow.overview.split(" ").slice(0, 30).join(" ")}...
            </h1>

            <div className="flex flex-col items-center justify-center my-12 scale-100 md:scale-75 xs:scale-75 lg:scale-100 sm:scale-75">
              <Rating
                value={tvshow.vote_average}
                size="xl"
                count={10}
                color="blue"
                readOnly
                fractions={tvshow.vote_average}
                defaultValue={tvshow.vote_average}
              />
              <p className="mt-2 tracking-wide">{tvshow.vote_average} / 10</p>
            </div>

            <p className="text-white font-bold text-md tracking-wide my-12 max-w-sm italic mx-auto text-center">
              Note: The episode selector is on the top left of the video player.
            </p>

            <>
              <TvPlayer url={url} id={ts_id.toString()} />
            </>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getServerSideProps(context: any) {
  const { id } = context.query;
  // rest of the code...

  // TODO: Check periodically for tmdb ID fix
  //   const url = process.env.NYUMATFLIX_VPS2 + `${id}`;

  if (id === undefined) {
    return {
      notFound: true,
    };
  }

  const tvShowDetails = await axios.get(
    `https://api.themoviedb.org/3/tv/${id}?api_key=${process.env.API_KEY}&language=en-US&append_to_response=external_ids`,
  );

  const adjustedUrl =
    process.env.NYUMATFLIX_VPS2 + tvShowDetails.data.external_ids.imdb_id;

  const staffData = await axios.get(
    `https://api.themoviedb.org/3/tv/${id}/credits?api_key=${process.env.API_KEY}&language=en-US`,
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
      tvshow: tvShowDetails.data,
      actors: sortedTopTenCast,
      url: adjustedUrl,
    },
  };
}

export default WatchTvPage;
