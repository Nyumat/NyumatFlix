/* eslint-disable @typescript-eslint/no-explicit-any */
import Card from "@components/Card";
import PageTransition from "@components/Transition";
import requests from "@utils/requests";
import { Movie, Title, TmdbResponse, TvShow } from "@utils/typings";
import axios from "axios";

interface Props {
  titles: Title[];
  trendingTvShows: TvShow[];
  trendingMovies: Movie[];
}

const Page = ({ titles, trendingTvShows, trendingMovies }: Props) => {
  const trendingData: TmdbResponse = [trendingMovies, trendingTvShows];

  return (
    <>
      <PageTransition>
        <div>
          {titles.map((title: any, index: number) => (
            <div key={title.query}>
              <h1 className="text-4xl font-bold text-white">{title.title}</h1>
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4 mb-4">
                {trendingData &&
                  trendingData[index].map((item: any) => (
                    <Card key={item.id} item={item} />
                  ))}

                {/*
                Todo: Implement Load More
                <Button
                  className="col-span-2 md:col-span-3 lg:col-span-4"
                  variant="outline"
                  color="cyan"
                  size="lg"
                >
                  Load More
                </Button> */}
              </div>
            </div>
          ))}
        </div>
      </PageTransition>
    </>
  );
};

export async function getStaticProps() {
  const titles: Title[] = [
    { query: "trending_movies", title: "Trending Movies" },
    { query: "trending_tvshows", title: "Trending Tv Shows" },
  ];

  const filterOutNull = (data: any) => {
    const filterData = data.filter((item: any) => item.vote_count !== 0);
    return filterData;
  };

  const [TrendingMovies, TrendingTvShows] = await Promise.all([
    axios
      .get(requests.fetchTrendingMovies)
      .then((res) => filterOutNull(res.data.results)),
    axios.get(requests.fetchTrendingTvShows).then((res) => res.data.results),
  ]);

  //console.log(TrendingMovies);

  return {
    props: {
      titles,
      trendingMovies: TrendingMovies,
      trendingTvShows: TrendingTvShows,
    },
  };
}

export default Page;
