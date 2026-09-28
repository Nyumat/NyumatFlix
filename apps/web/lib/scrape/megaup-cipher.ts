import "server-only";

import {
  decryptMegaupPayloadCore,
  type MegaupDecryptPayload,
} from "./megaup-cipher-core";

/** Default UA sent to MegaUp `/media/` (matches EncDec samples). */
export const MEGAUP_DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

export type { MegaupDecryptPayload } from "./megaup-cipher-core";

export function decryptMegaupPayloadNative(
  encryptedBase64: string,
  init?: { userAgent?: string; mediaId?: string },
): MegaupDecryptPayload {
  return decryptMegaupPayloadCore(encryptedBase64, init);
}

export function decryptMegaupPayload(
  encryptedBase64: string,
  init?: {
    signal?: AbortSignal;
    userAgent?: string;
    mediaId?: string;
  },
): Promise<MegaupDecryptPayload> {
  const agent = init?.userAgent ?? MEGAUP_DEFAULT_USER_AGENT;
  return Promise.resolve(
    decryptMegaupPayloadCore(encryptedBase64, {
      userAgent: agent,
      mediaId: init?.mediaId,
    }),
  );
}
