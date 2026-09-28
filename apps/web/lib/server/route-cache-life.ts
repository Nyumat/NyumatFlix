import { cacheLife, cacheTag } from "next/cache";

/** OG images and other daily-cached assets (`revalidate = 86400`). */
export const applyHubDayCacheLife = () => {
  cacheLife("days");
};

/** Catalog hubs and detail routes (`revalidate = 3600`). */
export const applyCatalogHourCacheLife = () => {
  cacheLife("hours");
};

export const applyDataRevalidateCacheLife = (revalidateSeconds: number) => {
  cacheLife({ revalidate: revalidateSeconds });
};

export const applyDataCacheTags = (...tags: string[]) => {
  if (tags.length > 0) {
    cacheTag(...tags);
  }
};
