"use client";

import { useContentRow } from "@/hooks/useContentRow";
import { ContentRow, ContentRowVariant } from "./content-row";
import { ContentRowSkeleton } from "./content-row-skeleton";

interface AsyncContentRowProps {
  rowId: string;
  title: string;
  href: string;
  minCount?: number;
  variant?: ContentRowVariant;
  enrich?: boolean;
}

export function AsyncContentRow({
  rowId,
  title,
  href,
  minCount = 20,
  variant = "standard",
  enrich = false,
}: AsyncContentRowProps) {
  const { items, isLoading, error } = useContentRow({
    rowId,
    count: minCount,
    enrich,
  });

  if (items.length > 0) {
    return (
      <section id={rowId} className="my-4">
        <ContentRow title={title} items={items} href={href} variant={variant} />
      </section>
    );
  }

  if (isLoading) {
    return (
      <ContentRowSkeleton
        title={title}
        href={href}
        count={Math.min(minCount, 10)}
      />
    );
  }

  if (error) {
    return (
      <section id={rowId} className="my-4">
        <div className="mx-4 md:mx-8 mb-8">
          <div className="text-red-500 text-sm">
            Failed to load {title}: {error.message}
          </div>
        </div>
      </section>
    );
  }

  return null;
}
