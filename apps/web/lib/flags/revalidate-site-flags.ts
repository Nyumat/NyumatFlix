import "server-only";

import { SITE_FLAGS_REVALIDATE_TAG } from "@/lib/flags/flags-sync";
import { revalidateTag } from "next/cache";

/** Bust Next.js cached `/api/site/flags` after FFS writes. */
export function revalidateSiteFlagsCache(): void {
  try {
    revalidateTag(SITE_FLAGS_REVALIDATE_TAG);
  } catch (error) {
    console.warn("[flags] revalidateTag failed:", error);
  }
}
