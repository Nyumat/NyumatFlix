import "server-only";

import { isAmbientGlowEnabled } from "@/lib/flags/ambient-glow-enabled";
import { getSiteFlags } from "@/lib/flags/site-flags-server";

export async function getAmbientGlowEnabled(): Promise<boolean> {
  const flags = await getSiteFlags();
  return isAmbientGlowEnabled(flags);
}
