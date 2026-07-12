import "server-only";

import { Agent, Pool, ProxyAgent } from "undici";

const CONNECTIONS_PER_ORIGIN = 4;
const PROXY_TUNNEL_CONNECTIONS = 32;
const MAX_PROXY_ORIGINS = 64;
const KEEP_ALIVE_TIMEOUT_MS = 10_000;
const KEEP_ALIVE_MAX_TIMEOUT_MS = 30_000;

let scrapeDirectAgent: Agent | undefined;
let scrapeProxyAgent: ProxyAgent | undefined;

export const scrapeDirectDispatcher = (): Agent => {
  scrapeDirectAgent ??= new Agent({
    allowH2: true,
    connections: CONNECTIONS_PER_ORIGIN,
    maxOrigins: MAX_PROXY_ORIGINS,
    keepAliveTimeout: KEEP_ALIVE_TIMEOUT_MS,
    keepAliveMaxTimeout: KEEP_ALIVE_MAX_TIMEOUT_MS,
  });

  return scrapeDirectAgent;
};

export const scrapeProxyUrl = (): string | undefined => {
  const url = process.env.SCRAPE_PROXY_URL?.trim();
  return url || undefined;
};

export const scrapeProxyDispatcher = (): ProxyAgent | undefined => {
  const url = scrapeProxyUrl();
  if (!url) {
    return undefined;
  }

  scrapeProxyAgent ??= new ProxyAgent({
    uri: url,
    connections: CONNECTIONS_PER_ORIGIN,
    maxOrigins: MAX_PROXY_ORIGINS,
    keepAliveTimeout: KEEP_ALIVE_TIMEOUT_MS,
    keepAliveMaxTimeout: KEEP_ALIVE_MAX_TIMEOUT_MS,
    clientFactory: (origin, options) =>
      new Pool(origin, {
        ...options,
        connections: PROXY_TUNNEL_CONNECTIONS,
      }),
  });
  return scrapeProxyAgent;
};
