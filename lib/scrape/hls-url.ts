/**
 * Resolve a relative HLS URI against its parent playlist, inheriting the
 * parent's query string when the child path omits one (tokenized CDNs).
 */
export const resolveHlsPlaylistUrl = (
  value: string,
  playlistUrl: string,
): string | null => {
  try {
    const resolved = new URL(value, playlistUrl);
    const parent = new URL(playlistUrl);
    if (!resolved.search && parent.search) {
      resolved.search = parent.search;
    }
    return resolved.toString();
  } catch {
    return null;
  }
};
