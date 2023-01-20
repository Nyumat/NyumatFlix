import axios from "axios";
import Card from "../../components/Card";
import { MediaQuery, Aside, AsideProps, Button } from "@mantine/core";
import requests from "../../utils/requests";
import { Movie, Title, TmdbResponse } from "../../typings";
import Head from "next/head";
import InfiniteScroll from "react-infinite-scroll-component";
import useSwr from "swr";
import { useEffect, useState } from "react";

interface Props {
  horrorMovies: Movie[];
  popularMovies: Movie[];
  topRatedMovies: Movie[];
  upcomingMovies: Movie[];
  titles: Title[];
}

const Page = ({
  popularMovies,
  topRatedMovies,
  upcomingMovies,
  horrorMovies,
  titles,
}: Props) => {
  const movies: TmdbResponse = [
    popularMovies,
    topRatedMovies,
    upcomingMovies,
    horrorMovies,
  ];

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState<any>([popularMovies]);

  const fetchMoreData = async (e: any) => {
    e.preventDefault();
    setPage(page + 1);
    await fetch(`/api/movies?page=${page}`)
      .then((res) => res.json())
      .then((data) => {
        let copy = [...pages];
        setPages([...copy, data]);
      });
  };

  return (
    <>
      <Head>
        <title>Movies | NyumatFlix</title>
      </Head>
      <div>
        {titles.map((title: any, index: number) => (
          <div key={title.query}>
            <h1 className="text-4xl font-bold text-white">{title.title}</h1>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 my-4">
              {movies &&
                movies[index].results.map((movie: Movie) => (
                  <Card key={movie.id} item={movie} />
                ))}
              <Button
                onClick={fetchMoreData}
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
    </>
  );
};

export async function getStaticProps() {
  const titles: Title[] = [
    { query: "popular", title: "Popular Movies" },
    { query: "top_rated", title: "Top Rated Movies" },
    { query: "upcoming", title: "Upcoming Movies" },
    { query: "horror", title: "Horror Movies" },
  ];

  const [PopularMovies, TopRatedMovies, UpcomingMovies, HorrorMovies] =
    await Promise.all([
      axios.get(requests.fetchPopularMovies).then((res) => res.data),
      axios.get(requests.fetchTopRatedMovies).then((res) => res.data),
      axios.get(requests.fetchUpcomingMovies).then((res) => res.data),
      axios.get(requests.fetchHorrorMovies).then((res) => res.data),
    ]);

  return {
    props: {
      popularMovies: PopularMovies,
      topRatedMovies: TopRatedMovies,
      upcomingMovies: UpcomingMovies,
      horrorMovies: HorrorMovies,
      titles,
    },
  };
}

export default Page;
