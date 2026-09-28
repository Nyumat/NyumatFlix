import "server-only";

import { scrapeFetch } from "../../fetch";
import {
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  probeScrapePlaybackPath,
} from "../../playback-probe";
import { firstOkInBatches } from "../../race-first";
import type { ScrapeQuality } from "../../types";
import { parseKaiEpisodesHtml, parseKaiServersHtml } from "../animekai-html";
import { decKaiPayload, encKaiToken } from "../animekai-cipher";
import {
  resolveMegaupFromEmbedUrl,
  resolveMegaupStreams,
} from "../../enc-dec/megaup";
import {
  extractEncDecPlayableStreams,
  mapEncDecQualities,
} from "../../enc-dec/stream-extract";
import { fetchKaiDbEntryByAnilistId } from "../enc-dec-kai-db";
import {
  buildMegaupAbsoluteUrl,
  pickKaiSourcePath,
  translationToKaiType,
} from "../animekai-helpers";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";

const ANIMEKAI_ORIGIN = "https://animekai.to";
const ANIMEKAI_AJAX = `${ANIMEKAI_ORIGIN}/ajax`;

const scrapeAnimekaiAjaxEmbed = async (
  input: AnimeScrapeInput,
  contentId: string,
): Promise<string | null> => {
  const encId = encKaiToken(contentId);
  const episodesResp = await scrapeFetch(
    `${ANIMEKAI_AJAX}/episodes/list?ani_id=${encodeURIComponent(contentId)}&_=${encodeURIComponent(encId)}`,
    {
      headers: {
        Accept: "application/json",
        Referer: `${ANIMEKAI_ORIGIN}/`,
      },
      signal: input.signal,
      timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
      retryAttempts: 1,
    },
  );
  if (!episodesResp.ok) {
    return null;
  }

  const episodesJson = (await episodesResp.json()) as { result?: string };
  if (!episodesJson.result) {
    return null;
  }

  const episodes = parseKaiEpisodesHtml(episodesJson.result);
  const season = "1";
  const episode = String(input.episodeNumber);
  const token = episodes[season]?.[episode] as { token?: string } | undefined;
  if (!token?.token) {
    return null;
  }

  const encToken = encKaiToken(token.token);
  const serversResp = await scrapeFetch(
    `${ANIMEKAI_AJAX}/links/list?token=${encodeURIComponent(token.token)}&_=${encodeURIComponent(encToken)}`,
    {
      headers: {
        Accept: "application/json",
        Referer: `${ANIMEKAI_ORIGIN}/`,
      },
      signal: input.signal,
      timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
      retryAttempts: 1,
    },
  );
  if (!serversResp.ok) {
    return null;
  }

  const serversJson = (await serversResp.json()) as { result?: string };
  if (!serversJson.result) {
    return null;
  }

  const servers = parseKaiServersHtml(serversJson.result);
  const type = translationToKaiType(input.translationType);
  const serverNode = servers[type] as
    | Record<string, { lid?: string }>
    | undefined;
  const lid = serverNode?.["1"]?.lid;
  if (!lid) {
    return null;
  }

  const encLid = encKaiToken(lid);
  const embedResp = await scrapeFetch(
    `${ANIMEKAI_AJAX}/links/view?id=${encodeURIComponent(lid)}&_=${encodeURIComponent(encLid)}`,
    {
      headers: {
        Accept: "application/json",
        Referer: `${ANIMEKAI_ORIGIN}/`,
      },
      signal: input.signal,
      timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
      retryAttempts: 1,
    },
  );
  if (!embedResp.ok) {
    return null;
  }

  const embedJson = (await embedResp.json()) as { result?: string };
  if (!embedJson.result) {
    return null;
  }

  const decrypted = decKaiPayload(embedJson.result);

  return decrypted.url ?? null;
};

export async function scrapeAnimekai(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animekai" as const;

  try {
    const dbEntry = await fetchKaiDbEntryByAnilistId(input.anilistId, {
      signal: input.signal,
    });

    const dbPath = pickKaiSourcePath(dbEntry, input);
    const mirror = dbEntry?.info?.mirrors?.megaup?.[0];
    let embedUrl: string | null = null;

    if (dbPath && mirror) {
      embedUrl = buildMegaupAbsoluteUrl(mirror, dbPath);
    } else if (dbEntry?.info?.content_id) {
      embedUrl = await scrapeAnimekaiAjaxEmbed(input, dbEntry.info.content_id);
    }

    if (!embedUrl) {
      return {
        ok: false,
        providerId,
        error: "AnimeKai source unavailable for this episode",
        unavailable: true,
      };
    }

    const referer = `${ANIMEKAI_ORIGIN}/`;
    const streams = embedUrl.includes("/e/")
      ? await resolveMegaupFromEmbedUrl(embedUrl, { signal: input.signal })
      : await resolveMegaupStreams(
          embedUrl,
          mirror ? `${new URL(mirror).origin}/` : referer,
          { signal: input.signal },
        ).catch(() => extractEncDecPlayableStreams({ url: embedUrl }, referer));

    if (streams.length === 0) {
      return {
        ok: false,
        providerId,
        error: "AnimeKai returned no playable streams",
      };
    }

    const winner = await firstOkInBatches(
      streams,
      async (stream) => {
        const kind = /\.mp4(?:[?#]|$)/i.test(stream.url) ? "mp4" : "hls";
        const streamReferer = stream.referer ?? referer;
        const ok = await probeScrapePlaybackPath(
          { url: stream.url, referer: streamReferer },
          kind,
          { signal: input.signal },
        );
        if (!ok) {
          return null;
        }
        return { ...stream, referer: streamReferer };
      },
      2,
      { signal: input.signal },
    );

    if (!winner) {
      return {
        ok: false,
        providerId,
        error: "AnimeKai streams failed playback probe",
      };
    }

    const streamUrl = winner.value.url;
    const streamReferer = winner.value.referer ?? referer;
    const qualities: ScrapeQuality[] | undefined = mapEncDecQualities(
      streams,
      streamUrl,
      streamReferer,
    );

    return {
      ok: true,
      providerId,
      streamUrl,
      streamKind: /\.mp4(?:[?#]|$)/i.test(streamUrl) ? "mp4" : "hls",
      referer: streamReferer,
      validated: true,
      ...(qualities ? { qualities } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AnimeKai scrape failed",
    };
  }
}
