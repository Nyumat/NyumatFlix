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
    const isPathAbsolute = trimmed.startsWith("/");
    // Path-absolute URIs (/m/…/seg.jpg) keep the playlist origin and drop its
    // query — same as hls.js / RFC 3986. ani.pm's CDN 400s when the playlist
    // `t=` token is pasted onto those segment paths.
    if (
      !isAbsoluteHttp &&
      !isPathAbsolute &&
      !resolved.search &&
      parent.search
    ) {
      resolved.search = parent.search;
    }
    return resolved.toString();
  } catch {
    return null;
  }
};
