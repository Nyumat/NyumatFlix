import type { LiveChannel } from "@/lib/live/types";

const LIVE_BASE_URL = "https://nyumatflix.com/live";

export const slugifyChannelName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "");

const INPUT_ALIASES: Record<string, string> = {
  cn: "cartoonnetwork",
  cartoonnetwork: "cartoonnetwork",
  cnn: "cnn",
  espn: "espn",
  espn2: "espn2",
  fox: "fox",
  foxnews: "foxnews",
  mtv: "mtv",
  tnt: "tnt",
  tbs: "tbs",
  hbo: "hbo",
  nick: "nickelodeon",
  nickelodeon: "nickelodeon",
  disney: "disneychannel",
  disneychannel: "disneychannel",
  abc: "abc",
  nbc: "nbc",
  cbs: "cbs",
  fx: "fx",
  amc: "amc",
  usa: "usanetwork",
  usanetwork: "usanetwork",
  bravo: "bravo",
  natgeo: "nationalgeographic",
  nationalgeographic: "nationalgeographic",
  discovery: "discoverychannel",
  discoverychannel: "discoverychannel",
  history: "historychannel",
  historychannel: "historychannel",
  food: "foodnetwork",
  foodnetwork: "foodnetwork",
  hgtv: "hgtv",
  tlc: "tlc",
  bet: "bet",
  cc: "comedycentral",
  comedycentral: "comedycentral",
  comedy: "comedycentral",
  bbc: "bbc",
  msnbc: "msnbc",
  nfl: "nflnetwork",
  nflnetwork: "nflnetwork",
  nba: "nbatv",
  nbatv: "nbatv",
  golf: "golfchannel",
  golfchannel: "golfchannel",
  animexhidive: "animexhidive",
  hidive: "animexhidive",
};

const SHARE_SLUGS: Record<string, string> = {
  cartoonnetwork: "cn",
  nickelodeon: "nick",
  disneychannel: "disney",
  nationalgeographic: "natgeo",
  comedycentral: "cc",
  usanetwork: "usa",
  discoverychannel: "discovery",
  historychannel: "history",
  foodnetwork: "food",
  nflnetwork: "nfl",
  nbatv: "nba",
  golfchannel: "golf",
  animexhidive: "hidive",
};

const DISPLAY_NAMES: Record<string, string> = {
  cartoonnetwork: "Cartoon Network",
  cnn: "CNN",
  espn: "ESPN",
  espn2: "ESPN 2",
  fox: "Fox",
  foxnews: "Fox News",
  mtv: "MTV",
  tnt: "TNT",
  tbs: "TBS",
  hbo: "HBO",
  nickelodeon: "Nickelodeon",
  disneychannel: "Disney Channel",
  abc: "ABC",
  nbc: "NBC",
  cbs: "CBS",
  fx: "FX",
  amc: "AMC",
  usanetwork: "USA Network",
  bravo: "Bravo",
  nationalgeographic: "National Geographic",
  discoverychannel: "Discovery Channel",
  historychannel: "History Channel",
  foodnetwork: "Food Network",
  hgtv: "HGTV",
  tlc: "TLC",
  bet: "BET",
  comedycentral: "Comedy Central",
  bbc: "BBC",
  msnbc: "MSNBC",
  nflnetwork: "NFL Network",
  nbatv: "NBA TV",
  golfchannel: "Golf Channel",
  animexhidive: "ANIME x HIDIVE",
};

const normalizeSlugInput = (slug: string) => slugifyChannelName(slug.trim());

const toCanonicalSlug = (slug: string) => {
  const normalized = normalizeSlugInput(slug);
  return INPUT_ALIASES[normalized] ?? normalized;
};

export const formatChannelSlugForDisplay = (slug: string) => {
  const canonical = toCanonicalSlug(slug);

  if (DISPLAY_NAMES[canonical]) {
    return DISPLAY_NAMES[canonical];
  }

  if (canonical.length <= 4) {
    return canonical.toUpperCase();
  }

  return canonical.charAt(0).toUpperCase() + canonical.slice(1);
};

export const buildLiveShareUrlFromSlug = (slug: string) => {
  const canonical = toCanonicalSlug(slug);
  const shareSlug = SHARE_SLUGS[canonical] ?? normalizeSlugInput(slug);
  return `${LIVE_BASE_URL}?ch=${encodeURIComponent(shareSlug)}`;
};

const channelSlug = (channel: LiveChannel) => slugifyChannelName(channel.name);

const matchScore = (canonical: string, channel: LiveChannel) => {
  const slug = channelSlug(channel);

  if (slug === canonical) {
    return 100;
  }

  if (slug.startsWith(canonical) || canonical.startsWith(slug)) {
    return 70 - Math.abs(slug.length - canonical.length);
  }

  const normalizedName = channel.name.toLowerCase();

  if (normalizedName.includes(canonical)) {
    return 40;
  }

  if (channel.searchText.includes(canonical)) {
    return 20;
  }

  return 0;
};

export const getChannelShareSlug = (channel: LiveChannel) => {
  const canonical = channelSlug(channel);
  return SHARE_SLUGS[canonical] ?? canonical;
};

export const buildLiveChannelShareUrl = (channel: LiveChannel) => {
  const slug = getChannelShareSlug(channel);
  return `${LIVE_BASE_URL}?ch=${encodeURIComponent(slug)}`;
};

export const resolveChannelFromSlug = (
  slug: string,
  channels: LiveChannel[],
): LiveChannel | null => {
  const canonical = toCanonicalSlug(slug);

  if (!canonical) {
    return null;
  }

  const matches = channels
    .filter((channel) => channel.playUrl)
    .map((channel) => ({ channel, score: matchScore(canonical, channel) }))
    .filter((match) => match.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.channel.name.localeCompare(right.channel.name),
    );

  return matches[0]?.channel ?? null;
};
