import "server-only";

import { scrapeFetch } from "../fetch";
import {
  extractMegaupMediaId,
  megaupMediaUrlFromEmbed,
  megaupRefererFromEmbed,
} from "../megaup-cipher-core";
import {
  MEGAUP_DEFAULT_USER_AGENT,
  decryptMegaupPayload,
} from "../megaup-cipher";
import {
  extractEncDecPlayableStreams,
  type EncDecExtractedStream,
} from "./stream-extract";

const DEFAULT_USER_AGENT = MEGAUP_DEFAULT_USER_AGENT;

export { megaupMediaUrlFromEmbed, megaupRefererFromEmbed };

export const resolveMegaupStreams = async (
  mediaUrl: string,
  referer: string,
  init?: { signal?: AbortSignal },
): Promise<EncDecExtractedStream[]> => {
  const response = await scrapeFetch(mediaUrl, {
    headers: {
      Accept: "application/json",
      Referer: referer,
      "User-Agent": DEFAULT_USER_AGENT,
    },
    signal: init?.signal,
    timeoutMs: 15_000,
    retryAttempts: 1,
  });

  if (!response.ok) {
    throw new Error(`MegaUp media request failed (${response.status})`);
  }

  const envelope = (await response.json()) as { result?: string };
  if (!envelope.result) {
    throw new Error("MegaUp media envelope missing result");
  }

  const decrypted = await decryptMegaupPayload(envelope.result, {
    signal: init?.signal,
    userAgent: DEFAULT_USER_AGENT,
    mediaId: extractMegaupMediaId(mediaUrl) ?? undefined,
  });

  return extractEncDecPlayableStreams(decrypted, referer);
};

export const resolveMegaupFromEmbedUrl = async (
  embedUrl: string,
  init?: { signal?: AbortSignal },
): Promise<EncDecExtractedStream[]> => {
  const mediaUrl = megaupMediaUrlFromEmbed(embedUrl);
  const referer =
    megaupRefererFromEmbed(embedUrl) ?? new URL(embedUrl).origin + "/";
  if (!mediaUrl) {
    throw new Error("MegaUp embed URL is invalid");
  }
  return resolveMegaupStreams(mediaUrl, referer, init);
};
