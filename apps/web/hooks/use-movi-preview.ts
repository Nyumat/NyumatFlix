"use client";

import { useCallback, useEffect, useState } from "react";

export type PlayerEngine = "vidstack" | "movi";

export const PLAYER_ENGINE_STORAGE_KEY = "nyumat:playerEngine";
export const PLAYER_ENGINE_CHANGE_EVENT = "nyumat:player-engine-change";
export const DEFAULT_PLAYER_ENGINE: PlayerEngine = "vidstack";

export const readStoredPlayerEngine = (): PlayerEngine | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = localStorage.getItem(PLAYER_ENGINE_STORAGE_KEY);
    if (stored === "movi" || stored === "vidstack") {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
};

export const resolvePlayerEngine = (): PlayerEngine => {
  return readStoredPlayerEngine() ?? DEFAULT_PLAYER_ENGINE;
};

export const writePlayerEnginePreference = (engine: PlayerEngine): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(PLAYER_ENGINE_STORAGE_KEY, engine);
    window.dispatchEvent(new CustomEvent(PLAYER_ENGINE_CHANGE_EVENT));
  } catch {
    // storage may be unavailable in private browsing
  }
};

export const usePlayerEngine = () => {
  const [engine, setEngine] = useState<PlayerEngine>(() =>
    typeof window !== "undefined"
      ? resolvePlayerEngine()
      : DEFAULT_PLAYER_ENGINE,
  );

  useEffect(() => {
    const sync = () => {
      setEngine(resolvePlayerEngine());
    };

    window.addEventListener(PLAYER_ENGINE_CHANGE_EVENT, sync);
    const onStorage = (event: StorageEvent) => {
      if (event.key === PLAYER_ENGINE_STORAGE_KEY) {
        sync();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(PLAYER_ENGINE_CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setPlayerEngine = useCallback((next: PlayerEngine) => {
    writePlayerEnginePreference(next);
    setEngine(next);
  }, []);

  return {
    engine,
    isMovi: engine === "movi",
    setPlayerEngine,
  };
};

export const useMoviPreview = (): boolean => {
  const { isMovi } = usePlayerEngine();
  return isMovi;
};
