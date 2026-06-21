import { z } from "zod";

export const VideasyStreamSchema = z.object({
  quality: z.string(),
  url: z.string(),
  mimeType: z.string(),
});

export const VideasyTrailerPayloadSchema = z.object({
  id: z.string().optional(),
  trailer: z
    .object({
      streams: z.array(VideasyStreamSchema),
    })
    .optional(),
});

export type VideasyStream = z.infer<typeof VideasyStreamSchema>;

const MP4 = "MP4";

const qualityRank = (quality: string): number => {
  const upper = quality.trim().toUpperCase();
  if (upper.includes("1080")) return 0;
  if (upper.includes("720")) return 1;
  if (upper.includes("480")) return 2;
  if (upper === "SD") return 3;
  if (upper === "AUTO") return 4;
  return 5;
};

export const pickBestVideasyMp4Stream = (
  streams: VideasyStream[],
): string | null => {
  const mp4 = streams.filter(
    (s) => s.mimeType.trim().toUpperCase() === MP4 && s.url.length > 0,
  );
  if (mp4.length === 0) {
    return null;
  }

  let best = mp4[0];
  let bestRank = qualityRank(best.quality);
  for (let i = 1; i < mp4.length; i++) {
    const candidate = mp4[i];
    const r = qualityRank(candidate.quality);
    if (r < bestRank) {
      best = candidate;
      bestRank = r;
    }
  }

  return best.url;
};

const isHlsStream = (s: VideasyStream): boolean => {
  const mime = s.mimeType.trim().toUpperCase();
  if (mime === "M3U8" || mime.includes("M3U")) {
    return true;
  }
  return s.url.toLowerCase().includes(".m3u8");
};

export const pickBestVideasyHlsStream = (
  streams: VideasyStream[],
): string | null => {
  const hls = streams.filter((s) => isHlsStream(s) && s.url.length > 0);
  if (hls.length === 0) {
    return null;
  }

  let best = hls[0];
  let bestRank = qualityRank(best.quality);
  for (let i = 1; i < hls.length; i++) {
    const candidate = hls[i];
    const r = qualityRank(candidate.quality);
    if (r < bestRank) {
      best = candidate;
      bestRank = r;
    }
  }

  return best.url;
};
