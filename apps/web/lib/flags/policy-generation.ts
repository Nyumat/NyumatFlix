import type { SiteFlags } from "@/lib/flags/site-flags";
import { getPlaybackModePolicy } from "@/lib/flags/site-flags";

const POLICY_KEYS = [
  "proxyModeOnly",
  "iframeModeOnly",
  "staticHeroBackdrops",
  "noAdsModeDefault",
  "defaultProxyPlayback",
  "lockUserSettings",
] as const;

export const computePolicyGeneration = (
  flags: Omit<SiteFlags, "policyGeneration">,
): string => {
  const parts: string[] = [];
  for (const key of POLICY_KEYS) {
    parts.push(`${key}:${String(flags[key])}`);
  }
  parts.push(`embed:${getPlaybackModePolicy(flags as SiteFlags)}`);
  parts.push(`menu:${flags.providerMenuOrder.embed.join(",")}`);
  return parts.join("|");
};
