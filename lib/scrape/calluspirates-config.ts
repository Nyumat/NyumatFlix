const NYUMATFLIX_HOSTS = new Set([
  "nyumatflix.com",
  "www.nyumatflix.com",
  "localhost",
  "127.0.0.1",
]);

export function getCalluspiratesApiUrl(): string | null {
  const raw = process.env.CALLUSPIRATES_API_URL?.trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/\/$/, "");
}

export function isDirectProviderSiteHost(hostname: string): boolean {
  return NYUMATFLIX_HOSTS.has(hostname.toLowerCase());
}

/** Direct (calluspirates) is only available on nyumatflix.com and local dev. */
export function isDirectProviderSite(): boolean {
  const configured =
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "";

  if (configured) {
    try {
      return isDirectProviderSiteHost(new URL(configured).hostname);
    } catch {
      // fall through
    }
  }

  return process.env.NODE_ENV === "development";
}

export function isDirectScrapeProviderConfigured(): boolean {
  return Boolean(getCalluspiratesApiUrl()) && isDirectProviderSite();
}
