"use client";

import type { PageBackdrop } from "@/components/hero/ambient-page-backdrop";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ContextValue = {
  activeIndex: number;
  backdrops: Array<PageBackdrop | null>;
  setActiveIndex: (index: number) => void;
  setBackdrops: (backdrops: Array<PageBackdrop | null>) => void;
};

const Context = createContext<ContextValue | null>(null);

export function IndexHeroTransitionProvider({
  initialBackdrops = [],
  children,
}: {
  initialBackdrops?: Array<PageBackdrop | null>;
  children: ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [backdrops, setBackdropsState] =
    useState<Array<PageBackdrop | null>>(initialBackdrops);
  const setBackdrops = useCallback((next: Array<PageBackdrop | null>) => {
    setBackdropsState((current) =>
      current.length === next.length &&
      current.every((item, i) => item?.imageUrl === next[i]?.imageUrl)
        ? current
        : next,
    );
  }, []);
  const value = useMemo(
    () => ({ activeIndex, backdrops, setActiveIndex, setBackdrops }),
    [activeIndex, backdrops, setBackdrops],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useIndexHeroTransition = () => useContext(Context);
