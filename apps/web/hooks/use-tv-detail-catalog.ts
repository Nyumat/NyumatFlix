"use client";

import {
  resolveTvDetailCatalogFromPathname,
  type TvDetailCatalog,
} from "@/lib/tv-detail-catalog";
import { usePathname } from "next/navigation";

export const useTvDetailCatalog = (): TvDetailCatalog => {
  const pathname = usePathname();
  return resolveTvDetailCatalogFromPathname(pathname);
};
