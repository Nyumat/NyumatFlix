import { validateStreamUrlWithReferers } from "../validate-stream";
import { scrapeFetchText } from "../fetch";

/** Vivibebe sometimes returns ad/decoy playlists with image segments. */
export const isBaitHlsPlaylist = (body: string): boolean =>
  /ibyteimg\.com/i.test(body) || /no valid url found/i.test(body);

export const probeHlsPlaylistBody = async (
  streamUrl: string,
  referer: string,
): Promise<string | null> => {
  const response = await scrapeFetchText(streamUrl, { Referer: referer });
  if (response.status !== 200) {
    return null;
  }

  return response.text;
};

export const isPlayableHlsStream = async (
  streamUrl: string,
  referer: string,
): Promise<boolean> => {
  const body = await probeHlsPlaylistBody(streamUrl, referer);
  if (!body?.includes("#EXTM3U") || isBaitHlsPlaylist(body)) {
    return false;
  }

  return (
    await validateStreamUrlWithReferers(streamUrl, referer, "hls", {
      depth: "full",
    })
  ).ok;
};
