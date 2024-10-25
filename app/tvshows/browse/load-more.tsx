"use client";

import { ContentLoader } from "@/components/animated/load-more";
import { UnifiedCategory } from "@/utils/typings";
import { useRef, useState, useTransition } from "react";
import { useInView } from "react-intersection-observer";

interface LoadMoreProps extends React.PropsWithChildren {
  type: UnifiedCategory;
  initialOffset: number;
  getListNodes: (
    offset: number,
    type: UnifiedCategory,
  ) => Promise<readonly [React.JSX.Element, number | null] | null>;
}

export function LoadMore({
  type,
  initialOffset,
  getListNodes,
  children,
}: LoadMoreProps) {
  const [isPending, startTransition] = useTransition();
  const offsetRef = useRef<number | null>(initialOffset);
  const [contentListNodes, setContentListNodes] = useState<React.JSX.Element[]>(
    [],
  );

  const { ref } = useInView({
    onChange: (inView) => {
      if (inView) {
        updateContentListNodes();
      }
    },
    threshold: 0.1,
    rootMargin: "200px",
  });

  const updateContentListNodes = () => {
    if (!offsetRef.current) {
      return;
    }

    startTransition(async () => {
      const response = await getListNodes(offsetRef.current as number, type);

      if (response) {
        const [listNode, nextOffset] = response;
        if (nextOffset !== null) {
          offsetRef.current = nextOffset;
          setContentListNodes((prev) => [...prev, listNode]);
        } else {
          offsetRef.current = null;
        }
      } else {
        offsetRef.current = null;
      }
    });
  };

  return (
    <>
      <div className="container mx-auto">
        {children}
        {contentListNodes}
      </div>
      <div ref={ref} className="h-20" />
      {isPending && (
        <div className="relative mb-20">
          <ContentLoader />
        </div>
      )}
    </>
  );
}
