import { authenticators, db } from "@/db";
import { takeRegistrationMetadata } from "@/lib/passkeys/pending-registration-metadata";
import { normalizeCredentialId } from "@/lib/passkeys/credential-id";
import { and, eq } from "drizzle-orm";

export async function applyPendingPasskeyMetadata(
  providerAccountId: string,
  userId: string,
): Promise<void> {
  const credentialID = normalizeCredentialId(providerAccountId);
  const metadata = takeRegistrationMetadata(credentialID);
  if (!metadata) return;

  const updates: {
    aaguid?: string;
    webauthnUserId?: string;
  } = {};

  if (metadata.aaguid) {
    updates.aaguid = metadata.aaguid;
  }
  if (metadata.webauthnUserId) {
    updates.webauthnUserId = metadata.webauthnUserId;
  }

  if (!Object.keys(updates).length) return;

  await db
    .update(authenticators)
    .set(updates)
    .where(
      and(
        eq(authenticators.userId, userId),
        eq(authenticators.credentialID, credentialID),
      ),
    );
}
