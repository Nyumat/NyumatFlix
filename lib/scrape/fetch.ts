import "server-only";

import type { Dispatcher } from "undici";
import {
  scrapeDirectDispatcher,
  scrapeProxyDispatcher,
  scrapeProxyUrl,
} from "./proxy";
import { scrapeUpstreamHeaders } from "./upstream-headers";
import { isVidKingCdnUrl } from "./vidking-cdn-url";
import {
  rotateScrapeVpnEgress,
  scrapeRateLimitRotateHostname,
} from "./vpn-rotate";

const FETCH_TIMEOUT_MS = 30_000;
const FETCH_RETRY_ATTEMPTS = 3;
const FETCH_RETRY_DELAY_MS = 750;
const CURL_FALLBACK_HOSTS =
  /(?:^kwik\.[a-z]+$|^api\.wingsdatabase\.com$|^cloudorchestranova\.com$|(?:^|\.)(?:uwucdn\.top|owocdn\.top|opstream11\.com|opstream16\.com|goodstream\.cc|astroliteonline\.online|tripplestream\.online|glowhavenmedia\.cyou|1x2\.space|peregrinepalaver\.space|meadowlaneeducation\.cfd|tiktokcdn\.com|\.space)$)/i;

const VIDSRC_DIRECT_HOST_PATTERN =
  /(?:^|\.)vsembed\.ru$|(?:^|\.)vidsrc-embed\.ru$|^cloudorchestranova\.com$|\.space$/i;

const BLOCKED_STATUSES = new Set([403, 429, 503]);

export const scrapePreferProxyHostname = (hostname: string): boolean =>
  hostname === "api.wingsdatabase.com";

export const scrapeBypassesProxyHostname = (hostname: string): boolean =>
  hostname === "graphql.anilist.co" ||
  hostname === "stream.animeparadise.moe" ||
  hostname === "api.kyren.moe" ||
  hostname === "kyren.moe" ||
  /(?:^|\.)(?:vivibebe\.site|megaplay\.buzz)$/.test(hostname) ||
  VIDSRC_DIRECT_HOST_PATTERN.test(hostname) ||
  /mewstream/i.test(hostname) ||
  /^momo\./i.test(hostname) ||
  hostname === "momo.justanime.to" ||
  /\.workers\.dev$/i.test(hostname);

type HostEgressPreference = "direct" | "proxy";

/** Per-host memory: once proxy is required, skip burning a direct attempt. */
const hostEgressPreference = new Map<string, HostEgressPreference>();

export const resetScrapeHostEgressPreferences = (): void => {
  hostEgressPreference.clear();
};

export const scrapePreferDirectEgress = (): boolean =>
  process.env.SCRAPE_PREFER_DIRECT?.trim() !== "0";

type ScrapeFetchInit = RequestInit & {
  headers?: Record<string, string>;
  curlFallback?: boolean;
  timeoutMs?: number;
};

const hostnameOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
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
    (!CURL_FALLBACK_HOSTS.test(parsed.hostname) && !isVidKingCdnUrl(url))
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
  let lastError: unknown;

  for (let attempt = 0; attempt < FETCH_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, FETCH_RETRY_DELAY_MS * attempt),
      );
    }

    try {
      return await scrapeFetchOnce(url, init);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`scrapeFetch failed for ${url}`);
}

async function undiciRequest(
  url: string,
  requestInit: {
    method?: string;
    headers: Record<string, string>;
    body?: RequestInit["body"];
    signal: AbortSignal;
    redirect: RequestRedirect;
  },
  dispatcher: Dispatcher,
): Promise<Response> {
  const { fetch: undiciFetch } = await import("undici");
  return (await undiciFetch(url, {
    method: requestInit.method ?? "GET",
    headers: requestInit.headers,
    body: requestInit.body as import("undici").BodyInit | undefined,
    signal: requestInit.signal,
    redirect: requestInit.redirect,
    dispatcher,
  })) as unknown as Response;
}

async function scrapeFetchOnce(
  url: string,
  init: ScrapeFetchInit = {},
): Promise<Response> {
  const { curlFallback = true, timeoutMs, ...fetchInit } = init;
  const timeoutSignal = AbortSignal.timeout(timeoutMs ?? FETCH_TIMEOUT_MS);
  const signal = fetchInit.signal
    ? AbortSignal.any([fetchInit.signal, timeoutSignal])
    : timeoutSignal;
  const referer = fetchInit.headers?.Referer;
  const upstreamHeaders = scrapeUpstreamHeaders(url, referer);

  const requestInit = {
    method: fetchInit.method ?? "GET",
    headers: {
      ...upstreamHeaders,
      ...fetchInit.headers,
    } as Record<string, string>,
    body: fetchInit.body,
    signal,
    redirect: (fetchInit.redirect ?? "follow") as RequestRedirect,
  };

  const hostname = hostnameOf(url);
  const proxyUrl = scrapeProxyUrl();
  const proxyDispatcher = proxyUrl ? scrapeProxyDispatcher() : undefined;
  const preferProxyOnly =
    Boolean(hostname) &&
    Boolean(proxyUrl) &&
    Boolean(proxyDispatcher) &&
    scrapePreferProxyHostname(hostname);

  const preferDirect =
    !preferProxyOnly &&
    Boolean(proxyUrl) &&
    Boolean(proxyDispatcher) &&
    scrapePreferDirectEgress() &&
    hostEgressPreference.get(hostname) !== "proxy";

  const tryCurlFallback = async (
    egressProxyUrl: string | undefined,
    failed?: Response,
  ) => {
    if (!curlFallback) {
      return failed ?? null;
    }

    const fallback = await scrapeCurlFallback(
      url,
      requestInit.headers,
      egressProxyUrl,
    );
    if (!fallback) {
      return failed ?? null;
    }

    if (failed) {
      await cancelResponseBody(failed);
    }

    return fallback;
  };

  const attemptEgress = async (
    dispatcher: Dispatcher,
    egressProxyUrl: string | undefined,
    preference: HostEgressPreference,
  ): Promise<Response | "error"> => {
    try {
      const response = await undiciRequest(url, requestInit, dispatcher);

      if (BLOCKED_STATUSES.has(response.status)) {
        const fallback = await tryCurlFallback(egressProxyUrl, response);
        if (fallback && fallback !== response) {
          if (hostname && !scrapeBypassesProxyHostname(hostname)) {
            hostEgressPreference.set(hostname, preference);
          }
          return fallback;
        }
        return response;
      }

      if (hostname && !scrapeBypassesProxyHostname(hostname)) {
        hostEgressPreference.set(hostname, preference);
      }
      return response;
    } catch {
      const fallback = await tryCurlFallback(egressProxyUrl);
      if (fallback) {
        if (hostname && !scrapeBypassesProxyHostname(hostname)) {
          hostEgressPreference.set(hostname, preference);
        }
        return fallback;
      }
      return "error";
    }
  };

  if (hostname && scrapeBypassesProxyHostname(hostname)) {
    const directOnly = await attemptEgress(
      scrapeDirectDispatcher(),
      undefined,
      "direct",
    );
    if (directOnly !== "error") {
      return directOnly;
    }
    throw new Error(`scrapeFetch failed for ${url}`);
  }

  if (preferDirect) {
    const directResult = await attemptEgress(
      scrapeDirectDispatcher(),
      undefined,
      "direct",
    );
    if (
      directResult !== "error" &&
      !BLOCKED_STATUSES.has(directResult.status)
    ) {
      return directResult;
    }
    if (hostname && !scrapeBypassesProxyHostname(hostname)) {
      // Don't keep paying a doomed direct hop on the next request.
      hostEgressPreference.set(hostname, "proxy");
    }
    if (directResult !== "error") {
      await cancelResponseBody(directResult);
    }
  }

  if (proxyDispatcher && proxyUrl) {
    let proxyResult = await attemptEgress(proxyDispatcher, proxyUrl, "proxy");

    if (
      proxyResult !== "error" &&
      proxyResult.status === 429 &&
      hostname &&
      scrapeRateLimitRotateHostname(hostname) &&
      (await rotateScrapeVpnEgress()).ok
    ) {
      await cancelResponseBody(proxyResult);
      proxyResult = await attemptEgress(proxyDispatcher, proxyUrl, "proxy");
    }

    if (proxyResult !== "error") {
      return proxyResult;
    }
    throw new Error(`scrapeFetch failed for ${url}`);
  }

  const directOnly = await attemptEgress(
    scrapeDirectDispatcher(),
    undefined,
    "direct",
  );
  if (directOnly !== "error") {
    return directOnly;
  }

  throw new Error(`scrapeFetch failed for ${url}`);
}

export async function scrapeFetchText(
  url: string,
  headers: Record<string, string> = {},
  options: { timeoutMs?: number } = {},
): Promise<{ status: number; text: string }> {
  const response = await scrapeFetch(url, {
    headers,
    timeoutMs: options.timeoutMs,
  });
  return {
    status: response.status,
    text: await response.text(),
  };
}
