"use client";

import { useEffect, useRef, type RefObject } from "react";

export function useClickOutside(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onClickOutside: () => void,
) {
  const onClickOutsideRef = useRef(onClickOutside);
  onClickOutsideRef.current = onClickOutside;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        onClickOutsideRef.current();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [containerRef, enabled]);
}
