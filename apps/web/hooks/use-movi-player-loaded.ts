"use client";

import { useSyncExternalStore } from "react";

import {
  isMoviPlayerLoaded,
  subscribeMoviPlayerLoaded,
} from "@/lib/player/load-player";

/** Tracks whether the movi-player vendor script has finished loading. */
export function useMoviPlayerLoaded(): boolean {
  return useSyncExternalStore(
    subscribeMoviPlayerLoaded,
    isMoviPlayerLoaded,
    () => false,
  );
}
