"use client";

import { MediaItem } from "@/utils/typings";
import { ContentRow, ContentRowVariant } from "./content-row";

// Simple cache for resolved data only
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
    "localhost:3001"; // Default for development

  return `${protocol}://${host}`;
}

/**
 * Simple data fetcher that returns a promise
 */
async function fetchData(
  rowId: string,
  minCount: number,
  enrich: boolean,
): Promise<MediaItem[]> {
  console.log(`[AsyncContentRow] Fetching data for ${rowId}...`);

  const params = new URLSearchParams({
    id: rowId,
    count: minCount.toString(),
    enrich: enrich.toString(),
  });

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/content-rows?${params}`;

  console.log(`[AsyncContentRow] Fetching from: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch content row: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  console.log(`[AsyncContentRow] Received ${data.length} items for ${rowId}`);

  return data;
}

/**
 * Simplified Suspense component that properly throws promises
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

  console.log(`[AsyncContentRow] Rendering ${rowId}, checking cache...`);

  // Check if we have resolved data
  if (resolvedDataCache.has(cacheKey)) {
    const items = resolvedDataCache.get(cacheKey)!;
    console.log(
      `[AsyncContentRow] Using cached data for ${rowId} (${items.length} items)`,
    );

    if (items.length === 0) {
      console.warn(`[AsyncContentRow] No items found for row ${rowId}`);
      return null;
    }

    return (
      <section id={rowId} className="my-4">
        <ContentRow title={title} items={items} href={href} variant={variant} />
      </section>
    );
  }

  // Create and throw a promise for Suspense to catch
  console.log(
    `[AsyncContentRow] No cached data for ${rowId}, creating promise...`,
  );

  const promise = fetchData(rowId, minCount, enrich)
    .then((data) => {
      console.log(
        `[AsyncContentRow] Promise resolved for ${rowId}, caching data...`,
      );
      resolvedDataCache.set(cacheKey, data);
      return data;
    })
    .catch((error) => {
      console.error(`[AsyncContentRow] Promise rejected for ${rowId}:`, error);
      // Don't cache errors, allow retry
      throw error;
    });

  console.log(`[AsyncContentRow] Throwing promise for ${rowId}...`);

  // This throw triggers Suspense fallback
  throw promise;
}
