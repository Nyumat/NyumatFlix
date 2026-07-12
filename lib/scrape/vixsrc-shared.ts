export const VIXSRC_ORIGIN = "https://vixsrc.to";

export type VixsrcPlaylistParams = {
  videoId: string;
  token: string;
  expires: string;
};

export const extractVixsrcPlaylistParams = (
  html: string,
): VixsrcPlaylistParams | null => {
  const videoId =
    html.match(/window\.video\s*=\s*\{[\s\S]*?\bid:\s*['"](\d+)['"]/)?.[1] ??
    null;
  const token =
    html.match(
      /window\.masterPlaylist\s*=\s*\{[\s\S]*?'token'\s*:\s*'([^']+)'/,
    )?.[1] ??
    html.match(/"token"\s*:\s*"([a-f0-9]+)"/i)?.[1] ??
    null;
  const expires =
    html.match(
      /window\.masterPlaylist\s*=\s*\{[\s\S]*?'expires'\s*:\s*'(\d+)'/,
    )?.[1] ??
    html.match(/"expires"\s*:\s*"?(\d+)"?/)?.[1] ??
    null;

  if (!videoId || !token || !expires) {
    return null;
  }

  return { videoId, token, expires };
};

export const buildVixsrcPlaylistUrl = (
  params: Pick<VixsrcPlaylistParams, "videoId" | "token" | "expires">,
): string => {
  const playlistUrl = new URL(`${VIXSRC_ORIGIN}/playlist/${params.videoId}`);
  playlistUrl.searchParams.set("token", params.token);
  playlistUrl.searchParams.set("expires", params.expires);
  playlistUrl.searchParams.set("h", "1");
  return playlistUrl.toString();
};

export const isVixsrcPlaylistUrl = (
  upstreamUrl: string,
  videoId?: string,
): boolean => {
  try {
    const parsed = new URL(upstreamUrl);
    if (!/vixsrc\.to$/i.test(parsed.hostname)) {
      return false;
    }
    if (!parsed.pathname.startsWith("/playlist/")) {
      return false;
    }
    if (!videoId) {
      return true;
    }
    return parsed.pathname === `/playlist/${videoId}`;
  } catch {
    return false;
  }
};
