import { CategoryRow } from "@components/CategoryRow";
import PageTransition from "@components/Transition";
import { CONTENT_CATEGORIES, fetchContentUntilCount } from "@utils/requests";
import { ContentCategory } from "@utils/typings";
import Head from "next/head";
import { useEffect, useRef, useState } from "react";

interface Props {
  initialCategories: ContentCategory[];
  categoryKeys: string[];
}

const TvShowsPage = ({ initialCategories, categoryKeys }: Props) => {
  const [loadedCategories, setLoadedCategories] =
    useState<ContentCategory[]>(initialCategories);
  const [isLoading, setIsLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const remainingKeysRef = useRef(categoryKeys.slice(5));

  const fetchNextCategories = async () => {
    const nextKeys = remainingKeysRef.current.slice(0, 5);
    if (nextKeys.length === 0) return;

    const categories = await Promise.all(
      nextKeys.map(async (categoryKey) => {
        const category = CONTENT_CATEGORIES.tv[categoryKey];
        const items = await fetchContentUntilCount(
          categoryKey,
          category,
          "tv",
          10,
        );
        return {
          query: categoryKey,
          title: category.title,
          items,
        };
      }),
    );

    remainingKeysRef.current = remainingKeysRef.current.slice(5);
    return categories;
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        if (
          entries[0].isIntersecting &&
          !isLoading &&
          remainingKeysRef.current.length > 0
        ) {
          setIsLoading(true);
          const newCategories = await fetchNextCategories();
          if (newCategories) {
            setLoadedCategories((prev) => [...prev, ...newCategories]);
          }
          setIsLoading(false);
        }
      },
      { rootMargin: "200px" },
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [isLoading]);

  return (
    <>
      <Head>
        <title>TV Shows | NyumatFlix</title>
        <meta
          name="description"
          content="View the latest TV shows on NyumatFlix."
        />
      </Head>
      <PageTransition>
        <div>
          {loadedCategories.map((category) => (
            <CategoryRow
              key={category.query}
              category={category}
              mediaType="tv"
            />
          ))}
          {remainingKeysRef.current.length > 0 && (
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

export async function getStaticProps() {
  try {
    const allCategories = [
      //   "popular",
      "top_rated",
      "airing_today",
      "action_adventure",
      "animation",
      "comedy",
      "crime",
      "documentary",
      "drama",
      "on_the_air",
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

    const initialCategories = await Promise.all(
      allCategories.slice(0, 5).map(async (categoryKey) => {
        const category = CONTENT_CATEGORIES.tv[categoryKey];
        const items = await fetchContentUntilCount(
          categoryKey,
          category,
          "tv",
          10,
        );
        return {
          query: categoryKey,
          title: category.title,
          items,
        };
      }),
    );

    return {
      props: {
        initialCategories,
        categoryKeys: allCategories,
      },
      revalidate: 60 * 60, // Revalidate every hour
    };
  } catch (error) {
    console.error("Error fetching TV shows:", error);
    return {
      props: {
        initialCategories: [],
        categoryKeys: [],
      },
      revalidate: 60,
    };
  }
}

export default TvShowsPage;
