/**
 * Resolve a relative HLS URI against its parent playlist, inheriting the
 * parent's query string when the child path omits one (tokenized CDNs).
 *
 * Absolute http(s) URIs keep their own query — cross-origin CDNs (ani.pm
 * seg.jpg on cdn.ani.pm) reject foreign playlist tokens with 400.
 */
export const resolveHlsPlaylistUrl = (
  value: string,
  playlistUrl: string,
): string | null => {
  try {
    const trimmed = value.trim();
    const resolved = new URL(trimmed, playlistUrl);
    const parent = new URL(playlistUrl);
    const isAbsoluteHttp = /^https?:\/\//i.test(trimmed);
    if (!isAbsoluteHttp && !resolved.search && parent.search) {
      resolved.search = parent.search;
    }
    return resolved.toString();
  } catch {
    return null;
  }
};
