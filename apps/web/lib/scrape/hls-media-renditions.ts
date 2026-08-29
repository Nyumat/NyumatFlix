const HLS_MEDIA_LINE = /#EXT-X-MEDIA:([^\n]+)/gi;

const readMediaAttribute = (
  attrs: string,
  name: string,
): string | undefined => {
  const quoted = new RegExp(`(?:^|,)\\s*${name}="([^"]*)"`, "i").exec(attrs);
  if (quoted?.[1]) {
    return quoted[1].trim();
  }

  const bare = new RegExp(`(?:^|,)\\s*${name}=([^,\\s]+)`, "i").exec(attrs);
  return bare?.[1]?.trim();
};

export const countHlsMediaRenditions = (
  body: string,
  mediaType: "AUDIO" | "SUBTITLES",
): number => {
  const keys = new Set<string>();

  for (const match of body.matchAll(HLS_MEDIA_LINE)) {
    const attrs = match[1] ?? "";
    const type = readMediaAttribute(attrs, "TYPE")?.toUpperCase();
    if (type !== mediaType) {
      continue;
    }

    const key = (
      readMediaAttribute(attrs, "LANGUAGE") ??
      readMediaAttribute(attrs, "NAME") ??
      readMediaAttribute(attrs, "URI") ??
      attrs
    )
      .trim()
      .toLowerCase();

    if (key) {
      keys.add(key);
    }
  }

  return keys.size;
};
