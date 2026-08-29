"use client";

import { useSyncExternalStore } from "react";

import {
  isMoviPlayerLoaded,
  subscribeMoviPlayerLoaded,
} from "@/lib/movi/load-movi-player";

/** Tracks whether the movi-player vendor script has finished loading. */
export function useMoviPlayerLoaded(): boolean {
  return useSyncExternalStore(
    subscribeMoviPlayerLoaded,
    isMoviPlayerLoaded,
    () => false,
  );
}
