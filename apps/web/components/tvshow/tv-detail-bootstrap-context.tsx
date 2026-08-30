"use client";

import type { TvShowDetails } from "@/lib/domain/typings";
import type { TvDetailCatalog } from "@/lib/tv-detail-catalog";
import { createContext, useContext, type ReactNode } from "react";

type TvDetailBootstrapValue = {
  tvId: string;
  catalog: TvDetailCatalog;
  details: TvShowDetails;
};

const TvDetailBootstrapContext = createContext<TvDetailBootstrapValue | null>(
  null,
);

type TvDetailBootstrapProviderProps = TvDetailBootstrapValue & {
  children: ReactNode;
};

export const TvDetailBootstrapProvider = ({
  tvId,
  catalog,
  details,
  children,
}: TvDetailBootstrapProviderProps) => (
  <TvDetailBootstrapContext.Provider value={{ tvId, catalog, details }}>
    {children}
  </TvDetailBootstrapContext.Provider>
);

export const useTvDetailBootstrap = (): TvDetailBootstrapValue => {
  const value = useContext(TvDetailBootstrapContext);
  if (!value) {
    throw new Error(
      "useTvDetailBootstrap must be used within TvDetailBootstrapProvider",
    );
  }
  return value;
};

export const TvEpisodesPanelSkeleton = () => (
  <div className="flex h-[min(680px,72vh)] w-full flex-col gap-5">
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-12 w-full rounded-lg border border-border/80 bg-card/50 sm:w-56" />
        <div className="h-12 min-w-0 flex-1 rounded-lg border border-border/80 bg-card/50" />
        <div className="h-12 w-12 shrink-0 rounded-lg border border-border/80 bg-card/50" />
      </div>
    </div>
    <div className="min-h-0 flex-1 pr-1">
      <div className="space-y-3 pb-1 pt-0.5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-xl border border-border/70 bg-card/25"
          />
        ))}
      </div>
    </div>
  </div>
);
