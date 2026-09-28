import { auth } from "@/auth";
import { authenticators, db } from "@/db";
import { requirePasskeysEnabled } from "@/lib/passkeys/passkeys-route-guard";
import { lookupAaguidName } from "@/lib/passkeys/aaguid-inventory";
import { normalizeCredentialId } from "@/lib/passkeys/credential-id";
import { resolvePasskeyPresentation } from "@/lib/passkeys/passkey-presentation";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const disabled = await requirePasskeysEnabled();
  if (disabled) return disabled;

  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const passkeys = await db
    .select({
      credentialID: authenticators.credentialID,
      credentialDeviceType: authenticators.credentialDeviceType,
      credentialBackedUp: authenticators.credentialBackedUp,
      aaguid: authenticators.aaguid,
      nickname: authenticators.nickname,
    })
    .from(authenticators)
    .where(eq(authenticators.userId, session.user.id))
    .orderBy(authenticators.credentialID);

  return NextResponse.json(
    {
      passkeys: passkeys.map((passkey, index) => {
        const presentation = resolvePasskeyPresentation({
          nickname: passkey.nickname,
          aaguid: passkey.aaguid,
          credentialBackedUp: passkey.credentialBackedUp,
          fallbackIndex: index,
        });

        return {
          credentialID: passkey.credentialID,
          credentialDeviceType: passkey.credentialDeviceType,
          credentialBackedUp: passkey.credentialBackedUp,
          aaguid: passkey.aaguid,
          nickname: passkey.nickname,
          authenticatorName: lookupAaguidName(passkey.aaguid),
          title: presentation.title,
          subtitle: presentation.subtitle,
        };
      }),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
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
  if (!session.user.email || session.user.requiresPasskey) {
    return NextResponse.json(
      { error: "Add a passkey before managing passkeys." },
      { status: 403 },
    );
  }
  const body = z
    .object({ credentialID: z.string().min(1).max(2048) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid passkey" }, { status: 400 });
  }
  const removed = await db
    .delete(authenticators)
    .where(
      and(
        eq(authenticators.userId, session.user.id),
        eq(
          authenticators.credentialID,
          normalizeCredentialId(body.data.credentialID),
        ),
      ),
    )
    .returning({ credentialID: authenticators.credentialID });
  if (!removed.length) {
    return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
