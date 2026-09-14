export type KaiParsedEpisode = {
  token?: string;
  title?: string;
};

export type KaiParsedEpisodes = Record<
  string,
  Record<string, KaiParsedEpisode>
>;

export type KaiParsedServer = {
  sid?: string | null;
  lid?: string;
  name?: string;
};

export type KaiParsedServers = Record<string, Record<string, KaiParsedServer>>;

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

const readAttr = (tag: string, name: string): string | undefined => {
  const pattern = new RegExp(
    String.raw`(?:^|\s)${name}\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))`,
    "i",
  );
  const match = tag.match(pattern);
  if (!match) {
    return undefined;
  }
  const raw = match[2] ?? match[3] ?? match[4] ?? "";
  return decodeHtmlEntities(raw);
};

const readInnerText = (html: string, start: number, end: number): string => {
  const chunk = html.slice(start, end);
  const text = chunk.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(text.replace(/\s+/g, " "));
};

/** Parse AnimeKai `/ajax/links/list` HTML into enc-dec `parse-html` shape. */
export const parseKaiServersHtml = (html: string): KaiParsedServers => {
  const servers: KaiParsedServers = {};
  const groupPattern =
    /<div\b[^>]*class="[^"]*\bserver-items\b[^"]*\blang-group\b[^"]*"[^>]*>/gi;

  let groupMatch: RegExpExecArray | null;
  while ((groupMatch = groupPattern.exec(html)) !== null) {
    const groupTag = groupMatch[0];
    const type = readAttr(groupTag, "data-id");
    if (!type) {
      continue;
    }

    const groupStart = groupMatch.index + groupTag.length;
    const groupEnd = html.indexOf("</div>", groupStart);
    const groupHtml =
      groupEnd === -1
        ? html.slice(groupStart)
        : html.slice(groupStart, groupEnd);

    const serverPattern = /<div\b[^>]*class="[^"]*\bserver\b[^"]*"[^>]*>/gi;
    let serverMatch: RegExpExecArray | null;
    while ((serverMatch = serverPattern.exec(groupHtml)) !== null) {
      const serverTag = serverMatch[0];
      const lid = readAttr(serverTag, "data-lid");
      if (!lid) {
        continue;
      }

      const num = readAttr(serverTag, "data-num") ?? "1";
      const sid = readAttr(serverTag, "data-sid") ?? null;
      const nameStart = serverMatch.index + serverTag.length;
      const nameEnd = groupHtml.indexOf("</div>", nameStart);
      const name = readInnerText(
        groupHtml,
        nameStart,
        nameEnd === -1 ? groupHtml.length : nameEnd,
      );

      servers[type] ??= {};
      servers[type][num] = { sid, lid, ...(name ? { name } : {}) };
    }
  }

  return servers;
};

const parseEpisodeAnchor = (
  tag: string,
  innerHtml: string,
): { season: string; episode: string; entry: KaiParsedEpisode } | null => {
  const token = readAttr(tag, "token") ?? readAttr(tag, "data-token");
  if (!token) {
    return null;
  }

  const episode =
    readAttr(tag, "num") ??
    readAttr(tag, "data-num") ??
    readAttr(tag, "data-episode");
  if (!episode) {
    return null;
  }

  const season = readAttr(tag, "data-season") ?? readAttr(tag, "season") ?? "1";

  const title = innerHtml
    ? decodeHtmlEntities(
        innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "),
      )
    : undefined;

  return {
    season,
    episode,
    entry: {
      token,
      ...(title ? { title } : {}),
    },
  };
};

/**
 * Parse AnimeKai `/ajax/episodes/list` HTML into enc-dec `parse-html` shape.
 * Matches consumet / AnimeKaiTheme selectors (`.eplist a[num][token]`).
 */
export const parseKaiEpisodesHtml = (html: string): KaiParsedEpisodes => {
  const episodes: KaiParsedEpisodes = {};

  const ingestBlock = (blockHtml: string, seasonHint?: string) => {
    const anchorPattern = /<a\b[^>]*>/gi;
    let anchorMatch: RegExpExecArray | null;
    while ((anchorMatch = anchorPattern.exec(blockHtml)) !== null) {
      const tag = anchorMatch[0];
      const start = anchorMatch.index + tag.length;
      const end = blockHtml.indexOf("</a>", start);
      const inner = end === -1 ? "" : blockHtml.slice(start, end);
      const parsed = parseEpisodeAnchor(tag, inner);
      if (!parsed) {
        continue;
      }

      const season = seasonHint ?? parsed.season;
      episodes[season] ??= {};
      episodes[season][parsed.episode] = parsed.entry;
    }
  };

  const eplistPattern = /<div\b[^>]*class="[^"]*\beplist\b[^"]*"[^>]*>/gi;
  let eplistMatch: RegExpExecArray | null;
  while ((eplistMatch = eplistPattern.exec(html)) !== null) {
    const tag = eplistMatch[0];
    const seasonHint = readAttr(tag, "data-season");
    const start = eplistMatch.index + tag.length;
    const end = html.indexOf("</div>", start);
    const block = end === -1 ? html.slice(start) : html.slice(start, end);
    ingestBlock(block, seasonHint);
  }

  if (Object.keys(episodes).length === 0) {
    ingestBlock(html);
  }

  return episodes;
};
