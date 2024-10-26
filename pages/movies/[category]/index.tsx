import Card from "@components/Card";
import PageTransition from "@components/Transition";
import { API_KEY, BASE_URL } from "@utils/requests";
import { Movie, TmdbResponse } from "@utils/typings";
import axios from "axios";
import { ChevronLeft } from "lucide-react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useInView } from "react-intersection-observer";

interface Props {
  initialMovies: TmdbResponse;
  category: string;
}

const GENRE_IDS = {
  action: 28,
  adventure: 12,
  animation: 16,
  comedy: 35,
  crime: 80,
  documentary: 99,
  drama: 18,
  family: 10751,
  fantasy: 14,
  history: 36,
  horror: 27,
  music: 10402,
  mystery: 9648,
  romance: 10749,
  scifi: 878,
  thriller: 53,
  war: 10752,
  western: 37,
};

const categoryTitles: { [key: string]: string } = {
  popular: "Popular Movies",
  top_rated: "Top Rated Movies",
  upcoming: "Upcoming Movies",
  now_playing: "Now Playing Movies",
  horror: "Horror Movies",
  thriller: "Thriller Movies",
  action: "Action Movies",
  comedy: "Comedy Movies",
  romance: "Romance Movies",
  documentary: "Documentary Movies",
  drama: "Drama Movies",
  fantasy: "Fantasy Movies",
  scifi: "Sci-Fi Movies",
  adventure: "Adventure Movies",
  animation: "Animated Movies",
  crime: "Crime Movies",
  music: "Music Movies",
  mystery: "Mystery Movies",
  war: "War Movies",
  western: "Western Movies",
  history: "History Movies",
  family: "Family Movies",
};

const TMDB_BASE_URL = BASE_URL;

export const filterMovies = (movies: Movie[]): Movie[] => {
  if (!Array.isArray(movies)) return [];
  return movies.filter((movie) => {
    if (!movie || typeof movie !== "object") return false;
    if (!movie.poster_path) return false;
    if (movie.adult) return false;
    if (movie.original_language !== "en") return false;
    return true;
  });
};

const isGenreCategory = (category: string): boolean => {
  return category in GENRE_IDS;
};

const getApiUrl = (category: string, page: number): string => {
  if (isGenreCategory(category)) {
    return `${TMDB_BASE_URL}/discover/movie?api_key=${API_KEY}&language=en-US&page=${page}&with_genres=${
      GENRE_IDS[category as keyof typeof GENRE_IDS]
    }&region=US&include_adult=false&certification_country=US&certification.lte=PG-13`;
  }
  return `${TMDB_BASE_URL}/movie/${category}?api_key=${API_KEY}&language=en-US&page=${page}&region=US&include_adult=false&certification_country=US&certification.lte=PG-13`;
};

export default function CategoryPage({ initialMovies, category }: Props) {
  const router = useRouter();
  const [movies, setMovies] = useState<Movie[]>(() => {
    const initialResults = initialMovies?.results || [];
    return filterMovies(initialResults as Movie[]); // This is a hack — TODO: Declare better types
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const { ref, inView } = useInView();

  const fetchMoreMovies = async () => {
    if (loading || !hasMore) return;

    try {
      setLoading(true);
      const nextPage = page + 1;
      const response = await axios.get(getApiUrl(category, nextPage));
      const newMovies = filterMovies(response.data?.results || []);

      if (newMovies.length === 0) {
        setHasMore(false);
        return;
      }

      setMovies((prev) => [...prev, ...newMovies]);
      setPage(nextPage);
    } catch (error) {
      console.error("Error fetching movies:", error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inView) {
      fetchMoreMovies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  const renderContent = () => {
    if (router.isFallback) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-t-white border-white/20 rounded-full animate-spin" />
        </div>
      );
    }

    if (!movies.length) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen">
          <h2 className="text-xl text-white mb-4">No movies found</h2>
          <Link
            href="/movies"
            className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Movies
          </Link>
        </div>
      );
    }

    return (
      <PageTransition>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-bold text-white">
              {categoryTitles[category] || "Movies"}
            </h1>
            <Link
              href="/movies"
              className="flex items-center gap-2 text-white hover:text-gray-300 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back to Movies
            </Link>
          </div>

          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {movies.map((movie: Movie) => (
              <Card key={`${movie.id}-${movie.title}`} item={movie} />
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
    );
  };

  return (
    <>
      <Head>
        <title>{`${categoryTitles[category] || "Movies"} | NyumatFlix`}</title>
        <meta
          name="description"
          content={`View ${categoryTitles[category] || "movies"} on NyumatFlix.`}
        />
      </Head>
      {renderContent()}
    </>
  );
}

export async function getStaticPaths() {
  const categories = [
    "popular",
    "top_rated",
    "upcoming",
    "now_playing",
    "horror",
    "thriller",
    "action",
    "comedy",
    "romance",
    "documentary",
    "drama",
    "fantasy",
    "scifi",
    "adventure",
    "animation",
    "crime",
    "music",
    "mystery",
    "war",
    "western",
    "history",
    "family",
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

    const filteredMovies = filterMovies(response.data.results);

    if (filteredMovies.length === 0) {
      return {
        notFound: true,
      };
    }

    return {
      props: {
        initialMovies: {
          results: filteredMovies,
        },
        category: params.category,
      },
      revalidate: 60 * 60,
    };
  } catch (error) {
    console.error("Error fetching movies:", error);
    return {
      notFound: true,
    };
  }
}
