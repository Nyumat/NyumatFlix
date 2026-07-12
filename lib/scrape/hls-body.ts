import { decodeBase64Loose } from "./anime/html-utils";

const looksLikeBase64Payload = (value: string): boolean =>
  value.length >= 8 && /^[A-Za-z0-9+/=_-]+$/.test(value);

const decodeIfManifest = (value: string): string | null => {
  if (!looksLikeBase64Payload(value)) {
    return null;
  }

  try {
    const decoded = decodeBase64Loose(value);
    if (
      decoded.includes("#EXTM3U") ||
      decoded.includes("WEBVTT") ||
      decoded.includes("<MPD")
    ) {
      return decoded;
    }
  } catch {
    return null;
  }

  return null;
};

/** Megaplay / AniKuro CDNs sometimes ship playlists and VTT as base64 bodies. */
export const decodeObfuscatedHlsBody = (body: string): string => {
  const trimmed = body.trim();
  if (!trimmed) {
    return body;
  }

  if (
    trimmed.includes("#EXTM3U") ||
    trimmed.includes("WEBVTT") ||
    trimmed.includes("<MPD")
  ) {
    return body;
  }

  return decodeIfManifest(trimmed) ?? body;
};
