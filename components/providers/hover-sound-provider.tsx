"use client";

import { createContext, useCallback, useContext, useRef } from "react";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";

const HOVER_SOUND_SRC = "/sounds/movie-hover.mp3";

type PlayHoverSound = () => void;

const HoverSoundContext = createContext<PlayHoverSound | null>(null);

export function HoverSoundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(() => {
    if (useAppSettingsStore.getState().disableHoverSound) {
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(HOVER_SOUND_SRC);
      audioRef.current.volume = 0.4;
    }

    const audio = audioRef.current;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Rejects if the browser blocks autoplay before any user gesture; safe to ignore.
    });
  }, []);

  return (
    <HoverSoundContext.Provider value={play}>
      {children}
    </HoverSoundContext.Provider>
  );
}

export function useHoverSound(): PlayHoverSound | null {
  return useContext(HoverSoundContext);
}
