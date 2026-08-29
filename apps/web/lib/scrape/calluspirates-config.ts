const NYUMATFLIX_HOSTS = new Set([
  "nyumatflix.com",
  "www.nyumatflix.com",
  "localhost",
  "127.0.0.1",
]);

function parseAllowedHosts(): Set<string> {
  const extra = process.env.CALLUSPIRATES_DIRECT_ALLOWED_HOSTS?.trim();
  if (!extra) {
    return NYUMATFLIX_HOSTS;
  }
  return new Set([
    ...NYUMATFLIX_HOSTS,
    ...extra
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  ]);
}

export function getCalluspiratesApiUrl(): string | null {
  const raw = process.env.CALLUSPIRATES_API_URL?.trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/\/$/, "");
}

/** Origin the browser uses for Direct playback. Falls back to the server API URL. */
export function getCalluspiratesPublicUrl(): string | null {
  const explicit = process.env.CALLUSPIRATES_PUBLIC_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  return getCalluspiratesApiUrl();
}

export function isDirectProviderSiteHost(hostname: string): boolean {
  return parseAllowedHosts().has(hostname.toLowerCase());
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
