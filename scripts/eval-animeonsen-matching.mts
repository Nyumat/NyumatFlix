/**
 * Exploratory eval: loosened romaji matching vs MAL-based lookup for AnimeOnsen.
 * Not wired into production — run: npx tsx scripts/eval-animeonsen-matching.mts
 */
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env") });
loadEnv({ path: resolve(process.cwd(), ".env.local"), override: true });

const { scrapeFetch, cancelResponseBody } = await import(
  "../lib/scrape/fetch.ts"
);
const { findMatchingOnsenResult } = await import(
  "../lib/scrape/anime/providers/animeonsen.ts"
);

const ONSEN_AUTH = "https://auth.animeonsen.xyz/oauth/token";
const ONSEN_API = "https://api.animeonsen.xyz/v4";
const ONSEN_CLIENT_ID = "f296be26-28b5-4358-b5a1-6259575e23b7";
const ONSEN_CLIENT_SECRET =
  "349038c4157d0480784753841217270c3c5b35f4281eaee029de21cb04084235";

type OnsenSearchResult = {
  content_id?: string;
  content_title?: string;
  content_title_en?: string;
  mal_id?: number;
};

type AnilistCase = {
  label: string;
  anilistId: number;
  expectedContentId?: string;
  /** Simulated AniList titles when we want to test mismatch scenarios */
  titlesOverride?: string[];
};

const CASES: AnilistCase[] = [
  {
    label: "Hanaori-san (romaji spacing mismatch)",
    anilistId: 199066,
    expectedContentId: "a9IFFoGOQjjXpLEW",
  },
  {
    label: "Hanaori-san — romaji-only (no english)",
    anilistId: 199066,
    expectedContentId: "a9IFFoGOQjjXpLEW",
    titlesOverride: ["Hanaori-san wa Tensei Shite mo Kenka ga Shitai"],
  },
  {
    label: "Frieren",
    anilistId: 154587,
  },
  {
    label: "Hanaori-san — native-only query",
    anilistId: 199066,
    expectedContentId: "a9IFFoGOQjjXpLEW",
    titlesOverride: ["花織さんは転生しても喧嘩がしたい"],
  },
  {
    label: "Hanaori-san — wrong english (mal disambiguation test)",
    anilistId: 199066,
    expectedContentId: "a9IFFoGOQjjXpLEW",
    titlesOverride: ["Totally Wrong English Name"],
  },
  {
    label: "JJK S1",
    anilistId: 113415,
  },
  {
    label: "One Piece",
    anilistId: 21,
  },
];

// --- current matcher (baseline) ---

const normalizeTitleStrict = (title: string) =>
  title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// --- loosened romaji: collapse spaces + common particle splits ---

const normalizeTitleLoose = (title: string) =>
  normalizeTitleStrict(title)
    .replace(/\b(wa|wo|ga|ni|de|to|mo|no|te|shite|shitemo)\b/g, " ")
    .replace(/\s+/g, "")
    .trim();

const findMatchingLoose = (
  rows: OnsenSearchResult[],
  titles: string[],
): OnsenSearchResult | undefined => {
  const expectedStrict = new Set(
    titles.map(normalizeTitleStrict).filter(Boolean),
  );
  const expectedLoose = new Set(
    titles.map(normalizeTitleLoose).filter(Boolean),
  );

  return rows.find((row) => {
    const candidates = [row.content_title, row.content_title_en].filter(
      (t): t is string => Boolean(t),
    );
    return candidates.some((title) => {
      const strict = normalizeTitleStrict(title);
      const loose = normalizeTitleLoose(title);
      return expectedStrict.has(strict) || expectedLoose.has(loose);
    });
  });
};

// --- MAL helpers ---

const fetchAnilistMeta = async (
  anilistId: number,
): Promise<{ titles: string[]; idMal: number | null }> => {
  const response = await scrapeFetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query { Media(id: ${anilistId}) { title { romaji english native } idMal } }`,
    }),
  });
  if (!response.ok) {
    await cancelResponseBody(response);
    return { titles: [], idMal: null };
  }
  const payload = (await response.json()) as {
    data?: {
      Media?: {
        title?: {
          romaji?: string | null;
          english?: string | null;
          native?: string | null;
        };
        idMal?: number | null;
      };
    };
  };
  const media = payload.data?.Media;
  const titles = [
    media?.title?.english?.trim(),
    media?.title?.romaji?.trim(),
    media?.title?.native?.trim(),
  ].filter((t): t is string => Boolean(t));
  return {
    titles: [...new Set(titles)],
    idMal: media?.idMal ?? null,
  };
};

let cachedToken: string | null = null;

const getToken = async (): Promise<string | null> => {
  if (cachedToken) return cachedToken;
  const body = new URLSearchParams({
    client_id: ONSEN_CLIENT_ID,
    client_secret: ONSEN_CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  const response = await scrapeFetch(ONSEN_AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }
  const payload = (await response.json()) as { access_token?: string };
  cachedToken = payload.access_token ?? null;
  return cachedToken;
};

const authHeaders = async () => {
  const token = await getToken();
  if (!token) throw new Error("no token");
  return {
    Authorization: `Bearer ${token}`,
    Referer: "https://www.animeonsen.xyz/",
  };
};

const onsenSearch = async (query: string): Promise<OnsenSearchResult[]> => {
  const headers = await authHeaders();
  const response = await scrapeFetch(
    `${ONSEN_API}/search/${encodeURIComponent(query)}`,
    { headers },
  );
  if (!response.ok) {
    await cancelResponseBody(response);
    return [];
  }
  const payload = (await response.json()) as {
    result?: OnsenSearchResult[];
    data?: OnsenSearchResult[];
  };
  return payload.result ?? payload.data ?? [];
};

const fetchVideoMalId = async (
  contentId: string,
  episode = 1,
): Promise<number | null> => {
  const headers = await authHeaders();
  const response = await scrapeFetch(
    `${ONSEN_API}/content/${contentId}/video/${episode}`,
    { headers },
  );
  if (!response.ok) {
    await cancelResponseBody(response);
    return null;
  }
  const payload = (await response.json()) as {
    metadata?: { mal_id?: number };
  };
  return payload.metadata?.mal_id ?? null;
};

/** MAL strategy A: search API with mal id as query */
const resolveByMalSearch = async (
  idMal: number,
  titles: string[],
): Promise<{ contentId: string | null; method: string; detail: string }> => {
  const queries = [
    String(idMal),
    `mal:${idMal}`,
    `mal ${idMal}`,
    `myanimelist ${idMal}`,
  ];

  for (const query of queries) {
    const rows = await onsenSearch(query);
    if (rows.length === 0) continue;

    // If search returns rows, verify mal_id via video metadata (search rows lack mal_id)
    for (const row of rows.slice(0, 5)) {
      if (!row.content_id) continue;
      const mal = await fetchVideoMalId(row.content_id);
      if (mal === idMal) {
        return {
          contentId: row.content_id,
          method: "mal-search-verify",
          detail: `query="${query}" → ${row.content_id} (mal verified)`,
        };
      }
    }

    // Fallback: title match on MAL search results
    const titleMatch =
      findMatchingOnsenResult(rows, titles) ?? findMatchingLoose(rows, titles);
    if (titleMatch?.content_id) {
      const mal = await fetchVideoMalId(titleMatch.content_id);
      return {
        contentId: titleMatch.content_id,
        method: "mal-search-title-fallback",
        detail: `query="${query}" title match, mal=${mal ?? "?"}`,
      };
    }
  }

  return {
    contentId: null,
    method: "mal-search",
    detail: "no MAL query worked",
  };
};

/** MAL strategy B: title search → verify mal_id on candidates */
const MAL_VERIFY_CANDIDATE_CAP = 15;

const resolveByTitleThenMalVerify = async (
  idMal: number,
  titles: string[],
): Promise<{
  contentId: string | null;
  method: string;
  detail: string;
  videoLookups: number;
}> => {
  const seen = new Set<string>();
  let videoLookups = 0;

  for (const query of titles) {
    const rows = await onsenSearch(query);
    for (const row of rows.slice(0, MAL_VERIFY_CANDIDATE_CAP)) {
      if (!row.content_id || seen.has(row.content_id)) continue;
      seen.add(row.content_id);

      videoLookups++;
      const mal = await fetchVideoMalId(row.content_id);
      if (mal === idMal) {
        return {
          contentId: row.content_id,
          method: "title-search-mal-verify",
          detail: `query="${query}" → ${row.content_id} (${videoLookups} video lookups)`,
          videoLookups,
        };
      }
    }
  }

  return {
    contentId: null,
    method: "title-search-mal-verify",
    detail: `no candidate matched mal_id (${videoLookups} video lookups)`,
    videoLookups,
  };
};

/** MAL strategy C: direct content endpoints */
const resolveByMalDirect = async (
  idMal: number,
): Promise<{ contentId: string | null; method: string; detail: string }> => {
  const paths = [
    `${ONSEN_API}/content/mal/${idMal}`,
    `${ONSEN_API}/mal/${idMal}`,
    `${ONSEN_API}/content/${idMal}`,
    `${ONSEN_API}/search/mal/${idMal}`,
  ];

  for (const path of paths) {
    const headers = await authHeaders();
    const response = await scrapeFetch(path, { headers });
    if (!response.ok) {
      await cancelResponseBody(response);
      continue;
    }
    const text = await response.text();
    try {
      const json = JSON.parse(text) as {
        content_id?: string;
        metadata?: { content_id?: string };
      };
      const id = json.content_id ?? json.metadata?.content_id ?? null;
      if (id) {
        return { contentId: id, method: "mal-direct", detail: path };
      }
    } catch {
      void 0;
    }
  }

  return {
    contentId: null,
    method: "mal-direct",
    detail: "all direct paths 404",
  };
};

type StrategyResult = {
  contentId: string | null;
  method: string;
  detail: string;
};

const resolveStrict = async (
  titles: string[],
): Promise<StrategyResult & { searchHits: number }> => {
  for (const query of titles) {
    const rows = await onsenSearch(query);
    const match = findMatchingOnsenResult(rows, titles);
    if (match?.content_id) {
      return {
        contentId: match.content_id,
        method: "strict-title",
        detail: `query="${query}"`,
        searchHits: rows.length,
      };
    }
  }
  return {
    contentId: null,
    method: "strict-title",
    detail: "no exact title match",
    searchHits: 0,
  };
};

const resolveLoose = async (
  titles: string[],
): Promise<StrategyResult & { searchHits: number }> => {
  for (const query of titles) {
    const rows = await onsenSearch(query);
    const match = findMatchingLoose(rows, titles);
    if (match?.content_id) {
      return {
        contentId: match.content_id,
        method: "loose-romaji",
        detail: `query="${query}"`,
        searchHits: rows.length,
      };
    }
  }
  return {
    contentId: null,
    method: "loose-romaji",
    detail: "no loose match",
    searchHits: 0,
  };
};

console.log("AnimeOnsen matching strategy eval\n");

let strictWins = 0;
let looseFixes = 0;
let malOnlyFixes = 0;
let malAlsoFixes = 0;

for (const testCase of CASES) {
  const meta = await fetchAnilistMeta(testCase.anilistId);
  const titles = testCase.titlesOverride ?? meta.titles;

  console.log(
    `\n=== ${testCase.label} (anilist ${testCase.anilistId}, mal ${meta.idMal ?? "?"}) ===`,
  );
  console.log(`Titles: ${titles.join(" | ")}`);

  const strict = await resolveStrict(titles);
  const loose = await resolveLoose(titles);
  const malDirect = meta.idMal ? await resolveByMalDirect(meta.idMal) : null;
  const malSearch = meta.idMal
    ? await resolveByMalSearch(meta.idMal, titles)
    : null;
  const malVerify = meta.idMal
    ? await resolveByTitleThenMalVerify(meta.idMal, titles)
    : null;

  const results = [
    ["strict", strict],
    ["loose", loose],
    ["mal-direct", malDirect],
    ["mal-search", malSearch],
    ["mal-verify", malVerify],
  ] as const;

  for (const [name, r] of results) {
    if (!r) {
      console.log(`  ${name.padEnd(12)} — (skipped, no idMal)`);
      continue;
    }
    const ok = r.contentId ? "✓" : "✗";
    const expect =
      testCase.expectedContentId && r.contentId === testCase.expectedContentId
        ? " [expected]"
        : testCase.expectedContentId && r.contentId
          ? " [WRONG ID]"
          : "";
    console.log(
      `  ${name.padEnd(12)} ${ok} ${r.contentId ?? "—"}  (${r.detail})${expect}`,
    );
  }

  const strictOk = Boolean(strict.contentId);
  const looseOk = Boolean(loose.contentId);
  const malOk = Boolean(
    malDirect?.contentId || malSearch?.contentId || malVerify?.contentId,
  );

  if (strictOk) strictWins++;
  if (!strictOk && looseOk) looseFixes++;
  if (!strictOk && !looseOk && malOk) malOnlyFixes++;
  if (!strictOk && looseOk && malOk) malAlsoFixes++;
}

console.log("\n--- Summary ---");
console.log(`Cases: ${CASES.length}`);
console.log(`Strict already works: ${strictWins}`);
console.log(`Loose fixes strict miss: ${looseFixes}`);
console.log(`MAL-verify fixes when strict+loose both miss: ${malOnlyFixes}`);
console.log(
  `MAL-verify also succeeds when loose already works: ${malAlsoFixes}`,
);
console.log(`MAL search/direct endpoints: never worked in this eval`);
