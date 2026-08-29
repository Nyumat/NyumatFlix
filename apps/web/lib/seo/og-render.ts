import "server-only";

import type { ReactElement } from "react";
import { createOgImageResponse } from "./og-image";

export const OG_IMAGE_REVALIDATE_SECONDS = 86400;

const MAX_CONCURRENT_OG_RENDERS = 3;
const MAX_QUEUED_OG_RENDERS = 50;
const MAX_PNG_CACHE_ENTRIES = 250;
const MAX_PNG_CACHE_BYTES = 48 * 1024 * 1024;

type PngCacheEntry = {
  pngBase64: string;
  expiresAt: number;
};

let activeOgRenders = 0;
const ogRenderWaitQueue: Array<() => void> = [];
const pngCache = new Map<string, PngCacheEntry>();
let pngCacheBytes = 0;

const acquireOgRenderSlot = async (): Promise<void> => {
  if (activeOgRenders < MAX_CONCURRENT_OG_RENDERS) {
    activeOgRenders += 1;
    return;
  }

  if (ogRenderWaitQueue.length >= MAX_QUEUED_OG_RENDERS) {
    throw new Error("OG render queue is full");
  }

  await new Promise<void>((resolve) => {
    ogRenderWaitQueue.push(() => {
      activeOgRenders += 1;
      resolve();
    });
  });
};

const releaseOgRenderSlot = (): void => {
  activeOgRenders -= 1;
  const next = ogRenderWaitQueue.shift();
  if (next) next();
};

const ogImageResponseHeaders = (): HeadersInit => ({
  "Content-Type": "image/png",
  "Cache-Control": `public, immutable, no-transform, max-age=${OG_IMAGE_REVALIDATE_SECONDS}, s-maxage=${OG_IMAGE_REVALIDATE_SECONDS}, stale-while-revalidate=604800`,
});

const pngBase64ToResponse = (pngBase64: string): Response =>
  new Response(Buffer.from(pngBase64, "base64"), {
    status: 200,
    headers: ogImageResponseHeaders(),
  });

const setPngCache = (cacheKey: string, pngBase64: string) => {
  const previous = pngCache.get(cacheKey);
  if (previous) pngCacheBytes -= Buffer.byteLength(previous.pngBase64);

  pngCache.set(cacheKey, {
    pngBase64,
    expiresAt: Date.now() + OG_IMAGE_REVALIDATE_SECONDS * 1000,
  });
  pngCacheBytes += Buffer.byteLength(pngBase64);

  while (
    pngCache.size > MAX_PNG_CACHE_ENTRIES ||
    pngCacheBytes > MAX_PNG_CACHE_BYTES
  ) {
    const oldestKey = pngCache.keys().next().value;
    if (!oldestKey) break;
    const oldest = pngCache.get(oldestKey);
    if (oldest) pngCacheBytes -= Buffer.byteLength(oldest.pngBase64);
    pngCache.delete(oldestKey);
  }
};

const renderOgImageToPngBase64 = async (
  renderElement: () => Promise<ReactElement>,
): Promise<string> => {
  await acquireOgRenderSlot();
  try {
    const element = await renderElement();
    const response = await createOgImageResponse(element);
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString("base64");
  } finally {
    releaseOgRenderSlot();
  }
};

export async function renderCachedOgImage(
  cacheKey: string,
  renderElement: () => Promise<ReactElement>,
): Promise<Response> {
  const cached = pngCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return pngBase64ToResponse(cached.pngBase64);
  }

  const pngBase64 = await renderOgImageToPngBase64(renderElement);
  setPngCache(cacheKey, pngBase64);
  return pngBase64ToResponse(pngBase64);
}
