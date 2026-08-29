"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  const clearResetTimer = useCallback(() => {
    if (!resetTimerRef.current) return;
    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = null;
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        clearResetTimer();
        setCopied(true);
        resetTimerRef.current = window.setTimeout(() => {
          resetTimerRef.current = null;
          setCopied(false);
        }, 2000);
        return true;
      } catch {
        return false;
      }
    },
    [clearResetTimer],
  );

  useEffect(() => clearResetTimer, [clearResetTimer]);

  return { copied, copy };
};
