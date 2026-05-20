"use client";

import { SeriesGraph } from "@/components/tvshow/series-graph";
import { SeasonDetails } from "@/utils/typings";

type TvSeriesGraphTabProps = {
  allSeasonDetails: Record<number, SeasonDetails>;
};

export function TvSeriesGraphTab({ allSeasonDetails }: TvSeriesGraphTabProps) {
  return (
    <section
      data-episodes-section
      data-series-graph-section
      id="section-seasons"
      className="scroll-mt-24"
    >
      <SeriesGraph allSeasonDetails={allSeasonDetails} title="Series Graph" />
    </section>
  );
}
