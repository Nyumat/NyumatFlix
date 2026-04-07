"use client";

import { SeasonDetails } from "@/utils/typings";
import dynamic from "next/dynamic";

const TvSeriesGraphTab = dynamic(
  () => import("./tv-series-graph-tab").then((mod) => mod.TvSeriesGraphTab),
  { ssr: false },
);

type TvShowSeasonsPageProps = {
  allSeasonDetails: Record<number, SeasonDetails>;
};

export const TvShowSeasonsPage = ({
  allSeasonDetails,
}: TvShowSeasonsPageProps) => {
  return <TvSeriesGraphTab allSeasonDetails={allSeasonDetails} />;
};
