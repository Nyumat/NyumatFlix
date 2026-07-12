export const VIDEO_SERVER_HEALTH_TIMEOUT_MS = 4_000;

const ALLOWED_VIDEO_SERVER_HOSTS = new Set([
  "vsembed.ru",
  "vidsrc.wtf",
  "multiembed.mov",
  "www.2embed.cc",
  "111movies.com",
  "vidnest.fun",
  "vidfast.pro",
  "player.videasy.net",
  "www.vidking.net",
  "vixsrc.to",
  "vidlink.pro",
  "www.vidcore.org",
  "1embed.cc",
  "vidlux.xyz",
]);

const VIDNEST_RESOLVERS = [
  "movies5f",
  "hollymoviehd",
  "videasy",
  "klikxxi",
  "moviesapi",
] as const;

export type VideoServerHealthState = "available" | "unavailable" | "unknown";

export type VideoServerHealthResult = {
  available: boolean;
  state: VideoServerHealthState;
  status: number | null;
  method: "GET";
  evidence:
    | "http-status"
    | "nested-player"
    | "resolver"
    | "opaque-player"
    | "network";
};

export function isAllowedVideoServerUrl(value: string): boolean {
  if (value.length > 2_048) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      ALLOWED_VIDEO_SERVER_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
}

function result(
  state: VideoServerHealthState,
  status: number | null,
  evidence: VideoServerHealthResult["evidence"],
): VideoServerHealthResult {
  return {
    available: state === "available",
    state,
    status,
    method: "GET",
    evidence,
  };
}

async function fetchBounded(
  url: string,
  headers?: HeadersInit,
  signal?: AbortSignal,
): Promise<Response> {
  const timeoutSignal = AbortSignal.timeout(VIDEO_SERVER_HEALTH_TIMEOUT_MS);
  return fetch(url, {
    method: "GET",
    headers,
    redirect: "follow",
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
    cache: "no-store",
  });
}

function parseVidnestPath(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] === "movie" && /^\d+$/.test(parts[1] ?? "")) {
    return `movie/${parts[1]}`;
  }
  if (
    parts[0] === "tv" &&
    parts.length === 4 &&
    parts.slice(1, 4).every((part) => /^\d+$/.test(part ?? ""))
  ) {
    return `tv/${parts[1]}/${parts[2]}/${parts[3]}`;
  }
  if (
    parts[0] === "anime" &&
    parts.length === 4 &&
    /^\d+$/.test(parts[1] ?? "") &&
    /^\d+$/.test(parts[2] ?? "") &&
    (parts[3] === "sub" || parts[3] === "dub")
  ) {
    return `anime/${parts[1]}/${parts[2]}/${parts[3]}`;
  }
  return null;
}

async function checkVidnest(
  url: URL,
  signal?: AbortSignal,
): Promise<VideoServerHealthResult> {
  const mediaPath = parseVidnestPath(url);
  if (!mediaPath) return result("unknown", null, "opaque-player");

  const resolvers = mediaPath.startsWith("anime/")
    ? (["hianime"] as const)
    : VIDNEST_RESOLVERS;
  const attempts = await Promise.allSettled(
    resolvers.map(async (resolver) => {
      const response = await fetchBounded(
        `https://new.vidnest.fun/${resolver}/${mediaPath}`,
        {
          Accept: "application/json",
          Referer: "https://vidnest.fun/",
        },
        signal,
      );

      if (!response.ok) {
        await response.body?.cancel();
        return { resolved: false, status: response.status };
      }

      const body = (await response.json()) as unknown;
      const resolved =
        typeof body === "object" &&
        body !== null &&
        "data" in body &&
        typeof body.data === "string" &&
        body.data.length > 0;
      return { resolved, status: response.status };
    }),
  );

  const responses = attempts.flatMap((attempt) =>
    attempt.status === "fulfilled" ? [attempt.value] : [],
  );
  const successful = responses.find(({ resolved }) => resolved);
  if (successful) return result("available", successful.status, "resolver");
  if (responses.length > 0) {
    return result("unavailable", responses[0].status, "resolver");
  }
  return result("unknown", null, "network");
}

async function checkHttpStatus(
  url: string,
  signal?: AbortSignal,
): Promise<VideoServerHealthResult> {
  try {
    const response = await fetchBounded(
      url,
      {
        Accept: "text/html,application/xhtml+xml",
        Range: "bytes=0-4095",
      },
      signal,
    );
    const status = response.status;
    await response.body?.cancel();

    if (status >= 200 && status < 400) {
      return result("available", status, "http-status");
    }
    return result("unavailable", status, "http-status");
  } catch {
    return result("unknown", null, "network");
  }
}

function extract2EmbedPlayerUrl(html: string): URL | null {
  const match = html.match(/data-src=["']([^"']+)["']/i);
  if (!match?.[1]) return null;

  try {
    const url = new URL(match[1], "https://www.2embed.cc/");
    return url.protocol === "https:" && url.hostname === "streamsrcs.2embed.cc"
      ? url
      : null;
  } catch {
    return null;
  }
}

async function check2Embed(
  value: string,
  signal?: AbortSignal,
): Promise<VideoServerHealthResult> {
  try {
    const shell = await fetchBounded(
      value,
      {
        Accept: "text/html,application/xhtml+xml",
      },
      signal,
    );
    if (!shell.ok) {
      await shell.body?.cancel();
      return result("unavailable", shell.status, "nested-player");
    }

    const playerUrl = extract2EmbedPlayerUrl(await shell.text());
    if (!playerUrl) return result("unavailable", shell.status, "nested-player");

    const player = await fetchBounded(
      playerUrl.href,
      {
        Accept: "text/html,application/xhtml+xml",
        Referer: "https://www.2embed.cc/",
      },
      signal,
    );
    if (!player.ok) {
      await player.body?.cancel();
      return result("unavailable", player.status, "nested-player");
    }

    const playerHtml = await player.text();
    const nestedMatch = playerHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (!nestedMatch?.[1]) {
      return result("unavailable", player.status, "nested-player");
    }

    const nestedUrl = new URL(nestedMatch[1], player.url || playerUrl.href);
    if (
      nestedUrl.protocol !== "https:" ||
      nestedUrl.hostname !== "streamsrcs.2embed.cc"
    ) {
      return result("unavailable", player.status, "nested-player");
    }

    const nested = await fetchBounded(
      nestedUrl.href,
      {
        Accept: "text/html,application/xhtml+xml",
        Referer: playerUrl.href,
      },
      signal,
    );
    const finalUrl = new URL(nested.url || nestedUrl.href);
    const available =
      nested.ok &&
      finalUrl.hostname === "streamsrcs.2embed.cc" &&
      finalUrl.pathname !== "/";
    await nested.body?.cancel();
    return result(
      available ? "available" : "unavailable",
      nested.status,
      "nested-player",
    );
  } catch {
    return result("unknown", null, "network");
  }
}

export async function checkVideoServerUrl(
  value: string,
  signal?: AbortSignal,
): Promise<VideoServerHealthResult> {
  const url = new URL(value);

  if (url.hostname === "vidnest.fun") return checkVidnest(url, signal);
  if (url.hostname === "www.2embed.cc") return check2Embed(value, signal);
  if (url.hostname === "vsembed.ru" || url.hostname === "player.videasy.net") {
    return checkHttpStatus(value, signal);
  }

  return result("unknown", null, "opaque-player");
}
