"use client";

import { ContentGrid } from "@/components/content/media-content-grid";
import { LoadMoreSpinner } from "@/components/ui/loading-spinner";
import type { MediaItem } from "@/utils/typings";
import React, { useMemo, useRef, useState, useTransition } from "react";
import { InView } from "react-intersection-observer";

type ListNodesResponse = readonly [
  React.JSX.Element,
  number | null,
  MediaItem[] | undefined,
];

type UnifiedGridProps = {
  unifiedGrid: true;
  gridType: "movie" | "tv" | "multi";
  gridItemsPerRow?: number;
  initialItems: MediaItem[];
  initialOffset?: number | null;
  className?: string;
  initialSeenIds?: number[];
  getListNodes: (
    offset: number,
    seenIds?: number[],
  ) => Promise<ListNodesResponse | null>;
  children?: never;
  renderContent?: never;
  itemsPerRow?: never;
};

type GenericInfiniteScrollProps<T extends { id?: number | string }> = {
  unifiedGrid?: false;
  gridType?: never;
  gridItemsPerRow?: never;
  initialItems?: T[];
  initialOffset?: number | null;
  itemsPerRow?: number;
  className?: string;
  initialSeenIds?: number[];
  getListNodes: (
    offset: number,
    seenIds?: number[],
  ) => Promise<
    readonly [React.JSX.Element, number | null, T[] | undefined] | null
  >;
  renderContent?: (items: T[], isLoading: boolean) => React.ReactNode;
  children?: React.ReactNode;
};

type InfiniteScrollProps<T extends { id?: number | string }> =
  | UnifiedGridProps
  | GenericInfiniteScrollProps<T>;

function isUnifiedGridProps<T extends { id?: number | string }>(
  props: InfiniteScrollProps<T>,
): props is UnifiedGridProps {
  return props.unifiedGrid === true;
}

export function InfiniteScroll<T extends { id?: number | string }>(
  props: InfiniteScrollProps<T>,
) {
  const {
    getListNodes,
    initialOffset = 1,
    className = "",
    initialSeenIds,
    gridType,
    gridItemsPerRow,
    renderContent,
    children,
  } = props;

  const isUnified = isUnifiedGridProps(props);
  const mediaItems = isUnified ? props.initialItems : undefined;
  const genericItems = !isUnified ? props.initialItems || [] : undefined;

  const resetKey = useMemo(
    () =>
      isUnified && mediaItems
        ? `${initialOffset}-${mediaItems.length}-${mediaItems[0]?.id ?? ""}`
        : undefined,
    [isUnified, initialOffset, mediaItems],
  );

  const previousResetKeyRef = useRef<string | undefined>(resetKey);
  const shouldReset =
    resetKey !== undefined && resetKey !== previousResetKeyRef.current;

  const [isPending, startTransition] = useTransition();
  const offsetRef = useRef<number | null>(initialOffset);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const seenIdsRef = useRef<Set<number>>(new Set(initialSeenIds || []));

  const [allItems, setAllItems] = useState<MediaItem[]>(() => {
    previousResetKeyRef.current = resetKey;
    return isUnified && mediaItems ? mediaItems : [];
  });

  if (shouldReset && mediaItems) {
    previousResetKeyRef.current = resetKey;
    offsetRef.current = initialOffset;
    setAllItems(mediaItems);
    setHasReachedEnd(false);
  }

  const updateListNodes = () => {
    const currentOffset = offsetRef.current;
    if (currentOffset === null || hasReachedEnd) {
      return;
    }
    startTransition(async () => {
      const seenIdsArray = Array.from(seenIdsRef.current);

      if (isUnified) {
        const response = await props.getListNodes(currentOffset, seenIdsArray);
        if (response) {
          const [_listNode, nextOffset, items] = response;
          offsetRef.current = nextOffset;

          if (items) {
            items.forEach((item) => {
              if (typeof item.id === "number") {
                seenIdsRef.current.add(item.id);
              }
            });
            setAllItems((prev) => [...prev, ...items]);
          }

          if (nextOffset === null) {
            setHasReachedEnd(true);
          }
        } else {
          setHasReachedEnd(true);
        }
      } else {
        const response = await getListNodes(currentOffset, seenIdsArray);
        if (response) {
          const [_listNode, nextOffset, items] = response;
          offsetRef.current = nextOffset;

          if (items) {
            items.forEach((item) => {
              if (item.id && typeof item.id === "number") {
                seenIdsRef.current.add(item.id);
              }
            });
          }

          if (nextOffset === null) {
            setHasReachedEnd(true);
          }
        } else {
          setHasReachedEnd(true);
        }
      }
    });
  };

  const content = useMemo(() => {
    if (isUnified && gridType) {
      return (
        <ContentGrid
          items={allItems}
          type={gridType}
          itemsPerRow={gridItemsPerRow}
        />
      );
    }

    if (renderContent && !isUnified && genericItems) {
      return (
        <>
          {renderContent(genericItems, isPending)}
          {children}
        </>
      );
    }

    return children;
  }, [
    isUnified,
    gridType,
    allItems,
    gridItemsPerRow,
    renderContent,
    genericItems,
    isPending,
    children,
  ]);

  return (
    <>
      <div className={className}>{content}</div>
      {!hasReachedEnd && (
        <InView as="div" onChange={(inView) => inView && updateListNodes()}>
          <div className="h-20" />
        </InView>
      )}
      {isPending && (
        <div className="relative mb-20">
          <LoadMoreSpinner />
        </div>
      )}
      {hasReachedEnd && !isPending && (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm">
            You've reached the end
          </p>
        </div>
      )}
    </>
  );
}
