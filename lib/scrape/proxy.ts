import "server-only";

import { ProxyAgent } from "undici";

let scrapeProxyAgent: ProxyAgent | undefined;

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
