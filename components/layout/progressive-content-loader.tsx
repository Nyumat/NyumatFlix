"use client";

import { SuspenseContentRow } from "@/components/content/suspense-content-row";
import { LoadMoreSpinner } from "@/components/ui/loading-spinner";
import { MediaItem } from "@/utils/typings";
import React, { useRef, useState, useTransition } from "react";
import { InView } from "react-intersection-observer";

interface ContentRowConfig {
  rowId: string;
  title: string;
  href: string;
  variant?: "ranked";
  enrich?: boolean;
  items?: MediaItem[];
}

interface ProgressiveContentLoaderProps {
  initialRows: ContentRowConfig[];
  remainingRowsConfig: ContentRowConfig[];
  getNextRows: (
    remainingRows: ContentRowConfig[],
    batchSize?: number,
  ) => Promise<ContentRowConfig[]>;
  children?: React.ReactNode;
}

export const ProgressiveContentLoader = ({
  initialRows,
  remainingRowsConfig,
  getNextRows,
  children,
}: ProgressiveContentLoaderProps) => {
  const [isPending, startTransition] = useTransition();
  const [contentRows, setContentRows] =
    useState<ContentRowConfig[]>(initialRows);
  const [hasMore, setHasMore] = useState(true);
  const [remainingRows, setRemainingRows] = useState(remainingRowsConfig);
  const processedRowIds = useRef(new Set(initialRows.map((row) => row.rowId)));

  const loadMoreRows = () => {
    if (!hasMore || remainingRows.length === 0) return;

    startTransition(async () => {
      try {
        const nextRows = await getNextRows(remainingRows, 3);

        if (nextRows.length === 0) {
          setHasMore(false);
          return;
        }

        const newRows = nextRows.filter(
          (row) => !processedRowIds.current.has(row.rowId),
        );
        if (newRows.length > 0) {
          newRows.forEach((row) => processedRowIds.current.add(row.rowId));
          setContentRows((prev) => [...prev, ...newRows]);
          setRemainingRows((prev) => prev.slice(newRows.length));
        } else {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Error loading more rows:", error);
        setHasMore(false);
      }
    });
  };

  return (
    <>
      {children}
      <div className="space-y-8">
        {contentRows.map((rowData, index) => (
          <div key={rowData.rowId}>
            <SuspenseContentRow
              rowId={rowData.rowId}
              title={rowData.title}
              href={rowData.href}
              variant={rowData.variant}
              enrich={rowData.enrich}
              preloadedItems={rowData.items}
            />
            {index === contentRows.length - 1 &&
              hasMore &&
              remainingRows.length > 0 && (
                <InView
                  as="div"
                  onChange={(inView) => inView && loadMoreRows()}
                  className="h-32"
                  rootMargin="100px"
                />
              )}
          </div>
        ))}
      </div>
      {isPending && (
        <div className="relative mb-20">
          <LoadMoreSpinner />
        </div>
      )}
    </>
  );
};
