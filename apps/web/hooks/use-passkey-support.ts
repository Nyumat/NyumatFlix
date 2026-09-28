"use client";

import { usePasskeyCapabilities } from "@/hooks/use-passkey-capabilities";
import { usePasskeysEnabled } from "@/hooks/use-passkeys-enabled";

export function usePasskeySupport(): boolean | null {
  const passkeysEnabled = usePasskeysEnabled();
  const capabilities = usePasskeyCapabilities();

  if (!passkeysEnabled) return false;
  if (!capabilities) return null;
  return capabilities.webauthn;
}
