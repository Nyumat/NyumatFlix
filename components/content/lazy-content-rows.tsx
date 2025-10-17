"use client";

import { SuspenseContentRow } from "@/components/content/suspense-content-row";
import { LoadingSpinnerFullHeight } from "@/components/ui/loading-spinner";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useInView } from "react-intersection-observer";

export interface LazyRowConfig {
  rowId: string;
  title: string;
  href: string;
  variant?: "standard" | "ranked";
  enrich?: boolean;
}

interface LazyContentRowsProps {
  rows: LazyRowConfig[];
  /** how many rows to render initially */
  initialCount?: number;
  /** how many rows to reveal per intersection */
  batchSize?: number;
  /** pre-load rows when user is within this margin */
  rootMargin?: string;
}

export function LazyContentRows({
  rows,
  initialCount = 1,
  batchSize = 1,
  rootMargin = "400px",
}: LazyContentRowsProps) {
  const [visibleCount, setVisibleCount] = useState<number>(
    Math.min(initialCount, rows.length),
  );
  const [isPending, startTransition] = useTransition();

  const { ref: sentinelRef, inView } = useInView({
    threshold: 0.1,
    rootMargin,
    triggerOnce: false,
  });

  const loadMoreRows = useCallback(() => {
    if (visibleCount < rows.length && !isPending) {
      startTransition(() => {
        setVisibleCount((count) => Math.min(count + batchSize, rows.length));
      });
    }
  }, [visibleCount, rows.length, isPending, batchSize, startTransition]);

  useEffect(() => {
    if (inView) {
      loadMoreRows();
    }
  }, [inView, loadMoreRows]);

  const visibleRows = useMemo(
    () => rows.slice(0, visibleCount),
    [rows, visibleCount],
  );

  const hasMore = visibleCount < rows.length;

  return (
    <div>
      {visibleRows.map((row) => (
        <LazyRow key={row.rowId} row={row} />
      ))}

      {hasMore && <div ref={sentinelRef} className="h-20" aria-hidden />}

      {isPending && (
        <div className="relative mb-20">
          <LoadingSpinnerFullHeight />
        </div>
      )}

      {!hasMore && rows.length > initialCount && (
        <div className="text-center py-8 text-muted-foreground">
          <p>You've reached the end</p>
        </div>
      )}
    </div>
  );
}

function LazyRow({ row }: { row: LazyRowConfig }) {
  return (
    <section id={row.rowId} className="my-4">
      <SuspenseContentRow
        rowId={row.rowId}
        title={row.title}
        href={row.href}
        variant={row.variant}
        enrich={row.enrich}
      />
    </section>
  );
}

export default LazyContentRows;
