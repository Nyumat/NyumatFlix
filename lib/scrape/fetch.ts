import "server-only";

import {
  scrapeDirectDispatcher,
  scrapeProxyDispatcher,
  scrapeProxyUrl,
} from "./proxy";
import { scrapeUpstreamHeaders } from "./upstream-headers";

const FETCH_TIMEOUT_MS = 30_000;
const CURL_FALLBACK_HOSTS =
  /(?:^kwik\.[a-z]+$|^api\.wingsdatabase\.com$|(?:^|\.)(?:uwucdn\.top|owocdn\.top|shadowlemon\.site|opstream11\.com|peregrinepalaver\.space|meadowlaneeducation\.cfd|tiktokcdn\.com)$)/i;

type ScrapeFetchInit = RequestInit & {
  headers?: Record<string, string>;
  curlFallback?: boolean;
};

const scrapeCurlFallback = async (
  url: string,
  headers: Record<string, string>,
  proxyUrl?: string,
): Promise<Response | null> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== "https:" ||
    !CURL_FALLBACK_HOSTS.test(parsed.hostname)
  ) {
    return null;
  }

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execute = promisify(execFile);
    const args = [
      "--fail-with-body",
      "--location",
      "--silent",
      "--show-error",
      "--max-time",
      "30",
    ];

    if (proxyUrl) {
      args.push("--proxy", proxyUrl);
    }

    for (const [name, value] of Object.entries(headers)) {
      args.push("--header", `${name}: ${value}`);
    }
    args.push(url);

    const { stdout } = await execute("curl", args, {
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 35_000,
    });

    return new Response(stdout, { status: 200 });
  } catch {
    return null;
  }
};

export { DEFAULT_USER_AGENT, scrapeUpstreamHeaders } from "./upstream-headers";

export async function cancelResponseBody(response: Response): Promise<void> {
  if (response.bodyUsed) return;

  try {
    await response.body?.cancel();
  } catch {
    void 0;
  }
}

export async function scrapeFetch(
  url: string,
  init: ScrapeFetchInit = {},
): Promise<Response> {
  const { curlFallback = true, ...fetchInit } = init;
  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const signal = fetchInit.signal
    ? AbortSignal.any([fetchInit.signal, timeoutSignal])
    : timeoutSignal;
  const referer = fetchInit.headers?.Referer;
  const upstreamHeaders = scrapeUpstreamHeaders(url, referer);

  const requestInit = {
    ...fetchInit,
    signal,
    headers: {
      ...upstreamHeaders,
      ...fetchInit.headers,
    },
    redirect: fetchInit.redirect ?? ("follow" as const),
    cache: "no-store" as const,
  };

  const { fetch: undiciFetch } = await import("undici");
  const proxyUrl = scrapeProxyUrl();
  const dispatcher = proxyUrl
    ? scrapeProxyDispatcher()
    : scrapeDirectDispatcher();

  const response = (await undiciFetch(url, {
    method: fetchInit.method ?? "GET",
    headers: requestInit.headers,
    body: fetchInit.body as import("undici").BodyInit | undefined,
    signal,
    redirect: requestInit.redirect,
    dispatcher,
  })) as unknown as Response;

  if (![403, 429, 503].includes(response.status) || !curlFallback) {
    return response;
  }

  const fallback = await scrapeCurlFallback(
    url,
    requestInit.headers as Record<string, string>,
    proxyUrl,
  );
  if (!fallback) {
    return response;
  }

  await cancelResponseBody(response);
  return fallback;
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
