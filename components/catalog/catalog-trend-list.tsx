import { TrendCarousel } from "@/components/trend/trend-client";
import type { MovieWithMediaType, TvShowWithMediaType } from "@/tmdb/models";

type CatalogTrendListProps =
  | {
      type: "movie";
      title: string;
      description?: string;
      link: string;
      items: MovieWithMediaType[];
    }
  | {
      type: "tv";
      title: string;
      description?: string;
      link: string;
      items: TvShowWithMediaType[];
    };

export const CatalogTrendList = (props: CatalogTrendListProps) => (
  <TrendCarousel {...props} />
);
