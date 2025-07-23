import { ErrorBoundary } from "@/components/ui/error-boundary";
import { MediaItem } from "@/utils/typings";
import { Suspense } from "react";
import { AsyncContentRow } from "./async-content-row";
import { ContentRow, ContentRowVariant } from "./content-row";
import { ContentRowSkeleton } from "./content-row-skeleton";

export interface SuspenseContentRowProps {
  rowId: string;
  title: string;
  href: string;
  minCount?: number;
  variant?: ContentRowVariant;
  enrich?: boolean;
  hide?: boolean;
  preloadedItems?: MediaItem[];
}

/**
 * Complete Suspense wrapper with Error Boundary for async content rows
 * Follows React 18.2+ best practices for Suspense + Error handling
 * Pattern: ErrorBoundary > Suspense > AsyncComponent
 * If preloadedItems are provided, renders directly without async loading
 */
export function SuspenseContentRow({
  rowId,
  title,
  href,
  minCount = 20,
  variant = "standard",
  enrich = false,
  hide = false,
  preloadedItems,
}: SuspenseContentRowProps) {
  if (hide) {
    return null;
  }

  // If we have preloaded items, render directly without suspense
  if (preloadedItems) {
    // Don't render if no items
    if (preloadedItems.length === 0) {
      return null;
    }

    return (
      <ErrorBoundary
        fallback={
          <section id={rowId} className="my-4">
            <div className="mx-4 md:mx-8 mb-8">
              <div className="text-red-500 text-sm">
                Failed to load {title}. Please try refreshing the page.
              </div>
            </div>
          </section>
        }
      >
        <section id={rowId} className="my-4">
          <ContentRow
            title={title}
            items={preloadedItems}
            href={href}
            variant={variant}
          />
        </section>
      </ErrorBoundary>
    );
  }

  // Original async loading behavior
  return (
    <ErrorBoundary
      fallback={
        <section id={rowId} className="my-4">
          <div className="mx-4 md:mx-8 mb-8">
            <div className="text-red-500 text-sm">
              Failed to load {title}. Please try refreshing the page.
            </div>
          </div>
        </section>
      }
    >
      <Suspense
        fallback={
          <ContentRowSkeleton
            title={title}
            href={href}
            count={Math.min(minCount, 10)}
          />
        }
      >
        <AsyncContentRow
          rowId={rowId}
          title={title}
          href={href}
          minCount={minCount}
          variant={variant}
          enrich={enrich}
        />
      </Suspense>
    </ErrorBoundary>
  );
}
