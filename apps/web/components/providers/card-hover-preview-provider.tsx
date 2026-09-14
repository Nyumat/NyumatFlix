"use client";

import {
  cancelAllCardHoverPreviews,
  getActiveCardHoverPreviewId,
  subscribeCardHoverPreview,
} from "@/lib/card-hover-preview-coordinator";
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
  const [activePreviewId, setActivePreviewId] = useState<string | null>(() =>
    getActiveCardHoverPreviewId(),
  );

  useEffect(() => {
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
