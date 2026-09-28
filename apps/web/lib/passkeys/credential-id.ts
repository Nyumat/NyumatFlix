export function normalizeCredentialId(credentialID: string): string {
  const trimmed = credentialID.trim();
  if (!trimmed) return trimmed;

  try {
    return Buffer.from(trimmed, "base64url").toString("base64");
  } catch {
    return trimmed;
  }
}
