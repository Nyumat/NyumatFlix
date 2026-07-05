"use client";

import { useEffect, type RefObject } from "react";

export function useClickOutside(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onClickOutside: () => void,
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        onClickOutside();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [containerRef, enabled, onClickOutside]);
}
