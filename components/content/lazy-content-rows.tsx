"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ContentRowSkeleton } from "@/components/content/content-row-skeleton";
import { SuspenseContentRow } from "@/components/content/suspense-content-row";

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
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // observer to progressively reveal more rows
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        setVisibleCount((count) => Math.min(count + batchSize, rows.length));
      },
      { root: null, rootMargin, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [batchSize, rootMargin, rows.length]);

  const visibleRows = useMemo(
    () => rows.slice(0, visibleCount),
    [rows, visibleCount],
  );

  return (
    <div>
      {visibleRows.map((row) => (
        <LazyRow key={row.rowId} row={row} />
      ))}

      {/* sentinel to reveal next batch */}
      {visibleCount < rows.length && (
        <div ref={sentinelRef} className="h-10" aria-hidden />
      )}
    </div>
  );
}

function LazyRow({ row }: { row: LazyRowConfig }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  // render the row only when it comes into (near) viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShouldRender(true);
        }
      },
      { root: null, rootMargin: "600px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id={row.rowId} className="my-4" ref={containerRef}>
      {shouldRender ? (
        <SuspenseContentRow
          rowId={row.rowId}
          title={row.title}
          href={row.href}
          variant={row.variant}
          enrich={row.enrich}
        />
      ) : (
        <ContentRowSkeleton title={row.title} href={row.href} count={10} />
      )}
    </section>
  );
}

export default LazyContentRows;
