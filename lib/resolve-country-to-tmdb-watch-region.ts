import { continents } from "country-data-list";
import { TMDB_WATCH_REGION_ISO } from "@/lib/tmdb-watch-region-codes";

const DEFAULT_REGION = "US";

const CONTINENT_TO_TMDB_PROXY: Record<
  | "asia"
  | "africa"
  | "europe"
  | "northAmerica"
  | "southAmerica"
  | "oceania"
  | "antartica",
  string
> = {
  asia: "SG",
  africa: "ZA",
  europe: "DE",
  northAmerica: "US",
  southAmerica: "BR",
  oceania: "AU",
  antartica: "US",
};

const NEIGHBOR_FALLBACK: Record<string, string> = {
  CN: "HK",
  KP: "KR",
  MO: "HK",
  PR: "US",
  GU: "US",
  VI: "US",
  AS: "US",
  UM: "US",
  MP: "US",
  IR: "AE",
  AF: "IN",
  BD: "IN",
  NP: "IN",
  BT: "IN",
  LK: "IN",
  MM: "TH",
  KH: "TH",
  LA: "TH",
  VN: "TH",
  GE: "TR",
  AM: "TR",
  TJ: "RU",
  TM: "RU",
  UZ: "RU",
  KG: "RU",
  KZ: "RU",
  MN: "RU",
  PM: "FR",
  RE: "FR",
  YT: "FR",
  MQ: "FR",
  NC: "FR",
  WF: "FR",
  BL: "FR",
  MF: "FR",
  FK: "AR",
  SR: "BR",
  GW: "SN",
  SB: "AU",
  SY: "AE",
};

const CONTINENT_KEYS = [
  "asia",
  "africa",
  "northAmerica",
  "southAmerica",
  "antartica",
  "europe",
  "oceania",
] as const;

const findContinentKey = (
  alpha2: string,
): keyof typeof CONTINENT_TO_TMDB_PROXY | null => {
  for (const key of CONTINENT_KEYS) {
    const entry = continents[key];
    if (entry?.countries?.includes(alpha2)) {
      return key;
    }
  }
  return null;
};

export const resolveCountryCodeToTmdbWatchRegion = (raw: string): string => {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return DEFAULT_REGION;
  if (code === "XX" || code === "ZZ") return DEFAULT_REGION;
  if (TMDB_WATCH_REGION_ISO.has(code)) return code;

  const neighbor = NEIGHBOR_FALLBACK[code];
  if (neighbor && TMDB_WATCH_REGION_ISO.has(neighbor)) {
    return neighbor;
  }

  const continentKey = findContinentKey(code);
  if (continentKey) {
    const proxy = CONTINENT_TO_TMDB_PROXY[continentKey];
    if (TMDB_WATCH_REGION_ISO.has(proxy)) {
      return proxy;
    }
  }

  return DEFAULT_REGION;
};

export const readGeoCountryCodeFromHeaders = (
  headers: Headers,
): string | null => {
  const candidates = [
    headers.get("x-vercel-ip-country"),
    headers.get("cf-ipcountry"),
    headers.get("cloudfront-viewer-country"),
  ];
  for (const v of candidates) {
    if (v && v.trim().length >= 2) {
      return v.trim().slice(0, 2);
    }
  }
  return null;
};
