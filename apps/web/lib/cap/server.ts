import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getCapApiEndpoint } from "@/lib/cap/config";
import { CAP_SESSION_TTL_SECONDS } from "@/lib/cap/constants";

export { CAP_SESSION_TTL_SECONDS } from "@/lib/cap/constants";
export const CAP_SESSION_COOKIE = "nyumatflix_cap_session";

type SiteverifyResponse = {
  success?: unknown;
};

const getSessionSecret = (): string => {
  const secret = process.env.CAP_SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("CAP_SESSION_SECRET must contain at least 32 characters");
  }
  return secret;
};

const signSessionExpiry = (expiresAt: number): string =>
  createHmac("sha256", getSessionSecret())
    .update(String(expiresAt))
    .digest("base64url");

export const createCapSessionToken = (now = Date.now()): string => {
  const expiresAt = Math.floor(now / 1000) + CAP_SESSION_TTL_SECONDS;
  return `${expiresAt}.${signSessionExpiry(expiresAt)}`;
};

export const isValidCapSessionToken = (
  value: string | undefined,
  now = Date.now(),
): boolean => {
  if (!value) return false;

  const [rawExpiresAt, signature, ...extra] = value.split(".");
  if (!rawExpiresAt || !signature || extra.length > 0) return false;

  const expiresAt = Number(rawExpiresAt);
  const nowSeconds = Math.floor(now / 1000);
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= nowSeconds ||
    expiresAt > nowSeconds + CAP_SESSION_TTL_SECONDS
  ) {
    return false;
  }

  const expected = Buffer.from(signSessionExpiry(expiresAt));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const readCookie = (
  cookieHeader: string | null,
  name: string,
): string | undefined => {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
};

export const requestHasCapSession = (request: Request): boolean =>
  isValidCapSessionToken(
    readCookie(request.headers.get("cookie"), CAP_SESSION_COOKIE),
  );

export const verifyCapToken = async (token: unknown): Promise<boolean> => {
  const secret = process.env.CAP_SECRET_KEY?.trim();
  if (
    typeof token !== "string" ||
    token.length === 0 ||
    token.length > 4096 ||
    !secret
  ) {
    return false;
  }

  try {
    const response = await fetch(new URL("siteverify", getCapApiEndpoint()), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, response: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as SiteverifyResponse;
    return result.success === true;
  } catch {
    return false;
  }
};
