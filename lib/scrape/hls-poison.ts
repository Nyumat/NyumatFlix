const POISONED_HLS_SEGMENT_HOSTS =
  /(?:^|\.)(?:ibyteimg\.com|tiktokcdn\.com|tiktokv\.com|muscdn\.com)$/i;

const POISONED_HLS_SEGMENT_PATH = /\/origin\/ad-site-i18n\//i;

const isPoisonedSegmentUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return (
      POISONED_HLS_SEGMENT_HOSTS.test(parsed.hostname) ||
      POISONED_HLS_SEGMENT_PATH.test(parsed.pathname)
    );
  } catch {
    return false;
  }
};

/** Upstream junk playlists that look like HLS but point at ads or placeholders. */
export const isPoisonedHlsPlaylistBody = (body: string): boolean => {
  if (!body.includes("#EXTM3U")) {
    return false;
  }

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (/^https?:\/\//i.test(trimmed) && isPoisonedSegmentUrl(trimmed)) {
      return true;
    }
  }

  return false;
};
