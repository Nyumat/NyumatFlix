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

const isLocalOrigin = (origin: string) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

export async function getAppOrigin() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const requestOrigin = host
    ? `${requestHeaders.get("x-forwarded-proto") || "http"}://${host}`
    : undefined;

  const configuredOrigin =
    process.env.APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    railwayPublicOrigin();

  if (configuredOrigin) {
    const normalizedOrigin = normalizeOrigin(configuredOrigin);
    return requestOrigin && isLocalOrigin(normalizedOrigin)
      ? requestOrigin
      : normalizedOrigin;
  }

  if (requestOrigin) {
    return requestOrigin;
  }

  return `http://localhost:${process.env.PORT || "3000"}`;
}
