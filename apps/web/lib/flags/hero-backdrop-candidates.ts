import type { HeroBackdropOverrideSource } from "@/lib/flags/hero-backdrop-overrides";

export type HeroBackdropOption = {
  path: string;
  previewUrl: string;
  label: string;
  source: HeroBackdropOverrideSource;
  width: number | null;
  height: number | null;
};

export type HeroBackdropCandidate = {
  /** Stable UI id; not persisted. */
  id: string;
  mediaType: "movie" | "tv" | "anime";
  title: string;
  year: string | null;
  tmdbId: number | null;
  anilistId: number | null;
  malId: number | null;
  posterUrl: string | null;
  subtitle: string | null;
  backdrops: HeroBackdropOption[];
};

export type HeroBackdropSearchResponse = {
  query: string;
  results: HeroBackdropCandidate[];
};
