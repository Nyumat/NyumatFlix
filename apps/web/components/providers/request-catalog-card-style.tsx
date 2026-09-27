import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { CatalogCardStyleProvider } from "@/lib/catalog-card-presentation";
import {
  CATALOG_CARD_STYLE_COOKIE,
  resolveCatalogCardStyleSnapshot,
} from "@/lib/user/catalog-card-style-store";
import type { CatalogCardStyle } from "@/lib/user/user-settings-types";

export async function RequestCatalogCardStyle({
  fallback,
  children,
}: {
  fallback: CatalogCardStyle;
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const style = resolveCatalogCardStyleSnapshot(
    cookieStore.get(CATALOG_CARD_STYLE_COOKIE)?.value,
    fallback,
  );

  return (
    <CatalogCardStyleProvider initialStyle={style}>
      {children}
    </CatalogCardStyleProvider>
  );
}
