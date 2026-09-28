import { resolveWebAuthnRelayingParty } from "@/lib/passkeys/rp-config";

type RelayingPartyRequest = {
  headers?: {
    origin?: string;
    host?: string;
  };
};

export function getPasskeyRelayingParty(
  _options: unknown,
  request: RelayingPartyRequest,
) {
  const configured = resolveWebAuthnRelayingParty();
  const requestOrigin = resolveRequestOrigin(request);

  if (requestOrigin && Array.isArray(configured.origin)) {
    if (configured.origin.includes(requestOrigin)) {
      return {
        id: configured.id,
        name: configured.name,
        origin: requestOrigin,
      };
    }
  }

  return {
    id: configured.id,
    name: configured.name,
    origin: Array.isArray(configured.origin)
      ? configured.origin[0]
      : configured.origin,
  };
}

function resolveRequestOrigin(request: RelayingPartyRequest): string | null {
  const headerOrigin = request.headers?.origin;
  if (typeof headerOrigin === "string" && headerOrigin.length > 0) {
    return headerOrigin;
  }

  const host = request.headers?.host;
  if (typeof host === "string" && host.length > 0) {
    const protocol = host.includes("localhost") ? "http" : "https";
    return `${protocol}://${host}`;
  }

  return null;
}
