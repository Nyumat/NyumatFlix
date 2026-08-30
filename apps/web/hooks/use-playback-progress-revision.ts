"use client";

import {
  getPlaybackProgressRevision,
  subscribePlaybackProgressChanged,
} from "@/lib/playback/progress-change-events";
import { useSyncExternalStore } from "react";

export const usePlaybackProgressRevision = (): number =>
  useSyncExternalStore(
    subscribePlaybackProgressChanged,
    getPlaybackProgressRevision,
    () => 0,
  );
