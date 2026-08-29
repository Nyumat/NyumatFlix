import { scrapeFetch } from "./fetch";
import { resolveHlsPlaylistUrl } from "./hls-url";
import type { ScrapeQuality } from "./types";

/** Pull discrete ABR renditions out of a master so quality menus can switch. */
export const extractAbrQualitiesFromMaster = async (
  masterUrl: string,
  referer: string,
  sourceLabel?: string,
): Promise<ScrapeQuality[]> => {
  try {
    const response = await scrapeFetch(masterUrl, {
      headers: { Referer: referer },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return [];
    }

    const body = await response.text();
    if (!body.includes("#EXT-X-STREAM-INF")) {
      return [];
    }

    const lines = body.split(/\r?\n/).map((line) => line.trim());
    const qualities: ScrapeQuality[] = [];

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]!;
      if (!line.startsWith("#EXT-X-STREAM-INF")) {
        continue;
      }

      const uri = lines[index + 1];
      if (!uri || uri.startsWith("#")) {
        continue;
      }

      const resolved = resolveHlsPlaylistUrl(uri, masterUrl);
      if (!resolved) {
        continue;
      }

      const heightMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
      const height = heightMatch?.[1];
      let label: string;
      if (height) {
        label = sourceLabel ? `${sourceLabel} · ${height}p` : `${height}p`;
      } else if (sourceLabel) {
        label = `${sourceLabel} #${qualities.length + 1}`;
      } else {
        label = `Source ${qualities.length + 1}`;
      }

      qualities.push({ label, url: resolved, referer });
    }

    return qualities;
  } catch {
    return [];
  }
};
