"use client";

import { LoadMoreSpinner } from "@/components/ui/loading-spinner";
import React, { useRef, useState, useTransition } from "react";
import { InView } from "react-intersection-observer";

interface LoadMoreProps extends React.PropsWithChildren {
  getListNodes: (
    offset: number,
  ) => Promise<readonly [React.JSX.Element, number | null] | null>;
  initialOffset: number | null;
}

export function LoadMore({
  children,
  getListNodes,
  initialOffset,
}: LoadMoreProps) {
  const [isPending, startTransition] = useTransition();
  const offsetRef = useRef<number | null>(initialOffset);
  const [listNodes, setListNodes] = useState<React.JSX.Element[]>([]);

  // invoke server action when our target node is in view
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

  return (
    <>
      <div className="container mx-auto">
        {children}
        {listNodes}
      </div>
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
