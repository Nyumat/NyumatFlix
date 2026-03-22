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
      <h2 className="mb-3 text-xl font-semibold text-foreground sm:mb-4 sm:text-2xl">
        Series graph
      </h2>
      <div className="rounded-xl border border-white/10 bg-black/10 p-3 shadow-xl backdrop-blur-md sm:p-4">
        <SeriesGraph allSeasonDetails={allSeasonDetails} />
      </div>
    </section>
  );
}
