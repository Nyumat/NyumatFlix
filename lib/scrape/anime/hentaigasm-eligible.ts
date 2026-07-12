import { requiresAdultAniListContent } from "@/lib/anilist";

import type { AnilistMediaMeta } from "./anilist-meta";

export const HENTAIGASM_PROVIDER_ID = "hentaigasm" as const;
export const ADULT_ONLY_ANIME_PROVIDER_IDS = [
  "anipm",
  HENTAIGASM_PROVIDER_ID,
] as const;

export const shouldIncludeHentaigasmProvider = (
  meta: Pick<AnilistMediaMeta, "isAdult" | "genres">,
): boolean => meta.isAdult || requiresAdultAniListContent(meta.genres);

export const shouldIncludeHentaigasmForGenres = (
  isAdultAnime: boolean,
  genres: readonly string[],
): boolean => isAdultAnime || requiresAdultAniListContent([...genres]);
