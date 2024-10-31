import Card from "@components/Card";
import PageTransition from "@components/Transition";
import { API_KEY, BASE_URL, filterContent } from "@utils/requests";
import { MediaItem, TmdbResponse, TvShow } from "@utils/typings";
import axios from "axios";
import { ChevronLeft } from "lucide-react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

interface Props {
  initialTvShows: TmdbResponse;
  category: string;
}

const GENRE_IDS = {
  action_adventure: 10759,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  kids: 10762,
  mystery: 9648,
  news: 10763,
  reality: 10764,
  sci_fi_fantasy: 10765,
  soap: 10766,
  talk: 10767,
  war_politics: 10768,
  western: 37,
} as const;

const categoryTitles: Record<string, string> = {
  popular: "Popular TV Shows",
  top_rated: "Top Rated TV Shows",
  airing_today: "Airing Today",
  on_the_air: "Currently Airing",
  action_adventure: "Action & Adventure Shows",
  animation: "Animated Shows",
  comedy: "Comedy Shows",
  crime: "Crime Shows",
  documentary: "Documentary Shows",
  drama: "Drama Shows",
  family: "Family Shows",
  kids: "Kids Shows",
  mystery: "Mystery Shows",
  news: "News Shows",
  reality: "Reality Shows",
  sci_fi_fantasy: "Sci-Fi & Fantasy Shows",
  soap: "Soap Shows",
  talk: "Talk Shows",
  war_politics: "War & Politics Shows",
  western: "Western Shows",
};

const isGenreCategory = (category: string): boolean => {
  return category in GENRE_IDS;
};

const getApiUrl = (category: string, page: number): string => {
  const baseParams =
    "language=en-US&include_null_first_air_dates=false&region=US";

  if (isGenreCategory(category)) {
    return `${BASE_URL}/discover/tv?api_key=${API_KEY}&${baseParams}&page=${page}&with_genres=${
      GENRE_IDS[category as keyof typeof GENRE_IDS]
    }`;
  }
  return `${BASE_URL}/tv/${category}?api_key=${API_KEY}&${baseParams}&page=${page}`;
};

export const filterTvShows = (tvShows: TvShow[]): TvShow[] => {
  if (!Array.isArray(tvShows)) return [];
  return tvShows.filter((show) => {
    if (!show || typeof show !== "object") return false;
    if (!show.poster_path) return false;
    if (show.original_language !== "en") return false;
    return true;
  });
};

export default function CategoryPage({ initialTvShows, category }: Props) {
  const router = useRouter();
  const [shows, setShows] = useState<MediaItem[]>(() => {
    const initialResults = initialTvShows?.results || [];
    return filterTvShows(initialResults as TvShow[]); // TODO: This is a hack
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { ref, inView } = useInView();

  const fetchMoreContent = async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      const nextPage = page + 1;
      const response = await axios.get(getApiUrl(category, nextPage));
      const newContent = await filterContent(
        response.data?.results || [],
        "tv",
      );

      if (newContent.length === 0) {
        setHasMore(false);
        return;
      }

      setShows((prev) => [...prev, ...newContent]);
      setPage(nextPage);
    } catch (error) {
      console.error("Error fetching content:", error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inView) {
      fetchMoreContent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  if (router.isFallback) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-t-white border-white/20 rounded-full animate-spin" />
      </div>
    );
  }

  if (!shows.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-xl text-white mb-4">No TV shows found</h2>
        <Link
          href="/tvshows"
          className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to TV Shows
        </Link>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{`${categoryTitles[category] || "TV Shows"} | NyumatFlix`}</title>
        <meta
          name="description"
          content={`View ${categoryTitles[category] || "TV shows"} on NyumatFlix.`}
        />
      </Head>
      <PageTransition>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-bold text-white">
              {categoryTitles[category] || "TV Shows"}
            </h1>
            <Link
              href="/tvshows"
              className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back to TV Shows
            </Link>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {shows.map((show) => (
              <Card
                key={`${show.id}-${show.title}`}
                item={show}
                mediaType="tv"
              />
            ))}
          </div>

          {hasMore && (
            <div
              ref={ref}
              className="w-full h-20 flex items-center justify-center"
            >
              {loading && (
                <div className="w-8 h-8 border-4 border-t-white border-white/20 rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>
      </PageTransition>
    </>
  );
}

export async function getStaticPaths() {
  const categories = [
    "popular",
    "top_rated",
    "airing_today",
    "on_the_air",
    "action_adventure",
    "animation",
    "comedy",
    "crime",
    "documentary",
    "drama",
    "family",
    "kids",
    "mystery",
    "news",
    "reality",
    "sci_fi_fantasy",
    "soap",
    "talk",
    "war_politics",
    "western",
  ];

  const paths = categories.map((category) => ({
    params: { category },
  }));

  return {
    paths,
    fallback: true,
  };
}

export async function getStaticProps({
  params,
}: {
  params: { category: string };
}) {
  try {
    const response = await axios.get(getApiUrl(params.category, 1));

    if (!response?.data?.results) {
      throw new Error("Invalid API response");
    }

    const filteredContent = await filterContent(response.data.results, "tv");

    if (filteredContent.length === 0) {
      return {
        notFound: true,
      };
    }

    return {
      props: {
        initialTvShows: {
          results: filteredContent,
        },
        category: params.category,
      },
      revalidate: 60 * 60,
    };
  } catch (error) {
    console.error("Error fetching content:", error);
    return {
      notFound: true,
    };
  }
}
