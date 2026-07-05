import "server-only";

import { scrapeProxyUrl } from "./proxy";
import { scrapeUpstreamHeaders } from "./upstream-headers";

const FETCH_TIMEOUT_MS = 30_000;

export { DEFAULT_USER_AGENT, scrapeUpstreamHeaders } from "./upstream-headers";

export async function scrapeFetch(
  url: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const referer = init.headers?.Referer;
  const upstreamHeaders = scrapeUpstreamHeaders(url, referer);

  const requestInit = {
    ...init,
    signal: controller.signal,
    headers: {
      ...upstreamHeaders,
      ...init.headers,
    },
    redirect: "follow" as const,
    cache: "no-store" as const,
  };

  const proxyUrl = scrapeProxyUrl();

  try {
    if (proxyUrl) {
      const { fetch: undiciFetch, ProxyAgent } = await import("undici");
      const dispatcher = new ProxyAgent(proxyUrl);
      return (await undiciFetch(url, {
        method: init.method ?? "GET",
        headers: requestInit.headers,
        body: init.body as import("undici").BodyInit | undefined,
        signal: controller.signal,
        redirect: "follow",
        dispatcher,
      })) as unknown as Response;
    }

    return await fetch(url, requestInit);
  } finally {
    clearTimeout(timeout);
  }
}

export async function scrapeFetchText(
  url: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; text: string }> {
  const response = await scrapeFetch(url, { headers });
  return {
    status: response.status,
    text: await response.text(),
  };
}
