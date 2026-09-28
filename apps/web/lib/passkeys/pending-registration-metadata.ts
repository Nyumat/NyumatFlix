type PendingRegistrationMetadata = {
  aaguid: string | null;
  webauthnUserId: string;
  expiresAt: number;
};

const pendingByCredentialId = new Map<string, PendingRegistrationMetadata>();
const pendingByChallenge = new Map<string, PendingRegistrationMetadata>();
const TTL_MS = 5 * 60 * 1000;

function withExpiry(
  metadata: Omit<PendingRegistrationMetadata, "expiresAt">,
): PendingRegistrationMetadata {
  return {
    ...metadata,
    expiresAt: Date.now() + TTL_MS,
  };
}

export function stashRegistrationChallenge(
  challenge: string,
  metadata: Omit<PendingRegistrationMetadata, "expiresAt">,
): void {
  pendingByChallenge.set(challenge, withExpiry(metadata));
}

export function takeRegistrationMetadataForChallenge(
  challenge: string,
): PendingRegistrationMetadata | null {
  const pending = pendingByChallenge.get(challenge);
  if (!pending) return null;

  pendingByChallenge.delete(challenge);
  if (pending.expiresAt < Date.now()) return null;
  return pending;
}

export function stashRegistrationMetadata(
  credentialIdBase64: string,
  metadata: Omit<PendingRegistrationMetadata, "expiresAt">,
): void {
  pendingByCredentialId.set(credentialIdBase64, withExpiry(metadata));
}

export function takeRegistrationMetadata(
  credentialIdBase64: string,
): PendingRegistrationMetadata | null {
  const pending = pendingByCredentialId.get(credentialIdBase64);
  if (!pending) return null;

  pendingByCredentialId.delete(credentialIdBase64);
  if (pending.expiresAt < Date.now()) return null;
  return pending;
}
