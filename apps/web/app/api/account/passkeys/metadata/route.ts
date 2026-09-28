import { auth } from "@/auth";
import { authenticators, db } from "@/db";
import { requirePasskeysEnabled } from "@/lib/passkeys/passkeys-route-guard";
import { normalizeCredentialId } from "@/lib/passkeys/credential-id";
import { extractAaguidFromAttestation } from "@/lib/passkeys/parse-aaguid";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const metadataBody = z.object({
  credentialID: z.string().min(1).max(2048),
  attestationObject: z.string().min(1).max(65535),
});

export async function POST(request: Request) {
  const disabled = await requirePasskeysEnabled();
  if (disabled) return disabled;

  const origin = new URL(process.env.AUTH_URL ?? request.url).origin;
  if (request.headers.get("origin") !== origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = metadataBody.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid passkey metadata" },
      { status: 400 },
    );
  }

  const credentialID = normalizeCredentialId(body.data.credentialID);
  const aaguid = extractAaguidFromAttestation(body.data.attestationObject);
  if (!aaguid) {
    return NextResponse.json(
      { error: "Could not read authenticator" },
      { status: 400 },
    );
  }

  const updated = await db
    .update(authenticators)
    .set({ aaguid })
    .where(
      and(
        eq(authenticators.userId, session.user.id),
        eq(authenticators.credentialID, credentialID),
      ),
    )
    .returning({ credentialID: authenticators.credentialID });

  if (!updated.length) {
    return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
  }

  return NextResponse.json({ aaguid });
}
