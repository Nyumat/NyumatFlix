import type { VideasyStream } from "@/lib/videasy-trailer";

const IMDB_GRAPHQL_URL = "https://graphql.prod.api.imdb.a2z.com/";
const TRAILER_CONTENT_TYPE = "amzn1.imdb.video.contenttype.trailer";

const IMDB_HEADERS = {
  Referer: "https://www.imdb.com/",
  Origin: "https://www.imdb.com",
  "User-Agent": "Mozilla/5.0",
  "Content-Type": "application/json",
};

const gqlMin = (query: string): string => query.replace(/ {4}/g, "");

const VIDEO_GALLERY_FRAGMENT = gqlMin(`
fragment VideoGalleryItems on VideoConnection {
    pageInfo { endCursor hasNextPage }
    total
    edges {
        node {
            id
            contentType { id }
            name { value }
            runtime { value }
            primaryTitle {
                series {
                    displayableEpisodeNumber {
                        displayableSeason { season }
                    }
                    series { titleText { text } }
                }
            }
        }
    }
}
`);

const TITLE_VIDEO_GALLERY_QUERY = gqlMin(`
query TitleVideoGallerySubPage(
    $const: ID!,
    $first: Int!,
    $filter: VideosQueryFilter,
    $sort: VideoSort
) {
    title(id: $const) {
        videoStrip(first: $first, filter: $filter, sort: $sort) {
            ...VideoGalleryItems
        }
    }
}
${VIDEO_GALLERY_FRAGMENT}
`);

const TITLE_VIDEO_GALLERY_PAGINATION_QUERY = gqlMin(`
query TitleVideoGalleryPagination(
    $const: ID!,
    $first: Int!,
    $after: ID!,
    $filter: VideosQueryFilter,
    $sort: VideoSort
) {
    title(id: $const) {
        videoStrip(first: $first, after: $after, filter: $filter, sort: $sort) {
            ...VideoGalleryItems
        }
    }
}
${VIDEO_GALLERY_FRAGMENT}
`);

const VIDEO_PLAYBACK_QUERY = gqlMin(`
query VideoPlayback($const: ID!) {
    video(id: $const) {
        playbackURLs {
            url
            videoDefinition
            videoMimeType
        }
    }
}
`);

type ImdbVideoNode = {
  id: string;
  contentType?: { id?: string };
  name?: { value?: string };
  runtime?: { value?: number };
  primaryTitle?: {
    series?: {
      displayableEpisodeNumber?: {
        displayableSeason?: { season?: number };
      };
      series?: { titleText?: { text?: string } };
    };
  };
};

type ImdbVideoStrip = {
  pageInfo?: { endCursor?: string; hasNextPage?: boolean };
  edges?: { node?: ImdbVideoNode }[];
};

type ImdbGraphqlCache = "catalog" | "no-store";

const imdbGraphql = async <T>(
  operationName: string,
  query: string,
  variables: Record<string, unknown>,
  cache: ImdbGraphqlCache = "catalog",
): Promise<T> => {
  const response = await fetch(IMDB_GRAPHQL_URL, {
    method: "POST",
    headers: IMDB_HEADERS,
    body: JSON.stringify({ operationName, query, variables }),
    ...(cache === "no-store"
      ? { cache: "no-store" as const }
      : { next: { revalidate: 3600 } }),
  });

  if (!response.ok) {
    throw new Error(`imdb_graphql_${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: unknown[];
  };

  if (payload.errors?.length) {
    throw new Error("imdb_graphql_error");
  }

  if (!payload.data) {
    throw new Error("imdb_graphql_empty");
  }

  return payload.data;
};

const listImdbTrailers = async (imdbId: string): Promise<ImdbVideoNode[]> => {
  const variables = {
    const: imdbId,
    first: 50,
    filter: {
      maturityLevel: "INCLUDE_MATURE",
      nameConstraints: {},
      titleConstraints: {},
      types: ["TRAILER"],
    },
    sort: { by: "DATE", order: "DESC" },
  };

  const firstPage = await imdbGraphql<{
    title?: { videoStrip?: ImdbVideoStrip };
  }>("TitleVideoGallerySubPage", TITLE_VIDEO_GALLERY_QUERY, variables);

  const videos: ImdbVideoNode[] = [];
  let strip = firstPage.title?.videoStrip;
  if (strip?.edges) {
    for (const edge of strip.edges) {
      if (edge.node) {
        videos.push(edge.node);
      }
    }
  }

  let cursor = strip?.pageInfo?.endCursor;
  let hasNext = strip?.pageInfo?.hasNextPage ?? false;

  while (hasNext && cursor) {
    const page = await imdbGraphql<{ title?: { videoStrip?: ImdbVideoStrip } }>(
      "TitleVideoGalleryPagination",
      TITLE_VIDEO_GALLERY_PAGINATION_QUERY,
      { ...variables, after: cursor },
    );
    strip = page.title?.videoStrip;
    if (strip?.edges) {
      for (const edge of strip.edges) {
        if (edge.node) {
          videos.push(edge.node);
        }
      }
    }
    cursor = strip?.pageInfo?.endCursor;
    hasNext = strip?.pageInfo?.hasNextPage ?? false;
  }

  return videos;
};

const extractSeasonFromTitle = (title: string): number | undefined => {
  const match = title.match(/(?:season|series)\s*(\d+)/i);
  if (!match) {
    return undefined;
  }
  const season = Number.parseInt(match[1], 10);
  return Number.isFinite(season) ? season : undefined;
};

const trailerScore = (video: ImdbVideoNode): number => {
  const title = video.name?.value ?? "";
  const lower = title.toLowerCase();
  let score = 0;

  if (/\bfinal\s+trailer\b/i.test(title) && !/\bseason\b/i.test(lower)) {
    score += 100;
  }
  if (/\bofficial\s+trailer\b/i.test(title)) {
    score += 80;
  }
  if (/\bofficial\b/i.test(title) && !/\bteaser\b/i.test(lower)) {
    score += 60;
  }
  if (
    (/\btheatrical\b/i.test(lower) ||
      /\bfull\b/i.test(lower) ||
      /\bfinal\b/i.test(lower)) &&
    !/\bseason\b/i.test(lower)
  ) {
    score += 40;
  }
  if (/\bteaser\b/i.test(lower)) {
    score -= 20;
  }

  const season =
    video.primaryTitle?.series?.displayableEpisodeNumber?.displayableSeason
      ?.season ?? extractSeasonFromTitle(title);
  if (season) {
    score += season;
  }

  return score;
};

export const selectBestImdbTrailerId = (
  videos: readonly ImdbVideoNode[],
): string | null => {
  const trailers = videos.filter(
    (video) =>
      video.id &&
      video.contentType?.id === TRAILER_CONTENT_TYPE &&
      (video.runtime?.value ?? 0) > 0,
  );

  if (trailers.length === 0) {
    return null;
  }

  let best = trailers[0];
  let bestScore = trailerScore(best);
  for (let i = 1; i < trailers.length; i++) {
    const candidate = trailers[i];
    const score = trailerScore(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best?.id ?? null;
};

const definitionToQuality = (definition: string): string => {
  switch (definition) {
    case "DEF_1080p":
      return "1080p";
    case "DEF_720p":
      return "720p";
    case "DEF_480p":
      return "480p";
    case "DEF_240p":
      return "SD";
    case "DEF_AUTO":
      return "AUTO";
    default:
      return definition;
  }
};

const fetchImdbPlaybackStreams = async (
  videoId: string,
): Promise<VideasyStream[]> => {
  const data = await imdbGraphql<{
    video?: {
      playbackURLs?: {
        url?: string;
        videoDefinition?: string;
        videoMimeType?: string;
      }[];
    };
  }>("VideoPlayback", VIDEO_PLAYBACK_QUERY, { const: videoId }, "no-store");

  const playbackUrls = data.video?.playbackURLs ?? [];
  return playbackUrls
    .filter((entry) => entry.url && entry.videoMimeType)
    .map((entry) => ({
      url: entry.url as string,
      mimeType: entry.videoMimeType as string,
      quality: definitionToQuality(entry.videoDefinition ?? "AUTO"),
    }));
};

export const fetchImdbTrailerStreams = async (
  imdbId: string,
): Promise<VideasyStream[]> => {
  const videos = await listImdbTrailers(imdbId);
  const videoId = selectBestImdbTrailerId(videos);
  if (!videoId) {
    return [];
  }
  return fetchImdbPlaybackStreams(videoId);
};
