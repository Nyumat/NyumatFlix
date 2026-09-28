import { SITE_NAME, SITE_URL } from "@/lib/constants";

export type WebAuthnRelayingParty = {
  id: string;
  name: string;
  origin: string | string[];
};

const parseOriginList = (value: string | undefined): string[] => {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export function resolveWebAuthnPrimaryOrigin(): string {
  const candidates = [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.APP_URL,
    SITE_URL,
  ];

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    try {
      return new URL(candidate).origin;
    } catch {
      continue;
    }
  }

  return SITE_URL;
}

export function resolveWebAuthnRelatedOrigins(): string[] {
  const primary = resolveWebAuthnPrimaryOrigin();
  const configured = parseOriginList(process.env.WEBAUTHN_RELATED_ORIGINS);
  const origins = new Set<string>([primary, ...configured]);

  for (const candidate of [
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
    SITE_URL,
  ]) {
    if (!candidate?.trim()) continue;
    try {
      origins.add(new URL(candidate).origin);
    } catch {
      continue;
    }
  }

  return [...origins];
}

export function resolveWebAuthnRpId(): string {
  const configured = process.env.WEBAUTHN_RP_ID?.trim();
  if (configured) return configured;

  try {
    return new URL(resolveWebAuthnPrimaryOrigin()).hostname;
  } catch {
    return "localhost";
  }
}

export function resolveWebAuthnRelayingParty(): WebAuthnRelayingParty {
  const origins = resolveWebAuthnRelatedOrigins();
  const primaryOrigin = resolveWebAuthnPrimaryOrigin();

  return {
    id: resolveWebAuthnRpId(),
    name: process.env.WEBAUTHN_RP_NAME?.trim() || SITE_NAME,
    origin: origins.length <= 1 ? primaryOrigin : origins,
  };
}

export function resolvePasskeyEndpointUrls() {
  const origin = resolveWebAuthnPrimaryOrigin();
  return {
    enroll: `${origin}/settings`,
    manage: `${origin}/settings`,
  };
}
