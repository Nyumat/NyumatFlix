import { lookupAaguidName } from "@/lib/passkeys/aaguid-inventory";

export type PasskeyPresentationInput = {
  nickname: string | null;
  aaguid: string | null;
  credentialBackedUp: boolean;
  fallbackIndex: number;
};

export type PasskeyPresentation = {
  title: string;
  subtitle: string;
  authenticatorName: string | null;
};

export function resolvePasskeyPresentation(
  passkey: PasskeyPresentationInput,
): PasskeyPresentation {
  const authenticatorName = lookupAaguidName(passkey.aaguid);
  const nickname = passkey.nickname?.trim() ?? "";
  const title =
    nickname || authenticatorName || `Passkey ${passkey.fallbackIndex + 1}`;

  const syncLabel = passkey.credentialBackedUp
    ? "Synced passkey"
    : "Device passkey";

  const subtitleParts = [syncLabel];
  if (nickname && authenticatorName && nickname !== authenticatorName) {
    subtitleParts.push(authenticatorName);
  } else if (!nickname && !authenticatorName) {
    subtitleParts.push("Unknown authenticator");
  }

  return {
    title,
    subtitle: subtitleParts.join(" · "),
    authenticatorName,
  };
}

export function normalizePasskeyNickname(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 80) {
    throw new Error("Passkey name must be 80 characters or fewer");
  }
  return trimmed;
}
