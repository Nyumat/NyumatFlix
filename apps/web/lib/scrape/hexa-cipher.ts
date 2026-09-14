import "server-only";

import { decryptHexaViaWasm, encHexaCapToken } from "./hexa-wasm-session";

export const HEXA_FINGERPRINT_LITE = "e9136c41504646444";

export const HEXA_CAP_SITE_ENDPOINT = "https://cap.hexa.su/15d2cf0395/";

type HexaSourcesPayload = {
  sources: Array<{ server: string; url: string }>;
};

/**
 * Validates the per-request `X-Api-Key` header (32 random bytes as 64 hex chars).
 * AES-256-GCM key material is derived inside theemoviedb.hexa.su WASM
 * (`process_img_data`); this is not raw key bytes.
 */
export function deriveHexaContentKey(apiKeyHex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(apiKeyHex)) {
    throw new Error("Hexa X-Api-Key must be 64 hex characters (32 bytes)");
  }
  return Buffer.from(apiKeyHex, "hex");
}

export function parseHexaSourcesPayload(plaintext: string): HexaSourcesPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error("Hexa decrypted payload is not valid JSON");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("sources" in parsed) ||
    !Array.isArray((parsed as HexaSourcesPayload).sources)
  ) {
    throw new Error("Hexa decrypted payload missing sources array");
  }

  return parsed as HexaSourcesPayload;
}

/** Decrypt TMDB `/images` body via in-house WASM (no enc-dec.app). */
export async function decryptHexaApiResponse(
  encryptedBase64: string,
  apiKeyHex: string,
  init?: { signal?: AbortSignal },
): Promise<HexaSourcesPayload> {
  const plaintext = await decryptHexaViaWasm(encryptedBase64, apiKeyHex, init);
  if (typeof plaintext !== "string") {
    throw new Error(
      `Hexa WASM decrypt returned ${typeof plaintext}, expected string`,
    );
  }
  return parseHexaSourcesPayload(plaintext);
}

export { encHexaCapToken };

/** @deprecated Prefer `decryptHexaApiResponse`; WASM performs key derivation. */
export async function decryptHexaResponse(
  encryptedBase64: string,
  apiKeyHex: string,
  init?: { signal?: AbortSignal },
): Promise<HexaSourcesPayload> {
  return decryptHexaApiResponse(encryptedBase64, apiKeyHex, init);
}
