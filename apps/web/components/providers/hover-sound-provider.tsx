"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";

const HOVER_SOUND_SRC = "/sounds/movie-hover.mp3";
const MIN_PLAY_INTERVAL_MS = 100;

type PlayHoverSound = () => void;

const HoverSoundContext = createContext<PlayHoverSound | null>(null);

function isCardHoverSoundEnabled(): boolean {
  return !useAppSettingsStore.getState().disableHoverSound;
}

function pauseHoverSound(audio: HTMLAudioElement | null) {
  if (!audio) {
    return;
  }
  audio.pause();
  audio.currentTime = 0;
}

export function HoverSoundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const disableHoverSound = useAppSettingsStore(
    (state) => state.disableHoverSound,
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastPlayedAtRef = useRef(0);

  useEffect(() => {
    if (disableHoverSound) {
      pauseHoverSound(audioRef.current);
    }
  }, [disableHoverSound]);

  const play = useCallback(() => {
    if (!isCardHoverSoundEnabled()) {
      return;
    }

    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastPlayedAtRef.current < MIN_PLAY_INTERVAL_MS) {
      return;
    }
    lastPlayedAtRef.current = now;

    if (!audioRef.current) {
      audioRef.current = new Audio(HOVER_SOUND_SRC);
      audioRef.current.volume = 0.4;
    }

    const audio = audioRef.current;
    audio.currentTime = 0;
    void Promise.resolve(audio.play()).catch(() => {
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
  const play = useContext(HoverSoundContext);
  const disableHoverSound = useAppSettingsStore(
    (state) => state.disableHoverSound,
  );

  if (!play || disableHoverSound) {
    return null;
  }

  return play;
}
