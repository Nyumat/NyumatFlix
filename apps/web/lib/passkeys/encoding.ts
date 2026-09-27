export function toBase64Url(value: string | Uint8Array): string {
  const buffer =
    typeof value === "string"
      ? Buffer.from(value, "base64")
      : Buffer.from(value);
  return buffer.toString("base64url");
}

export function fromBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

export function credentialIdToBase64Url(credentialID: string): string {
  const trimmed = credentialID.trim();
  if (!trimmed) return trimmed;

  try {
    return Buffer.from(trimmed, "base64").toString("base64url");
  } catch {
    try {
      return Buffer.from(trimmed, "base64url").toString("base64url");
    } catch {
      return trimmed;
    }
  }
}
