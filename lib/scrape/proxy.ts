import "server-only";

import { Agent, ProxyAgent } from "undici";

let scrapeDirectAgent: Agent | undefined;
let scrapeProxyAgent: ProxyAgent | undefined;

export const scrapeDirectDispatcher = (): Agent => {
  scrapeDirectAgent ??= new Agent({
    allowH2: true,
    connections: 4,
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 120_000,
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

  scrapeProxyAgent ??= new ProxyAgent(url);
  return scrapeProxyAgent;
};
