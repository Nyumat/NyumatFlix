import "server-only";

import { getSiteFlags } from "@/lib/flags/site-flags-server";
import { arePasskeysEnabled } from "@/lib/passkeys/passkeys-enabled";

export async function getPasskeysEnabled(): Promise<boolean> {
  const flags = await getSiteFlags();
  return arePasskeysEnabled(flags);
}
