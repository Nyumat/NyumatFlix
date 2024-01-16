import Card from "@components/Card";
import PageTransition from "@components/Transition";
import requests from "@utils/requests";
import { Title, TmdbResponse, TvShow } from "@utils/typings";
import axios from "axios";
import Head from "next/head";

interface Props {
  popularTvShows: TvShow[];
  topRatedTvShows: TvShow[];
  airingTodayTvShows: TvShow[];
  onTheAirTvShows: TvShow[];
  titles: Title[];
}

const Page = ({
  popularTvShows,
  topRatedTvShows,
  airingTodayTvShows,
  onTheAirTvShows,
  titles,
}: Props) => {
  const tvShows: TmdbResponse = [
    popularTvShows,
    topRatedTvShows,
    airingTodayTvShows,
    onTheAirTvShows,
  ];
  /*
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState<any>([popularTvShows]);

  const fetchMoreData = async (e: any) => {
    e.preventDefault();
    setPage(page + 1);
    await fetch(`/api/tvshows?page=${page}`)
      .then((res) => res.json())
      .then((data) => {
        const copy = [...pages];
        setPages([...copy, data]);
      });
  };
*/
  return (
    <>
      <Head>
        <title>Tv Shows | NyumatFlix</title>
      </Head>
      <PageTransition>
        <div>
          {titles.map((title: Title, index: number) => (
            <div key={title.query}>
              <h1 className="text-4xl font-bold text-white">{title.title}</h1>
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4 mb-4">
                {tvShows[index].results.map((tvShow: TvShow) => (
                  <Card key={tvShow.id} item={tvShow} />
                ))}
                {/* TODO: Fix this/Add it back
                <Button
                  onClick={fetchMoreData}
                  className="bg-red-600 text-white font-bold"
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
    { title: "Top Rated TV Series", query: "top_rated" },
    { title: "Airing Today", query: "airing_today" },
    { title: "Popular Series", query: "popular" },
    { title: "On The Air", query: "on_the_air" },
  ];

  const [popularTvShows, topRatedTvShows, airingTodayTvShows, onTheAirTvShows] =
    await Promise.all([
      axios.get(requests.fetchTopRatedTvShows).then((res) => res.data),
      axios.get(requests.fetchAiringTodayTvShows).then((res) => res.data),
      axios.get(requests.fetchPopularTvShows).then((res) => res.data),
      axios.get(requests.fetchOnTheAirTvShows).then((res) => res.data),
    ]);

  return {
    props: {
      popularTvShows,
      topRatedTvShows,
      airingTodayTvShows,
      onTheAirTvShows,
      titles,
    },
  };
}

export default Page;
