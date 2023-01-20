import axios from "axios";
import Card from "../../components/Card";
import { MediaQuery, Aside, AsideProps, Button } from "@mantine/core";
import requests from "../../utils/requests";
import { TvShow, Title, TmdbResponse, Movie } from "../../typings";
import moment from "moment";
import React from "react";

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
              trendingData[index].map((item: any) => (
                <Card key={item.id} item={item} />
              ))}

            <Button
              className="col-span-2 md:col-span-3 lg:col-span-4"
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

  return {
    props: {
      titles,
      trendingMovies: TrendingMovies,
      trendingTvShows: TrendingTvShows,
    },
  };
}

export default Page;
