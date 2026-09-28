import "server-only";

import { decryptAnimeKai, encryptAnimeKai } from "./animekai-cipher-core";

export type KaiEmbedPayload = { url?: string };

/** AnimeKai `_=` query param (enc-dec `enc-kai`). Alphanumeric / token ids. */
export function encKaiToken(plaintext: string): string {
  const text = plaintext.trim();
  if (!text) {
    throw new Error("enc-kai received empty plaintext");
  }
  return encryptAnimeKai(text);
}

/** Decrypts AnimeKai `/ajax/links/view` `result` (enc-dec `dec-kai`). */
export function decKaiPayload(ciphertext: string): KaiEmbedPayload {
  const trimmed = ciphertext.trim();
  if (!trimmed) {
    throw new Error("dec-kai received empty ciphertext");
  }

  const decoded = decryptAnimeKai(trimmed);
  const parsed: unknown = JSON.parse(decoded);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("dec-kai result is not a JSON object");
  }
  return parsed as KaiEmbedPayload;
}
