import { ProviderTable } from "@/components/provider";
import { getCountryName } from "@/lib/utils";
import type { WatchLocale } from "@/tmdb/models";
import { tmdb } from "@/tmdb/api";
import { cookies } from "next/headers";
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

  const cookieStore = await cookies();
  const region = (cookieStore.get("region")?.value ??
    "US") as keyof WatchLocale;
  const country = getCountryName(region);

  return (
    <div className="space-y-6 rounded-md border bg-background p-6">
      <MediaProvidersHeading country={country} type={type} />

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
