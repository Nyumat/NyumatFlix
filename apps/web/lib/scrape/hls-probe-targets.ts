import { resolveHlsPlaylistUrl } from "./hls-url";

const HLS_URI_ATTRIBUTE_PATTERN = /\bURI=(?:"([^"]+)"|'([^']+)')/i;

export type HlsProbeTargets = {
  childPlaylist: string | null;
  requiredAssets: string[];
};

export const extractHlsProbeTargets = (
  body: string,
  playlistUrl: string,
): HlsProbeTargets => {
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  const requiredAssets: string[] = [];

  for (const line of lines) {
    if (!line.startsWith("#EXT-X-MAP") && !line.startsWith("#EXT-X-KEY")) {
      continue;
    }

    const match = line.match(HLS_URI_ATTRIBUTE_PATTERN);
    const value = match?.[1] ?? match?.[2];
    if (value) {
      const resolved = resolveHlsPlaylistUrl(value, playlistUrl);
      if (resolved && !requiredAssets.includes(resolved)) {
        requiredAssets.push(resolved);
      }
    }
  }

  let childPlaylist: string | null = null;
  for (const line of lines) {
    if (line && !line.startsWith("#")) {
      const resolved = resolveHlsPlaylistUrl(line, playlistUrl);
      if (!resolved) {
        continue;
      }

      if (body.includes("#EXT-X-STREAM-INF")) {
        childPlaylist = resolved;
        break;
      }

      requiredAssets.push(resolved);
      break;
    }
  }

  return { childPlaylist, requiredAssets };
};
