import type { LiveChannelsResponse } from "@/lib/live/types";

const PREVIEW_FETCH_TIMEOUT_MS = 30_000;

const livePreviewOrigin = () => {
  const origin = process.env.LIVE_PREVIEW_ORIGIN?.trim();

  if (!origin) {
    return undefined;
  }

  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
};

export const shouldUseLivePreviewUpstream = () => Boolean(livePreviewOrigin());

const previewChannelsUrl = () => `${livePreviewOrigin()}/api/live/channels`;

export const previewPlayUrl = (token: string, asset: string) =>
  `${livePreviewOrigin()}/api/live/play/${token}/${asset}`;

const fetchWithTimeout = async (
  url: string,
  init: RequestInit = {},
  timeoutMs = PREVIEW_FETCH_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchLiveGuideFromPreview =
  async (): Promise<LiveChannelsResponse> => {
    const response = await fetchWithTimeout(previewChannelsUrl(), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`preview live guide returned ${response.status}`);
    }

    return response.json() as Promise<LiveChannelsResponse>;
  };

export const fetchLivePlayFromPreview = async (
  token: string,
  asset: string,
  rangeHeader: string | null,
) => {
  const headers: Record<string, string> = {};

  if (rangeHeader) {
    headers.Range = rangeHeader;
  }

  return fetchWithTimeout(previewPlayUrl(token, asset), { headers });
};

export const proxyLivePlayResponse = (response: Response) => {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");

  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
  ]) {
    const value = response.headers.get(name);

    if (value) {
      headers.set(name, value);
    }
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  });
};
