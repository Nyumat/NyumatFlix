import {
  ALLANIME_EPISODE_LANE,
  ALLANIME_FALLBACK_MASK_PARTS,
  buildAllanimeAaReq,
  buildAllanimeBootToken,
  deriveAllanimeMaskKey,
  invalidateAllanimeAaReqCache,
} from "../lib/scrape/anime/allanime-aareq.ts";

const WEEK_MS = 604_800_000;
const buildId = "140";
const maskKey = deriveAllanimeMaskKey(ALLANIME_FALLBACK_MASK_PARTS, buildId);
const epoch = Math.floor(Date.now() / WEEK_MS);
const token = buildAllanimeBootToken(
  maskKey,
  buildId,
  epoch,
  ALLANIME_EPISODE_LANE,
);
const url = `https://api.mkissa.net/client-crypto/v1/bootstrap?buildId=${encodeURIComponent(buildId)}&k=${encodeURIComponent(ALLANIME_EPISODE_LANE)}`;
const response = await fetch(url, {
  headers: {
    Accept: "application/json",
    "x-build-id": buildId,
    "x-aa-boot": token,
    Origin: "https://mkissa.to",
    Referer: "https://mkissa.to/",
  },
});
console.log("bootstrap", response.status, "epoch", epoch);
console.log((await response.text()).slice(0, 300));

invalidateAllanimeAaReqCache();
try {
  const req = await buildAllanimeAaReq();
  console.log("aaReq ok", req.buildId, req.lane, req.aaReq.slice(0, 48));
} catch (error) {
  console.log("aaReq fail", error instanceof Error ? error.message : error);
}
