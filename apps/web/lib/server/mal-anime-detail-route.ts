import { buildAnilistTvDetailHref } from "@/lib/anilist-route-id";
import { fromMalAnimeRouteId, isMalAnimeRouteId } from "@/lib/mal/route-id";
import { resolveMalToAnilist, resolveMalToTmdb } from "@/lib/mal/id-resolver";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

const parsePositiveInt = (value: string | null) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function resolveMalAnimeDetailRedirects(
  routeId: string,
): Promise<void> {
  if (!isMalAnimeRouteId(routeId)) {
    return;
  }

  const malId = fromMalAnimeRouteId(routeId);
  if (!Number.isInteger(malId) || malId <= 0) {
    notFound();
  }

  const requestSearchParams = new URLSearchParams(
    (await headers()).get("x-search-params") ?? "",
  );
  const requestedSeason = parsePositiveInt(requestSearchParams.get("season"));
  const autoplay = requestSearchParams.get("autoplay") === "true";

  const mapping = await resolveMalToTmdb(malId);
  if (mapping?.mediaType === "movie") {
    const entryAnilistId =
      mapping.anilistId ?? (await resolveMalToAnilist(malId));
    const params = new URLSearchParams(requestSearchParams);
    if (entryAnilistId) {
      params.set("anilistId", String(entryAnilistId));
    }
    const query = params.toString();
    redirect(
      query
        ? `/movies/${mapping.tmdbId}?${query}`
        : `/movies/${mapping.tmdbId}`,
    );
  }

  const anilistId = mapping?.anilistId ?? (await resolveMalToAnilist(malId));
  if (!anilistId) {
    notFound();
  }

  const canonicalHref = buildAnilistTvDetailHref(anilistId, {
    season: requestedSeason ?? mapping?.season ?? undefined,
  });
  const [path, query = ""] = canonicalHref.split("?");
  const params = new URLSearchParams(query);
  if (autoplay) {
    params.set("autoplay", "true");
  }
  for (const [key, value] of requestSearchParams.entries()) {
    if (key !== "season" && key !== "autoplay" && !params.has(key)) {
      params.set(key, value);
    }
  }
  const mergedQuery = params.toString();
  redirect(mergedQuery ? `${path}?${mergedQuery}` : path);
}
