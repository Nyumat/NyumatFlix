import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { GUIDE_HORIZON_MS } from "@/lib/live/program-guide";
import type { LiveChannel, LiveProgram } from "@/lib/live/types";

const BootSchema = z.object({
  sessionToken: z.string().min(1),
  stitcherParams: z.string(),
  servers: z.object({ stitcher: z.string().url() }),
});
const TimelineSchema = z.object({
  data: z.array(
    z.object({
      channelId: z.string(),
      timelines: z.array(
        z.object({
          _id: z.string(),
          title: z.string(),
          start: z.string().datetime(),
          stop: z.string().datetime(),
          episode: z
            .object({
              name: z.string().optional(),
              description: z.string().optional(),
            })
            .optional(),
        }),
      ),
    }),
  ),
});

type PlutoGuide = {
  stitcher: string;
  params: URLSearchParams;
  programs: Map<string, LiveProgram[]>;
};
let cached: { guide: PlutoGuide; expiresAt: number } | null = null;
let inFlight: Promise<PlutoGuide> | null = null;

const fetchJson = async (
  url: string,
  headers?: HeadersInit,
): Promise<unknown> => {
  const response = await fetch(url, {
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Pluto guide returned ${response.status}`);
  return response.json();
};

export const getPlutoChannelId = (url: string) => {
  const parsed = new URL(url);
  return parsed.hostname === "jmp2.uk"
    ? (/^\/plu-([a-f0-9]{24})\.m3u8$/.exec(parsed.pathname)?.[1] ?? null)
    : null;
};

export const getPlutoGuide = async (): Promise<PlutoGuide> => {
  if (cached && cached.expiresAt > Date.now()) return cached.guide;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const bootParams = new URLSearchParams({
      appName: "web",
      appVersion: "8.0.0",
      clientID: randomUUID(),
      clientModelNumber: "1.0.0",
      deviceType: "web",
      deviceMake: "chrome",
      deviceModel: "web",
      deviceVersion: "131.0.0",
    });
    const boot = BootSchema.parse(
      await fetchJson(`https://boot.pluto.tv/v4/start?${bootParams}`),
    );
    const stitcher = new URL(boot.servers.stitcher);
    if (
      stitcher.protocol !== "https:" ||
      !stitcher.hostname.endsWith(".prd.pluto.tv")
    ) {
      throw new Error("Unexpected Pluto stream host");
    }
    const params = new URLSearchParams(boot.stitcherParams);
    params.set("jwt", boot.sessionToken);
    params.set("masterJWTPassthrough", "true");
    const programs = new Map<string, LiveProgram[]>();

    // Schedule failure must not prevent live playback.
    try {
      const headers = { Authorization: `Bearer ${boot.sessionToken}` };
      const catalog = z
        .object({
          data: z.array(z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) })),
        })
        .parse(
          await fetchJson(
            "https://service-channels.clusters.pluto.tv/v2/guide/channels?limit=1000",
            headers,
          ),
        );
      const batches = Array.from(
        { length: Math.ceil(catalog.data.length / 100) },
        (_, index) =>
          catalog.data
            .slice(index * 100, (index + 1) * 100)
            .map((channel) => channel.id),
      );
      const results = await Promise.allSettled(
        batches.map(async (ids) => {
          const params = new URLSearchParams({
            start: new Date().toISOString(),
            duration: String(GUIDE_HORIZON_MS / 60_000),
            channelIds: ids.join(","),
          });
          return TimelineSchema.parse(
            await fetchJson(
              `https://service-channels.clusters.pluto.tv/v2/guide/timelines?${params}`,
              headers,
            ),
          );
        }),
      );
      const timelines = {
        data: results.flatMap((result) =>
          result.status === "fulfilled" ? result.value.data : [],
        ),
      };
      for (const channel of timelines.data) {
        programs.set(
          channel.channelId,
          channel.timelines.flatMap((program) =>
            Date.parse(program.stop) > Date.parse(program.start)
              ? [
                  {
                    id: program._id,
                    title: program.title,
                    startsAt: program.start,
                    endsAt: program.stop,
                    episodeTitle: program.episode?.name ?? null,
                    description: program.episode?.description ?? null,
                  },
                ]
              : [],
          ),
        );
      }
    } catch {
      /* Playback is still available without schedules. */
    }
    const guide = { stitcher: stitcher.origin, params, programs };
    cached = { guide, expiresAt: Date.now() + 5 * 60_000 };
    return guide;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
};

export const buildPlutoStreamUrl = (guide: PlutoGuide, channelId: string) =>
  `${guide.stitcher}/v2/stitch/hls/channel/${channelId}/master.m3u8?${guide.params}`;

export const attachPlutoPrograms = async (channels: LiveChannel[]) => {
  const pluto = await getPlutoGuide().catch(() => null);
  if (!pluto) {
    return channels;
  }

  return channels.map((channel) => {
    if (channel.programs?.length) {
      return channel;
    }

    const sourceUrl = channel.sourceUrl ?? "";
    const plutoId = getPlutoChannelId(sourceUrl);
    if (!plutoId) {
      return channel;
    }

    const programs = pluto.programs.get(plutoId);
    return programs?.length ? { ...channel, programs } : channel;
  });
};
