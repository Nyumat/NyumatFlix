import { cancelResponseBody, scrapeFetch, scrapeFetchText } from "./fetch";
import {
  refererForJustanimeStreamUrl,
  wrapJustanimeMegaplayStreamUrl,
} from "./justanime-momo-proxy";

export const MEGAPLAY_ORIGIN = "https://megaplay.buzz";

type MegaplaySourcesResponse = {
  sources?: { file?: string };
};

/** Numeric getSources ids only — not MAL ids from `/stream/mal/{mal}/{ep}/sub`. */
export const extractNumericMegaplaySourceId = (
  value: string,
): string | null => {
  const fromQuery = value.match(/[?&]id=(\d+)/i)?.[1];
  if (fromQuery) return fromQuery;

  const pathMatch = value.match(
    /megaplay\.buzz\/stream\/(?:s-\d+|embed|e)\/(\d+)/i,
  );
  return pathMatch?.[1] ?? null;
};

export const resolveMegaplaySourcesById = async (
  megaplayId: string,
  referer = `${MEGAPLAY_ORIGIN}/`,
): Promise<string | null> => {
  const response = await scrapeFetchText(
    `${MEGAPLAY_ORIGIN}/stream/getSources?id=${encodeURIComponent(megaplayId)}`,
    {
      Referer: referer,
      Origin: MEGAPLAY_ORIGIN,
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/plain, */*",
    },
  );
  if (response.status !== 200) {
    return null;
  }

  try {
    const payload = JSON.parse(response.text) as MegaplaySourcesResponse;
    const file = payload.sources?.file?.trim();
    return file && /^https?:\/\//i.test(file) ? file : null;
  } catch {
    return null;
  }
};

export const resolveMegaplayEmbedStream = async (
  embedUrl: string,
): Promise<{ streamUrl: string; megaplayId: string } | null> => {
  const directId = extractNumericMegaplaySourceId(embedUrl);
  if (directId) {
    const fromId = await resolveMegaplaySourcesById(directId);
    if (fromId) {
      return { streamUrl: fromId, megaplayId: directId };
    }
  }

  const embedPage = await scrapeFetchText(embedUrl, {
    Referer: `${MEGAPLAY_ORIGIN}/`,
    Origin: MEGAPLAY_ORIGIN,
  });
  if (embedPage.status !== 200) {
    return null;
  }

  const pageId =
    embedPage.text.match(/data-id="(\d+)"/i)?.[1] ??
    embedPage.text.match(/data-realid="(\d+)"/i)?.[1] ??
    null;
  if (!pageId) {
    return null;
  }

  const streamUrl = await resolveMegaplaySourcesById(pageId);
  if (!streamUrl) {
    return null;
  }

  return { streamUrl, megaplayId: pageId };
};

const JUSTANIME_ORIGIN = "https://justanime.to";
const JUSTANIME_API = "https://core.justanime.to/api";

type JustAnimeSource = {
  url?: string;
  quality?: string;
  isM3U8?: boolean;
};

type JustAnimeMegaplayTrack = {
  sources?: JustAnimeSource[];
  headers?: { Referer?: string; Origin?: string };
};

type JustAnimeMegaplayResponse = {
  sub?: JustAnimeMegaplayTrack;
  dub?: JustAnimeMegaplayTrack;
};

const qualityRank = (label: string | undefined): number => {
  const normalized = (label ?? "").toLowerCase();
  if (normalized.includes("1080")) return 1080;
  if (normalized.includes("720")) return 720;
  if (normalized.includes("480")) return 480;
  if (normalized.includes("360")) return 360;
  if (normalized.includes("auto") || normalized.includes("master")) return 900;
  return 0;
};

const pickBestMegaplaySource = (
  sources: JustAnimeSource[] | undefined,
): JustAnimeSource | undefined => {
  const playable = (sources ?? []).filter(
    (source) => Boolean(source.url) && source.isM3U8 !== false,
  );
  if (playable.length === 0) {
    return undefined;
  }

  return [...playable].sort(
    (a, b) => qualityRank(b.quality) - qualityRank(a.quality),
  )[0];
};

export const resolveJustanimeMegaplayStream = async (input: {
  anilistId: number;
  episodeNumber: number;
  translationType?: "sub" | "dub";
}): Promise<{ streamUrl: string; referer: string } | null> => {
  const response = await scrapeFetch(
    `${JUSTANIME_API}/watch/${input.anilistId}/episode/${input.episodeNumber}/megaplay`,
    {
      headers: {
        Accept: "application/json",
        Origin: JUSTANIME_ORIGIN,
        Referer: `${JUSTANIME_ORIGIN}/`,
      },
    },
  );

  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }

  const payload = (await response.json()) as JustAnimeMegaplayResponse;
  const track =
    input.translationType === "dub"
      ? (payload.dub ?? payload.sub)
      : (payload.sub ?? payload.dub);

  const best = pickBestMegaplaySource(track?.sources);
  if (!best?.url) {
    return null;
  }

  const seedStreamUrl = best.url;
  const streamUrl = wrapJustanimeMegaplayStreamUrl(seedStreamUrl);

  return {
    streamUrl,
    referer: refererForJustanimeStreamUrl(
      streamUrl,
      track?.headers?.Referer,
      `${MEGAPLAY_ORIGIN}/`,
    ),
  };
};
