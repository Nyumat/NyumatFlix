"use client";

import { useEffect, useState } from "react";
import { MediaItem } from "@/utils/typings";
import { ContentRow, ContentRowVariant } from "./content-row";
import { ContentRowSkeleton } from "./content-row-skeleton";

// Remove the problematic client-side cache that causes hydration mismatches
// const resolvedDataCache = new Map<string, MediaItem[]>();

interface AsyncContentRowProps {
  rowId: string;
  title: string;
  href: string;
  minCount?: number;
  variant?: ContentRowVariant;
  enrich?: boolean;
}

/**
 * Get the base URL for API calls
 */
function getBaseUrl() {
  // In browser, use relative URLs
  if (typeof window !== "undefined") {
    return "";
  }

  // In SSR, construct absolute URL
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

  // Try different host sources in order of preference
  const host =
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ||
    "localhost:3000";

  return `${protocol}://${host}`;
}

/**
 * Data fetcher that returns a promise
 */
async function fetchData(
  rowId: string,
  minCount: number,
  enrich: boolean,
): Promise<MediaItem[]> {
  const params = new URLSearchParams({
    id: rowId,
    count: minCount.toString(),
    enrich: enrich.toString(),
  });

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/content-rows?${params}`;
  const response = await fetch(url, {
    // Add cache control to ensure consistent data
    cache: "force-cache",
    next: { revalidate: 300 }, // 5 minutes
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch content row: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  return data;
}

/**
 * Fixed AsyncContentRow that uses useState instead of throwing promises
 * This prevents hydration mismatches by using standard React patterns
 * Now uses proper glassmorphism skeleton with consistent heights
 */
export function AsyncContentRow({
  rowId,
  title,
  href,
  minCount = 20,
  variant = "standard",
  enrich = false,
}: AsyncContentRowProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await fetchData(rowId, minCount, enrich);

        if (mounted) {
          setItems(data);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load content",
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [rowId, minCount, enrich]);

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
            Failed to load {title}: {error}
          </div>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section id={rowId} className="my-4">
      <ContentRow title={title} items={items} href={href} variant={variant} />
    </section>
  );
}
