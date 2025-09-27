"use client";

import { useRef, useState, useTransition } from "react";
import { useInView } from "react-intersection-observer";
import { LoadingSpinnerFullHeight } from "@/components/ui/loading-spinner";

interface LoadMoreProps extends React.PropsWithChildren {
  getMovieListNodes(
    offset: number,
  ): Promise<readonly [React.JSX.Element, number | null] | null>;
  initialOffset: number;
}

export function LoadMore({
  children,
  getMovieListNodes,
  initialOffset,
}: LoadMoreProps) {
  const [isPending, startTransition] = useTransition();
  const offsetRef = useRef<number | null>(initialOffset);
  const [movieListNodes, setMovieListNodes] = useState<React.JSX.Element[]>([]);

  const { ref } = useInView({
    onChange: (inView) => {
      if (inView) {
        updateMovieListNodes();
      }
    },
    threshold: 0.1,
    rootMargin: "200px",
  });

  const updateMovieListNodes = () => {
    if (!offsetRef.current) {
      return;
    }

    startTransition(async () => {
      const response = await getMovieListNodes(offsetRef.current as number);

      if (response) {
        const [listNode, nextOffset] = response;
        offsetRef.current = nextOffset;
        setMovieListNodes((prev) => [...prev, listNode]);
      }
    });
  };

  return (
    <>
      <div className="container mx-auto">
        {children}
        {movieListNodes}
      </div>
      <div ref={ref} className="h-20" />
      {isPending && (
        <div className="relative mb-20">
          <LoadingSpinnerFullHeight />
        </div>
      )}
    </>
  );
}
