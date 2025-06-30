"use client";

import { useAggressivePrefetch } from "@/hooks/useAggressivePrefetch";
import { MediaItem } from "@/utils/typings";
import { ReactNode } from "react";

interface AggressivePrefetchProviderProps {
  children: ReactNode;
  /** Items to prefetch aggressively */
  items?: MediaItem[];
  /** Enable hover prefetching */
  enableHover?: boolean;
  /** Enable intersection observer prefetching */
  enableIntersection?: boolean;
  /** Prefetch popular routes immediately */
  enableImmediate?: boolean;
  /** Root margin for intersection observer */
  rootMargin?: string;
}

export function AggressivePrefetchProvider({
  children,
  items,
  enableHover = true,
  enableIntersection = true,
  enableImmediate = true,
  rootMargin = "200px",
}: AggressivePrefetchProviderProps) {
  // Initialize aggressive prefetching
  useAggressivePrefetch({
    items,
    enableHover,
    enableIntersection,
    enableImmediate,
    rootMargin,
  });

  return <>{children}</>;
}
