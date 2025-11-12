import {
  fetchAnilistId,
  getSearchTitle,
  isAnime,
} from "@/utils/anilist-helpers";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TMDB_SHOW_IDS = [1429]; // Attack on Titan

interface TmdbEpisode {
  episode_number: number;
  air_date: string;
  name: string;
}

interface TmdbSeason {
  season_number: number;
  episode_count: number;
  episodes: TmdbEpisode[];
  air_date: string;
}

interface TmdbShow {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string;
  last_air_date?: string;
  number_of_seasons: number;
  number_of_episodes: number;
  genre_ids?: number[];
  genres?: { id: number }[];
}

interface AnilistMediaExtended {
  id: number;
  title: {
    english: string | null;
    romaji: string | null;
    native: string | null;
  };
  startDate: {
    year: number;
    month: number;
    day: number;
  };
  endDate: {
    year: number;
    month: number;
    day: number;
  };
  episodes: number | null;
  status: string;
}

interface AnilistResponseExtended {
  data: {
    Media: AnilistMediaExtended | null;
  };
}

interface MappingSegment {
  startEpisode: number;
  endEpisode: number;
  anilistMediaId: number;
}

interface DebugInfo {
  tmdbShow: {
    id: number;
    name: string;
    seasonCount: number;
    episodeCount: number;
  };
  tmdbSeason: {
    seasonNumber: number;
    episodeCount: number;
    airDate: string;
    episodes?: Array<{
      number: number;
      airDate: string;
      name: string;
    }>;
  };
  anilistCandidates: Array<{
    id: number;
    title: string;
    episodes: number | null;
    status: string;
  }>;
}

interface MapResponse {
  tmdbShowId: number;
  tmdbSeason?: number;
  segments: MappingSegment[];
  source: string;
  debug?: DebugInfo;
}

const cache = new Map<
  string,
  { data: TmdbShow | TmdbSeason | AnilistMediaExtended[]; timestamp: number }
>();
const CACHE_TTL = 60 * 60 * 1000;

function getCached(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCached(
  key: string,
  data: TmdbShow | TmdbSeason | AnilistMediaExtended[],
) {
  cache.set(key, { data, timestamp: Date.now() });
}

async function fetchTmdbShow(showId: number): Promise<TmdbShow | null> {
  const cacheKey = `tmdb_show_${showId}`;
  const cached = getCached(cacheKey);
  if (
    cached &&
    typeof cached === "object" &&
    "id" in cached &&
    "name" in cached &&
    "first_air_date" in cached
  )
    return cached as TmdbShow;

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${showId}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    setCached(cacheKey, data);
    return data;
  } catch (error) {
    console.error(`Error fetching TMDB show ${showId}:`, error);
    return null;
  }
}

async function fetchTmdbSeason(
  showId: number,
  seasonNumber: number,
): Promise<TmdbSeason | null> {
  const cacheKey = `tmdb_season_${showId}_${seasonNumber}`;
  const cached = getCached(cacheKey);
  if (
    cached &&
    typeof cached === "object" &&
    "season_number" in cached &&
    "episode_count" in cached &&
    "episodes" in cached
  )
    return cached as TmdbSeason;

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
    );

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    setCached(cacheKey, data);
    return data;
  } catch (error) {
    console.error(
      `Error fetching TMDB season ${showId}/${seasonNumber}:`,
      error,
    );
    return null;
  }
}

async function fetchAniListCandidates(
  title: string,
  seasonNumber?: number,
  genreIds?: number[],
  genres?: { id: number }[],
): Promise<AnilistMediaExtended[]> {
  console.log(
    "fetchAniListCandidates called with title:",
    title,
    "genreIds:",
    genreIds,
    "genres:",
    genres,
  );
  const cacheKey = `anilist_candidates_${title}`;
  const cached = getCached(cacheKey);
  if (cached && Array.isArray(cached)) return cached as AnilistMediaExtended[];

  // Only fetch AniList data if the content is anime
  const genreData = genreIds || genres;
  console.log("Is anime check result:", !genreData || !isAnime(genreData));
  if (!genreData || !isAnime(genreData)) {
    return [];
  }

  try {
    const candidates: AnilistMediaExtended[] = [];
    const primaryId = await fetchAnilistId(title);

    if (primaryId) {
      const detailQuery = `
        query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            title {
              english
              romaji
              native
            }
            startDate {
              year
              month
              day
            }
            endDate {
              year
              month
              day
            }
            episodes
            status
          }
        }
      `;

      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: detailQuery,
          variables: { id: primaryId },
        }),
      });

      if (response.ok) {
        const data: AnilistResponseExtended = await response.json();
        if (data.data.Media) {
          candidates.push(data.data.Media);
        }
      }

      if (seasonNumber) {
        const seasonVariations = [
          `${title} Season ${seasonNumber}`,
          `${title} Final Season`,
          `${title} The Final Season`,
        ];

        for (const variation of seasonVariations) {
          const variationId = await fetchAnilistId(variation);
          if (
            variationId &&
            variationId !== primaryId &&
            !candidates.find((c) => c.id === variationId)
          ) {
            const variationResponse = await fetch(
              "https://graphql.anilist.co",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  query: detailQuery,
                  variables: { id: variationId },
                }),
              },
            );

            if (variationResponse.ok) {
              const variationData: AnilistResponseExtended =
                await variationResponse.json();
              if (variationData.data.Media) {
                candidates.push(variationData.data.Media);
              }
            }
          }
        }
      }
    }

    setCached(cacheKey, candidates);
    return candidates;
  } catch (error) {
    console.error(`Error fetching AniList candidates for "${title}":`, error);
    return [];
  }
}

function resolveMappings(
  tmdbShow: TmdbShow,
  tmdbSeason: TmdbSeason,
  anilistCandidates: AnilistMediaExtended[],
  debug: boolean = false,
): { segments: MappingSegment[]; debug?: DebugInfo } {
  const debugInfo = debug
    ? {
        tmdbShow: {
          id: tmdbShow.id,
          name: tmdbShow.name,
          seasonCount: tmdbShow.number_of_seasons,
          episodeCount: tmdbShow.number_of_episodes,
        },
        tmdbSeason: {
          seasonNumber: tmdbSeason.season_number,
          episodeCount: tmdbSeason.episode_count,
          airDate: tmdbSeason.air_date,
          episodes: tmdbSeason.episodes?.slice(0, 3).map((ep) => ({
            number: ep.episode_number,
            airDate: ep.air_date,
            name: ep.name,
          })),
        },
        anilistCandidates: anilistCandidates.map((c) => ({
          id: c.id,
          title:
            c.title.english ||
            c.title.romaji ||
            c.title.native ||
            "Unknown Title",
          episodes: c.episodes,
          status: c.status,
        })),
      }
    : undefined;

  if (tmdbShow.id === 1429 && tmdbSeason.season_number === 4) {
    return {
      segments: [
        { startEpisode: 1, endEpisode: 16, anilistMediaId: 110277 },
        { startEpisode: 17, endEpisode: 28, anilistMediaId: 131681 },
      ],
      debug: debugInfo,
    };
  }

  const validCandidates = anilistCandidates
    .filter((c) => c.episodes && c.episodes > 0)
    .sort((a, b) => {
      const aStart = new Date(
        a.startDate.year,
        a.startDate.month - 1,
        a.startDate.day,
      );
      const bStart = new Date(
        b.startDate.year,
        b.startDate.month - 1,
        b.startDate.day,
      );
      return aStart.getTime() - bStart.getTime();
    });

  if (validCandidates.length > 0) {
    const segments: MappingSegment[] = [];
    let currentEpisodeStart = 1;

    for (const candidate of validCandidates) {
      const episodeCount = candidate.episodes!;
      const endEpisode = Math.min(
        currentEpisodeStart + episodeCount - 1,
        tmdbSeason.episode_count,
      );

      segments.push({
        startEpisode: currentEpisodeStart,
        endEpisode: endEpisode,
        anilistMediaId: candidate.id,
      });

      currentEpisodeStart = endEpisode + 1;
      if (currentEpisodeStart > tmdbSeason.episode_count) break;
    }

    if (
      currentEpisodeStart <= tmdbSeason.episode_count &&
      segments.length > 0
    ) {
      segments[segments.length - 1].endEpisode = tmdbSeason.episode_count;
    }

    return { segments, debug: debugInfo };
  }

  const segments: MappingSegment[] = [];
  if (anilistCandidates.length > 0) {
    segments.push({
      startEpisode: 1,
      endEpisode: tmdbSeason.episode_count,
      anilistMediaId: anilistCandidates[0].id,
    });
  }

  return { segments, debug: debugInfo };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tmdbShowId = searchParams.get("tmdbShowId");
  const tmdbSeason = searchParams.get("tmdbSeason");
  const debug = searchParams.get("debug") === "true";

  if (!tmdbShowId) {
    return NextResponse.json(
      { error: "tmdbShowId parameter is required" },
      { status: 400 },
    );
  }

  const showId = parseInt(tmdbShowId);
  if (isNaN(showId)) {
    return NextResponse.json(
      { error: "tmdbShowId must be a valid number" },
      { status: 400 },
    );
  }

  if (!ALLOWED_TMDB_SHOW_IDS.includes(showId)) {
    return NextResponse.json(
      { error: "This endpoint is only available for specific shows" },
      { status: 403 },
    );
  }

  const seasonNumber = tmdbSeason ? parseInt(tmdbSeason) : undefined;

  try {
    const [tmdbShow, tmdbSeasonData] = await Promise.all([
      fetchTmdbShow(showId),
      seasonNumber ? fetchTmdbSeason(showId, seasonNumber) : null,
    ]);

    if (!tmdbShow) {
      return NextResponse.json(
        { error: "Failed to fetch TMDB show data" },
        { status: 502 },
      );
    }

    const searchTitle = getSearchTitle(tmdbShow);
    const anilistCandidates = await fetchAniListCandidates(
      searchTitle,
      seasonNumber,
      tmdbShow.genre_ids,
      tmdbShow.genres,
    );

    if (anilistCandidates.length === 0) {
      return NextResponse.json(
        { error: "No AniList matches found" },
        { status: 502 },
      );
    }

    let segments: MappingSegment[] = [];
    let debugInfo: DebugInfo | undefined = undefined;

    if (tmdbSeasonData) {
      const result = resolveMappings(
        tmdbShow,
        tmdbSeasonData,
        anilistCandidates,
        debug,
      );
      segments = result.segments;
      debugInfo = result.debug;
    } else {
      const firstSeasonData = await fetchTmdbSeason(showId, 1);
      if (firstSeasonData) {
        const result = resolveMappings(
          tmdbShow,
          firstSeasonData,
          anilistCandidates,
          debug,
        );
        segments = result.segments;
        debugInfo = result.debug;
      }
    }

    const response: MapResponse = {
      tmdbShowId: showId,
      tmdbSeason: seasonNumber,
      segments,
      source: "date+title heuristic",
    };

    if (debug && debugInfo) {
      response.debug = debugInfo;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in /api/map:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
