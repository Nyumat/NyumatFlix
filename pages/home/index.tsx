import { CategoryRow } from "@components/CategoryRow";
import PageTransition from "@components/Transition";
import { CONTENT_CATEGORIES, fetchContentUntilCount } from "@utils/requests";
import { ContentCategory } from "@utils/typings";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";

interface Props {
  initialCategories: ContentCategory[];
  categoryKeys: { movie: string[]; tv: string[] };
}

const HomePage = ({ initialCategories, categoryKeys }: Props) => {
  const [loadedCategories, setLoadedCategories] =
    useState<ContentCategory[]>(initialCategories);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const remainingKeysRef = useRef({
    movie: categoryKeys.movie.slice(5),
    tv: categoryKeys.tv.slice(5),
  });

  const fetchNextCategories = async () => {
    const nextMovieKeys = remainingKeysRef.current.movie.slice(0, 3);
    const nextTvKeys = remainingKeysRef.current.tv.slice(0, 3);
    if (nextMovieKeys.length === 0 && nextTvKeys.length === 0) return;

    const categories = await Promise.all([
      ...nextMovieKeys.map((key) => getCategoryData(key, "movie")),
      ...nextTvKeys.map((key) => getCategoryData(key, "tv")),
    ]);

    remainingKeysRef.current.movie = remainingKeysRef.current.movie.slice(3);
    remainingKeysRef.current.tv = remainingKeysRef.current.tv.slice(3);
    return categories.filter(Boolean);
  };

  const getCategoryData = async (
    categoryKey: string,
    mediaType: "movie" | "tv",
  ) => {
    const category = CONTENT_CATEGORIES[mediaType][categoryKey];
    const items = await fetchContentUntilCount(
      categoryKey,
      category,
      mediaType,
      10,
    );
    return { query: categoryKey, title: category.title, items, mediaType };
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        if (
          entries[0].isIntersecting &&
          !isLoading &&
          (remainingKeysRef.current.movie.length > 0 ||
            remainingKeysRef.current.tv.length > 0)
        ) {
          setIsLoading(true);
          const newCategories = await fetchNextCategories();
          if (newCategories)
            setLoadedCategories((prev) => [...prev, ...newCategories]);
          setIsLoading(false);
        }
      },
      { rootMargin: "200px" },
    );

    if (loaderRef.current) observer.observe(loaderRef.current);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  return (
    <>
      <Head>
        <title>Home | NyumatFlix - Watch Movies & TV Shows</title>
        <meta
          name="description"
          content="Explore trending movies and TV shows on NyumatFlix."
        />
      </Head>
      <PageTransition>
        <div>
          {loadedCategories.map((category) => (
            <CategoryRow
              key={category.query}
              category={category}
              mediaType={category.mediaType ?? "movie"} // TODO: Handle this better
            />
          ))}
          {(remainingKeysRef.current.movie.length > 0 ||
            remainingKeysRef.current.tv.length > 0) && (
            <div
              ref={loaderRef}
              className="h-20 flex items-center justify-center"
            >
              {isLoading && (
                <div className="w-8 h-8 border-4 border-t-white border-white/20 rounded-full animate-spin" />
              )}
            </div>
          )}
        </div>
      </PageTransition>
    </>
  );
};

async function getCategoryInitialData(
  categoryKey: string,
  mediaType: "movie" | "tv",
) {
  const category = CONTENT_CATEGORIES[mediaType][categoryKey];
  const items = await fetchContentUntilCount(
    categoryKey,
    category,
    mediaType,
    10,
  );
  return { query: categoryKey, title: category.title, items, mediaType };
}

export async function getStaticProps() {
  try {
    const movieCategories = [
      "popular",
      "top_rated",
      "family",
      "action",
      "comedy",
    ];
    const tvCategories = [
      "top_rated",
      "family",
      "drama",
      "animation",
      "reality",
    ];

    const initialCategories = await Promise.all([
      ...movieCategories
        .slice(0, 3)
        .map((key) => getCategoryInitialData(key, "movie")),
      ...tvCategories
        .slice(0, 3)
        .map((key) => getCategoryInitialData(key, "tv")),
    ]);

    return {
      props: {
        initialCategories,
        categoryKeys: { movie: movieCategories, tv: tvCategories },
      },
      revalidate: 60 * 60,
    };
  } catch (error) {
    console.error("Error fetching initial home page categories:", error);
    return {
      props: { initialCategories: [], categoryKeys: { movie: [], tv: [] } },
      revalidate: 60,
    };
  }
}

export default HomePage;
