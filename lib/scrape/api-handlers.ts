import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ANIME_SCRAPE_PROVIDER_LABELS,
  ANIME_SCRAPE_PROVIDER_ORDER,
  TMDB_SCRAPE_PROVIDER_LABELS,
  TMDB_SCRAPE_PROVIDER_ORDER,
  type AnimeScrapeProviderId,
  type TmdbScrapeProviderId,
} from "@/lib/providers/registry";
import {
  scrapeAllAnimeProviders,
  scrapeAnimeProvider,
} from "@/lib/scrape/anime";
import { scrapeProvider } from "@/lib/scrape";
import {
  buildScrapePlayUrl,
  type ScrapePlaybackToken,
} from "@/lib/scrape/playback";
import {
  isMegaplayPlaybackRefresh,
  isVidsrcPlaybackRefresh,
  isVixsrcPlaybackRefresh,
} from "@/lib/scrape/playback-refresh";
import { primeVidKingSession } from "@/lib/scrape/vidking-playback";
import { primeVixsrcSession } from "@/lib/scrape/vixsrc-playback";
import { isVidnestClientOnlyCdn } from "@/lib/scrape/vidnest-shared";
import {
  filterAnimeScrapeProviderIds,
  filterTmdbScrapeProviderIds,
  getSiteFlags,
  isAnimeScrapeProviderEnabled,
  isTmdbScrapeProviderEnabled,
} from "@/lib/flags/site-flags";
import { inferScrapeStreamKind } from "@/lib/scrape/stream-kind";

const tmdbProviderIds = TMDB_SCRAPE_PROVIDER_ORDER as unknown as [
  TmdbScrapeProviderId,
  ...TmdbScrapeProviderId[],
];

const animeProviderIds = ANIME_SCRAPE_PROVIDER_ORDER as unknown as [
  AnimeScrapeProviderId,
  ...AnimeScrapeProviderId[],
];

const tmdbScrapeBodySchema = z.object({
  mediaKind: z.literal("tmdb").optional(),
  providerId: z.enum(tmdbProviderIds),
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.number().int().positive(),
  seasonNumber: z.number().int().positive().optional(),
  episodeNumber: z.number().int().positive().optional(),
});

const legacyTmdbScrapeBodySchema = z.object({
  providerId: z.enum(tmdbProviderIds),
  mediaType: z.enum(["movie", "tv"]),
  tmdbId: z.number().int().positive(),
  seasonNumber: z.number().int().positive().optional(),
  episodeNumber: z.number().int().positive().optional(),
});

const animeScrapeBodySchema = z.object({
  mediaKind: z.literal("anime"),
  providerId: z.enum(animeProviderIds).optional(),
  anilistId: z.number().int().positive(),
  episodeNumber: z.number().int().positive(),
  translationType: z.enum(["sub", "dub"]).optional(),
  query: z.string().min(1).optional(),
  tryAll: z.boolean().optional(),
});

const legacyAnimeScrapeBodySchema = z.object({
  providerId: z.enum(animeProviderIds).optional(),
  anilistId: z.number().int().positive(),
  episodeNumber: z.number().int().positive(),
  translationType: z.enum(["sub", "dub"]).optional(),
  query: z.string().min(1).optional(),
  tryAll: z.boolean().optional(),
});

const unifiedScrapeBodySchema = z.discriminatedUnion("mediaKind", [
  animeScrapeBodySchema,
  tmdbScrapeBodySchema.extend({ mediaKind: z.literal("tmdb") }),
]);

type ParsedScrapeBody =
  | z.infer<typeof tmdbScrapeBodySchema>
  | z.infer<typeof animeScrapeBodySchema>;

const parseScrapeBody = (body: unknown): ParsedScrapeBody | null => {
  const unified = unifiedScrapeBodySchema.safeParse(body);
  if (unified.success) {
    return unified.data;
  }

  const legacyAnime = legacyAnimeScrapeBodySchema.safeParse(body);
  if (legacyAnime.success) {
    return { mediaKind: "anime", ...legacyAnime.data };
  }

  const legacyTmdb = legacyTmdbScrapeBodySchema.safeParse(body);
  if (legacyTmdb.success) {
    return { mediaKind: "tmdb", ...legacyTmdb.data };
  }

  const tmdbWithOptionalKind = tmdbScrapeBodySchema.safeParse(body);
  if (tmdbWithOptionalKind.success) {
    return { mediaKind: "tmdb", ...tmdbWithOptionalKind.data };
  }

  return null;
};

export async function handleScrapePost(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseScrapeBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid scrape request" },
      { status: 400 },
    );
  }

  if (parsed.mediaKind === "anime") {
    return handleAnimeScrapePost(parsed);
  }

  return handleTmdbScrapePost(parsed);
}

async function handleTmdbScrapePost(
  input: z.infer<typeof tmdbScrapeBodySchema> & { mediaKind?: "tmdb" },
) {
  const flags = await getSiteFlags();
  if (!isTmdbScrapeProviderEnabled(flags, input.providerId)) {
    return NextResponse.json(
      {
        ok: false,
        mediaKind: "tmdb",
        providerId: input.providerId,
        providerName:
          TMDB_SCRAPE_PROVIDER_LABELS[input.providerId as TmdbScrapeProviderId],
        error: "Provider disabled by site policy",
      },
      { status: 403 },
    );
  }

  const result = await scrapeProvider(input.providerId, {
    mediaType: input.mediaType,
    tmdbId: input.tmdbId,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      mediaKind: "tmdb",
      providerId: result.providerId,
      providerName:
        TMDB_SCRAPE_PROVIDER_LABELS[result.providerId as TmdbScrapeProviderId],
      error: result.error,
    });
  }

  const playbackToken: ScrapePlaybackToken = {
    url: result.streamUrl,
    referer: result.referer,
    ...(result.providerId === "vidking"
      ? {
          refresh: {
            providerId: "vidking" as const,
            mediaType: input.mediaType,
            tmdbId: input.tmdbId,
            seasonNumber: input.seasonNumber,
            episodeNumber: input.episodeNumber,
            seedFetchedAt: Date.now(),
          },
        }
      : isVidsrcPlaybackRefresh(result.playbackRefresh)
        ? { refresh: result.playbackRefresh }
        : isVixsrcPlaybackRefresh(result.playbackRefresh)
          ? { refresh: result.playbackRefresh }
          : {}),
  };

  if (playbackToken.refresh?.providerId === "vidking") {
    primeVidKingSession(
      playbackToken.refresh,
      result.streamUrl,
      result.referer,
    );
  }

  if (playbackToken.refresh?.providerId === "vixsrc") {
    primeVixsrcSession(playbackToken.refresh, result.streamUrl);
  }

  const playUrl = isVidnestClientOnlyCdn(result.streamUrl)
    ? result.streamUrl
    : buildScrapePlayUrl(playbackToken);
  const streamKind = inferScrapeStreamKind(result.streamUrl);

  return NextResponse.json({
    ok: true,
    mediaKind: "tmdb",
    providerId: result.providerId,
    providerName:
      TMDB_SCRAPE_PROVIDER_LABELS[result.providerId as TmdbScrapeProviderId],
    playUrl,
    streamKind,
    referer: result.referer,
    subtitles: result.subtitles,
    qualities: result.qualities,
    audioVersions: result.audioVersions,
    preferredAudioLang: result.preferredAudioLang,
  });
}

async function handleAnimeScrapePost(
  input: z.infer<typeof animeScrapeBodySchema>,
) {
  const flags = await getSiteFlags();
  if (
    input.providerId &&
    !isAnimeScrapeProviderEnabled(flags, input.providerId)
  ) {
    return NextResponse.json(
      {
        ok: false,
        mediaKind: "anime",
        providerId: input.providerId,
        providerName:
          ANIME_SCRAPE_PROVIDER_LABELS[
            input.providerId as AnimeScrapeProviderId
          ],
        error: "Provider disabled by site policy",
      },
      { status: 403 },
    );
  }

  const scrapeInput = {
    anilistId: input.anilistId,
    episodeNumber: input.episodeNumber,
    translationType: input.translationType,
    query: input.query,
  };

  const result = input.tryAll
    ? await scrapeAllAnimeProviders(scrapeInput)
    : input.providerId
      ? await scrapeAnimeProvider(input.providerId, scrapeInput)
      : await scrapeAllAnimeProviders(scrapeInput);

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      mediaKind: "anime",
      providerId: result.providerId,
      providerName: ANIME_SCRAPE_PROVIDER_LABELS[result.providerId],
      error: result.error,
      ...(result.unavailable ? { unavailable: true } : {}),
    });
  }

  const playbackToken: ScrapePlaybackToken = {
    url: result.streamUrl,
    referer: result.referer,
    ...(isMegaplayPlaybackRefresh(result.playbackRefresh)
      ? { refresh: result.playbackRefresh }
      : {}),
    ...(result.cookies ? { cookies: result.cookies } : {}),
  };

  const playUrl = buildScrapePlayUrl(playbackToken);

  return NextResponse.json({
    ok: true,
    mediaKind: "anime",
    providerId: result.providerId,
    providerName: ANIME_SCRAPE_PROVIDER_LABELS[result.providerId],
    streamKind: result.streamKind,
    playUrl,
    referer: result.referer,
    subtitles: result.subtitles,
    qualities: result.qualities,
    audioVersions: result.audioVersions,
    defaultAudioLang: result.defaultAudioLang,
    defaultHardSubLang: result.defaultHardSubLang,
    preferredAudioLang: result.preferredAudioLang,
    fallbackFrom: result.fallbackFrom,
  });
}

export async function handleScrapeGet() {
  const flags = await getSiteFlags();
  const tmdbIds = filterTmdbScrapeProviderIds(
    flags,
    TMDB_SCRAPE_PROVIDER_ORDER,
  );
  const animeIds = filterAnimeScrapeProviderIds(
    flags,
    ANIME_SCRAPE_PROVIDER_ORDER,
  );

  return NextResponse.json({
    providers: {
      tmdb: tmdbIds.map((providerId) => ({
        id: providerId,
        name: TMDB_SCRAPE_PROVIDER_LABELS[providerId as TmdbScrapeProviderId],
      })),
      anime: animeIds.map((providerId) => ({
        id: providerId,
        name: ANIME_SCRAPE_PROVIDER_LABELS[providerId as AnimeScrapeProviderId],
      })),
    },
  });
}

export async function handleAnimeScrapeGet() {
  const flags = await getSiteFlags();
  const animeIds = filterAnimeScrapeProviderIds(
    flags,
    ANIME_SCRAPE_PROVIDER_ORDER,
  );

  const payload: {
    providers: Array<{ id: AnimeScrapeProviderId; name: string }>;
    testLinks?: Record<string, unknown>;
  } = {
    providers: animeIds.map((providerId) => ({
      id: providerId as AnimeScrapeProviderId,
      name: ANIME_SCRAPE_PROVIDER_LABELS[providerId as AnimeScrapeProviderId],
    })),
  };

  if (process.env.NODE_ENV === "development") {
    payload.testLinks = {
      onePiece: {
        anilistId: 21,
        tmdbTvId: 37854,
        nyumatflix: "http://localhost:3000/tvshows/37854",
        episode1Api: {
          providerId: "kickassanime",
          anilistId: 21,
          episodeNumber: 1,
        },
      },
      frieren: {
        anilistId: 101922,
        tmdbTvId: 85937,
        nyumatflix: "http://localhost:3000/tvshows/85937",
        episode1Api: {
          providerId: "anizone",
          anilistId: 101922,
          episodeNumber: 1,
        },
      },
      naruto: {
        anilistId: 20,
        nyumatflixApiQuery: {
          providerId: "animestream",
          anilistId: 20,
          episodeNumber: 1,
          query: "Naruto",
        },
      },
    };
  }

  return NextResponse.json(payload);
}
