"use client";

import { LoadMoreSpinner } from "@/components/ui/loading-spinner";
import React, { useRef, useState, useTransition } from "react";
import { InView } from "react-intersection-observer";

interface InfiniteScrollProps<T> {
  children?: React.ReactNode;
  getListNodes: (
    offset: number,
  ) => Promise<readonly [React.JSX.Element, number | null] | null>;
  initialOffset?: number | null;
  itemsPerRow?: number;
  className?: string;
  renderContent?: (items: T[], isLoading: boolean) => React.ReactNode;
  initialItems?: T[];
}

export function InfiniteScroll<T>({
  children,
  getListNodes,
  initialOffset = 1,
  itemsPerRow = 4,
  className = "",
  renderContent,
  initialItems = [],
}: InfiniteScrollProps<T>) {
  const [isPending, startTransition] = useTransition();
  const offsetRef = useRef<number | null>(initialOffset);
  const [listNodes, setListNodes] = useState<React.JSX.Element[]>([]);

  const updateListNodes = () => {
    if (!offsetRef.current) {
      return;
    }
    startTransition(async () => {
      const response = await getListNodes(offsetRef.current as number);
      if (response) {
        const [listNode, nextOffset] = response;
        offsetRef.current = nextOffset;
        setListNodes((previousNodeList) => [...previousNodeList, listNode]);
      }
    });
  };

  const content = renderContent ? (
    <>
      {renderContent(initialItems, isPending)}
      {listNodes}
    </>
  ) : (
    <>
      {children}
      {listNodes}
    </>
  );

  return (
    <>
      <div className={className}>{content}</div>
      <InView as="div" onChange={(inView) => inView && updateListNodes()}>
        <div className="h-20" />
      </InView>
      {isPending && (
        <div className="relative mb-20">
          <LoadMoreSpinner />
        </div>
      )}
    </>
  );
}
