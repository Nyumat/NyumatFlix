import { authenticators, db, users } from "@/db";
import { credentialIdToBase64Url, toBase64Url } from "@/lib/passkeys/encoding";
import { resolveWebAuthnRpId } from "@/lib/passkeys/rp-config";
import { decodeWebAuthnUserHandle } from "@/lib/passkeys/webauthn-user-handle";
import { eq } from "drizzle-orm";

export type PasskeySignalGroup = {
  userId: string;
  allAcceptedCredentialIds: string[];
};

export type PasskeySignalPayload = {
  rpId: string;
  groups: PasskeySignalGroup[];
  userName: string;
  displayName: string;
};

export async function buildPasskeySignalPayload(
  userId: string,
): Promise<PasskeySignalPayload | null> {
  const [user] = await db
    .select({
      email: users.email,
      name: users.name,
      webauthnUserHandle: users.webauthnUserHandle,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.email) return null;

  const passkeys = await db
    .select({
      credentialID: authenticators.credentialID,
      webauthnUserId: authenticators.webauthnUserId,
    })
    .from(authenticators)
    .where(eq(authenticators.userId, userId));

  if (!passkeys.length) return null;

  const groups = new Map<string, string[]>();

  for (const passkey of passkeys) {
    const handle = passkey.webauthnUserId ?? user.webauthnUserHandle ?? null;
    if (!handle) continue;

    const userIdBase64Url = toBase64Url(handle);
    const credentialId = credentialIdToBase64Url(passkey.credentialID);
    const existing = groups.get(userIdBase64Url) ?? [];
    existing.push(credentialId);
    groups.set(userIdBase64Url, existing);
  }

  if (!groups.size && user.webauthnUserHandle) {
    const fallbackUserId = toBase64Url(
      decodeWebAuthnUserHandle(user.webauthnUserHandle),
    );
    groups.set(
      fallbackUserId,
      passkeys.map((passkey) => credentialIdToBase64Url(passkey.credentialID)),
    );
  }

  if (!groups.size) return null;

  return {
    rpId: resolveWebAuthnRpId(),
    groups: [...groups.entries()].map(([groupUserId, credentialIds]) => ({
      userId: groupUserId,
      allAcceptedCredentialIds: credentialIds,
    })),
    userName: user.email,
    displayName: user.name ?? user.email,
  };
}
