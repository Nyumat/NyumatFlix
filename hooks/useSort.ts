import { useRouter, useSearchParams } from "next/navigation";
import { pages } from "@/config";
import {
  CalendarArrowDown,
  CalendarArrowUp,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserPlus,
} from "lucide-react";

export const useSort = (type: "movie" | "tv") => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dateField =
    type === "movie" ? "primary_release_date" : "first_air_date";

  const options = [
    { label: "Highest Popularity", value: "popularity.desc", icon: TrendingUp },
    { label: "Lowest Popularity", value: "popularity.asc", icon: TrendingDown },
    {
      label: "Most Recent",
      value: `${dateField}.desc`,
      icon: CalendarArrowUp,
    },
    {
      label: "Least Recent",
      value: `${dateField}.asc`,
      icon: CalendarArrowDown,
    },
    { label: "Highest Rating", value: "vote_average.desc", icon: ThumbsUp },
    { label: "Lowest Rating", value: "vote_average.asc", icon: ThumbsDown },
    { label: "Most Voted", value: "vote_count.desc", icon: UserPlus },
    { label: "Least Voted", value: "vote_count.asc", icon: UserMinus },
  ];

  const getSort = () => {
    return searchParams.get("sort_by") ?? "";
  };

  const setSort = (value: string) => {
    const search = new URLSearchParams(searchParams);
    const currentView = search.get("view")?.trim();
    const existingFrom = search.get("catalog_from")?.trim();
    const catalogFrom =
      existingFrom ||
      (currentView && currentView !== "discover" && currentView !== "upcoming"
        ? currentView
        : undefined);

    search.set("view", "discover");
    search.set("mode", "results");
    if (catalogFrom) {
      search.set("catalog_from", catalogFrom);
    } else {
      search.delete("catalog_from");
    }
    search.set("sort_by", value);
    search.delete("page");

    const catalogBase =
      type === "movie" ? pages.movie.catalog.link : pages.tv.catalog.link;

    router.replace(`${catalogBase}?${search.toString()}`);
  };

  return {
    options,
    getSort,
    setSort,
  };
};
