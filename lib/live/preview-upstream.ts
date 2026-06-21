import type { LiveChannelsResponse } from "@/lib/live/types";

const LIVE_PREVIEW_ORIGIN = "http://nyumatflix-preview.railway.internal:8080";
const PREVIEW_FETCH_TIMEOUT_MS = 30_000;

export const shouldUseLivePreviewUpstream = () =>
  process.env.RAILWAY_PRIVATE_DOMAIN === "nyumatflix.railway.internal";

const previewChannelsUrl = () => `${LIVE_PREVIEW_ORIGIN}/api/live/channels`;

export const previewPlayUrl = (token: string, asset: string) =>
  `${LIVE_PREVIEW_ORIGIN}/api/live/play/${token}/${asset}`;

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
