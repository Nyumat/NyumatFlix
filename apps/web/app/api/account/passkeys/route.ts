import { auth } from "@/auth";
import { authenticators, db } from "@/db";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const passkeys = await db
    .select({
      credentialID: authenticators.credentialID,
      credentialDeviceType: authenticators.credentialDeviceType,
      credentialBackedUp: authenticators.credentialBackedUp,
    })
    .from(authenticators)
    .where(eq(authenticators.userId, session.user.id))
    .orderBy(authenticators.credentialID);
  return NextResponse.json(
    { passkeys },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  // AUTH_URL is the public origin when Next.js sits behind a reverse proxy.
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
        eq(authenticators.credentialID, body.data.credentialID),
      ),
    )
    .returning({ credentialID: authenticators.credentialID });
  if (!removed.length) {
    return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
  }
  // Email remains a backup; deleting the last key activates the enrollment gate.
  return new Response(null, { status: 204 });
}
