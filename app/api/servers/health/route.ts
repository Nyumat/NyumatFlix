import {
  checkVideoServerUrl,
  isAllowedVideoServerUrl,
  type VideoServerHealthResult,
} from "@/lib/server/video-server-health";
import { NextResponse } from "next/server";

type HealthRequestBody = {
  url?: unknown;
  urls?: unknown;
};

const MAX_BATCH_SIZE = 12;
const CACHE_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 500;
const healthCache = new Map<
  string,
  { result: VideoServerHealthResult; expiresAt: number }
>();

const setCached = (url: string, result: VideoServerHealthResult): void => {
  healthCache.delete(url);
  healthCache.set(url, { result, expiresAt: Date.now() + CACHE_TTL_MS });

  while (healthCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = healthCache.keys().next().value;
    if (!oldestKey) break;
    healthCache.delete(oldestKey);
  }
};

const checkCached = async (
  url: string,
  signal: AbortSignal,
): Promise<VideoServerHealthResult> => {
  const cached = healthCache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  if (cached) healthCache.delete(url);

  const result = await checkVideoServerUrl(url, signal);
  if (!signal.aborted) setCached(url, result);
  return result;
};

export async function POST(request: Request) {
  let body: HealthRequestBody;

  try {
    body = (await request.json()) as HealthRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (Array.isArray(body.urls)) {
    if (
      body.urls.length === 0 ||
      body.urls.length > MAX_BATCH_SIZE ||
      !body.urls.every(
        (url): url is string =>
          typeof url === "string" && isAllowedVideoServerUrl(url),
      )
    ) {
      return NextResponse.json(
        { error: "urls must contain 1-12 allowed video server URLs" },
        { status: 400 },
      );
    }

    const results = await Promise.all(
      body.urls.map((url) => checkCached(url, request.signal)),
    );
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  }

  if (typeof body.url !== "string" || !isAllowedVideoServerUrl(body.url)) {
    return NextResponse.json(
      { error: "URL is not an allowed video server URL" },
      { status: 400 },
    );
  }

  const result = await checkCached(body.url, request.signal);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}
