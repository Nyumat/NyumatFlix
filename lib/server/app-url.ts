import { headers } from "next/headers";

function normalizeOrigin(origin: string) {
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

function railwayPublicOrigin() {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;

  if (!railwayDomain) {
    return undefined;
  }

  return normalizeOrigin(
    railwayDomain.startsWith("http")
      ? railwayDomain
      : `https://${railwayDomain}`,
  );
}

export async function getAppOrigin() {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    railwayPublicOrigin();

  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin);
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");

  if (host) {
    const proto = requestHeaders.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }

  return `http://localhost:${process.env.PORT || "3000"}`;
}
