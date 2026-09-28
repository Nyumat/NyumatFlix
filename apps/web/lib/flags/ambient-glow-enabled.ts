import { AMBIENT_GLOW_FLAG_KEY } from "@/lib/flags/flag-catalog";
import type { SiteFlags } from "@/lib/flags/site-flags";

export function isAmbientGlowEnabled(flags: SiteFlags): boolean {
  return flags.ambientGlowEnabled;
}

export function isAmbientGlowEnabledFromRaw(
  raw: Record<string, boolean>,
): boolean {
  return raw[AMBIENT_GLOW_FLAG_KEY] ?? false;
}
