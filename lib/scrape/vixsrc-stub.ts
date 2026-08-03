/** VixSrc playlist endpoints can return JSON/HTML stubs that are not playable HLS. */
export const isVixsrcPlaylistUrl = (streamUrl: string): boolean =>
  /vixsrc\.to\/playlist\//i.test(streamUrl);

export const isVixsrcStubPlaylistBody = (
  streamUrl: string,
  body: string,
): boolean => {
  if (!isVixsrcPlaylistUrl(streamUrl)) {
    return false;
  }

  const trimmed = body.trim();
  if (
    trimmed.startsWith("{") &&
    trimmed.includes('"playlist"') &&
    !trimmed.includes("#EXTM3U")
  ) {
    return true;
  }

  if (
    body.includes("#EXTM3U") &&
    !body.includes("#EXTINF") &&
    !body.includes("#EXT-X-STREAM-INF") &&
    !body.includes("#EXT-X-MAP")
  ) {
    return true;
  }

  return false;
};
