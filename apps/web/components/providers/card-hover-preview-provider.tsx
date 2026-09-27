"use client";

import {
  cancelAllCardHoverPreviews,
  getActiveCardHoverPreviewId,
  subscribeCardHoverPreview,
} from "@/lib/card-hover-preview-coordinator";
import { YouTubeHoverPreviewLayer } from "@/components/cards/youtube-hover-preview-layer";
import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { initUserInteractionTracking } from "@/lib/media/autoplay-unlock";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type CardHoverPreviewContextValue = {
  activePreviewId: string | null;
  cancelAll: () => void;
};

const CardHoverPreviewContext =
  createContext<CardHoverPreviewContextValue | null>(null);

export function CardHoverPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const flags = useFeatureFlags();
  const showYoutubeFallback =
    flags.cardHoverPreviews && flags.youtubeHoverFallback;
  const [activePreviewId, setActivePreviewId] = useState<string | null>(() =>
    getActiveCardHoverPreviewId(),
  );

  useEffect(() => {
    initUserInteractionTracking();
    return subscribeCardHoverPreview(setActivePreviewId);
  }, []);

  return (
    <CardHoverPreviewContext.Provider
      value={{
        activePreviewId,
        cancelAll: cancelAllCardHoverPreviews,
      }}
    >
      {children}
      {showYoutubeFallback ? <YouTubeHoverPreviewLayer /> : null}
    </CardHoverPreviewContext.Provider>
  );
}

export const useCardHoverPreviewContext = (): CardHoverPreviewContextValue => {
  const ctx = useContext(CardHoverPreviewContext);
  if (!ctx) {
    return {
      activePreviewId: getActiveCardHoverPreviewId(),
      cancelAll: cancelAllCardHoverPreviews,
    };
  }
  return ctx;
};
