import { ProviderTable } from "@/components/provider";
import { TMDB_WATCH_REGION } from "@/lib/constants";
import type { WatchLocale } from "@/tmdb/models";
import { tmdb } from "@/tmdb/api";
import React from "react";
import { MediaProvidersHeading } from "./media-shared";

interface MediaWatchProvidersProps {
  id: string;
  type: "movie" | "tv";
  season?: number;
}

export const MediaWatchProviders: React.FC<MediaWatchProvidersProps> = async ({
  id,
  type,
  season,
}) => {
  const { results } = await tmdb[type].providers({ id, season });

  const region = TMDB_WATCH_REGION as keyof WatchLocale;

  return (
    <div className="space-y-6 rounded-md border bg-background p-6">
      <MediaProvidersHeading type={type} />

      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <ProviderTable
            title="Stream"
            providers={results?.[region]?.flatrate}
          />
          <ProviderTable title="Buy" providers={results?.[region]?.buy} />
          <ProviderTable title="Rent" providers={results?.[region]?.rent} />
        </div>
      </div>
    </div>
  );
};
