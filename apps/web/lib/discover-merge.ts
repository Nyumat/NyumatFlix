import { createYearFilterParams } from "@/lib/discover-year-range";

const STUDIO_COMPANY_IDS: Record<string, string> = {
  a24: "41077",
  disney: "2",
  pixar: "3",
  "warner-bros": "174",
  universal: "33",
  dreamworks: "521",
  "marvel-studios": "420",
};

export const getCatalogTypeDiscoverMergeParams = (
  sp: Record<string, string>,
): Record<string, string> => {
  const slug = sp.type?.trim() || sp.filter?.trim();
  if (!slug) return {};

  if (slug.startsWith("studio-")) {
    const key = slug.slice("studio-".length);
    const companyId = STUDIO_COMPANY_IDS[key];
    if (companyId) {
      return { with_companies: companyId };
    }
  }

  return {};
};

export const getCatalogYearDiscoverMergeParams = (
  sp: Record<string, string>,
  mediaType: "movie" | "tv",
): Record<string, string> => {
  const y = sp.year?.trim();
  if (!y) return {};

  const { params } = createYearFilterParams(y, mediaType);
  const dateField =
    mediaType === "tv" ? "first_air_date" : "primary_release_date";
  const gteKey = `${dateField}.gte`;
  const lteKey = `${dateField}.lte`;
  const out: Record<string, string> = {};
  const gte = params[gteKey];
  const lte = params[lteKey];
  if (gte) out[gteKey] = gte;
  if (lte) out[lteKey] = lte;
  if (params.without_genres) {
    out.without_genres = params.without_genres;
  }
  return out;
};

export const buildCatalogDiscoverUrlMerge = (
  sp: Record<string, string>,
  mediaType: "movie" | "tv",
): Record<string, string> => ({
  ...getCatalogTypeDiscoverMergeParams(sp),
  ...getCatalogYearDiscoverMergeParams(sp, mediaType),
});
