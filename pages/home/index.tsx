import axios from "axios";
import Card from "../../components/Card";
import { MediaQuery, Aside, AsideProps, Button } from "@mantine/core";
import requests from "../../utils/requests";
import { TvShow, Title, TmdbResponse, Movie } from "../../typings";

interface Props {
  titles: Title[];
  trendingTvShows: TvShow[];
  trendingMovies: Movie[];
}

const Page = ({ titles, trendingTvShows, trendingMovies }: Props) => {
  const trendingData: TmdbResponse = [trendingMovies, trendingTvShows];

  return (
    <div>
      {titles.map((title: any, index: number) => (
        <div key={title.query}>
          <h1 className="text-4xl font-bold text-white">{title.title}</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 my-8">
            {trendingData &&
              trendingData[index].results.map((item: any) => (
                <Card key={item.id} item={item} />
              ))}
            <Button
              className="col-span-4"
              variant="outline"
              color="cyan"
              size="lg"
            >
              Load More
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export async function getStaticProps() {
  const titles: Title[] = [
    { query: "trending_movies", title: "Trending Movies" },
    { query: "trending_tvshows", title: "Trending Tv Shows" },
  ];

  const [TrendingMovies, TrendingTvShows] = await Promise.all([
    axios.get(requests.fetchTrendingMovies).then((res) => res.data),
    axios.get(requests.fetchTrendingTvShows).then((res) => res.data),
  ]);

  return {
    props: {
      titles,
      trendingMovies: TrendingMovies,
      trendingTvShows: TrendingTvShows,
    },
  };
}

export default Page;
