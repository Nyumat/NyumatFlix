import { auth } from "@/auth";
import { authenticators, db } from "@/db";
import { requirePasskeysEnabled } from "@/lib/passkeys/passkeys-route-guard";
import { normalizeCredentialId } from "@/lib/passkeys/credential-id";
import { normalizePasskeyNickname } from "@/lib/passkeys/passkey-presentation";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const renameBody = z.object({
  nickname: z.string().max(80),
});

type RouteContext = {
  params: Promise<{ credentialID: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
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

  const { credentialID: rawCredentialID } = await context.params;
  const credentialID = normalizeCredentialId(rawCredentialID);

  const body = renameBody.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "Invalid passkey name" },
      { status: 400 },
    );
  }

  let nickname: string | null;
  try {
    nickname = normalizePasskeyNickname(body.data.nickname);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid passkey name",
      },
      { status: 400 },
    );
  }

  const updated = await db
    .update(authenticators)
    .set({ nickname })
    .where(
      and(
        eq(authenticators.userId, session.user.id),
        eq(authenticators.credentialID, credentialID),
      ),
    )
    .returning({
      credentialID: authenticators.credentialID,
      nickname: authenticators.nickname,
    });

  if (!updated.length) {
    return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
  }

  return NextResponse.json({ nickname: updated[0].nickname });
}
