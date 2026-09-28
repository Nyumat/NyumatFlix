import { PASSKEYS_FLAG_KEY } from "@/lib/flags/flag-catalog";
import type { SiteFlags } from "@/lib/flags/site-flags";

export function arePasskeysEnabled(flags: SiteFlags): boolean {
  return flags.passkeysEnabled;
}

export function arePasskeysEnabledFromRaw(
  raw: Record<string, boolean>,
): boolean {
  return raw[PASSKEYS_FLAG_KEY] ?? false;
}

export function isPasskeyAuthPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/account/passkeys") ||
    pathname === "/.well-known/passkey-endpoints" ||
    pathname === "/.well-known/webauthn" ||
    pathname.startsWith("/api/auth/webauthn-options/passkey") ||
    pathname.startsWith("/api/auth/callback/passkey")
  );
}
