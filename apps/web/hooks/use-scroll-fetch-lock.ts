"use client";

import { useCallback, useEffect, useRef } from "react";

type ScrollFetchLock = {
  beginFetch: () => number | null;
  endFetch: (generation: number) => void;
  isCurrent: (generation: number) => boolean;
};

export const useScrollFetchLock = (): ScrollFetchLock => {
  const isFetchingRef = useRef(false);
  const generationRef = useRef(0);

  const beginFetch = useCallback((): number | null => {
    if (isFetchingRef.current) {
      return null;
    }

    isFetchingRef.current = true;
    generationRef.current += 1;
    return generationRef.current;
  }, []);

  const endFetch = useCallback((generation: number) => {
    if (generation !== generationRef.current) {
      return;
    }

    isFetchingRef.current = false;
  }, []);

  const isCurrent = useCallback(
    (generation: number) => generation === generationRef.current,
    [],
  );

  useEffect(
    () => () => {
      generationRef.current += 1;
      isFetchingRef.current = false;
    },
    [],
  );

  return { beginFetch, endFetch, isCurrent };
};
