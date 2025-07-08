"use client";

import { MediaItem } from "@/utils/typings";
import { ContentRow, ContentRowVariant } from "./content-row";

// cache for resolved data only
const resolvedDataCache = new Map<string, MediaItem[]>();

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
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch content row: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  return data;
}

/**
 * Suspense component that properly throws promises
 */
export function AsyncContentRow({
  rowId,
  title,
  href,
  minCount = 20,
  variant = "standard",
  enrich = false,
}: AsyncContentRowProps) {
  const cacheKey = `${rowId}-${minCount}-${enrich}`;
  if (resolvedDataCache.has(cacheKey)) {
    const items = resolvedDataCache.get(cacheKey)!;

    if (items.length === 0) {
      return null;
    }

    return (
      <section id={rowId} className="my-4">
        <ContentRow title={title} items={items} href={href} variant={variant} />
      </section>
    );
  }

  const promise = fetchData(rowId, minCount, enrich)
    .then((data) => {
      resolvedDataCache.set(cacheKey, data);
      return data;
    })
    .catch((error) => {
      // don't cache errors. allow retry
      throw error;
    });

  // This throw triggers Suspense fallback
  throw promise;
}
