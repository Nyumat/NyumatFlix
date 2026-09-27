import { auth } from "@/auth";
import { buildPasskeySignalPayload } from "@/lib/passkeys/signal-payload";
import { requirePasskeysEnabled } from "@/lib/passkeys/passkeys-route-guard";
import { NextResponse } from "next/server";

export async function GET() {
  const disabled = await requirePasskeysEnabled();
  if (disabled) return disabled;

  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await buildPasskeySignalPayload(session.user.id);
  if (!payload) {
    return NextResponse.json(
      { signal: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { signal: payload },
    { headers: { "Cache-Control": "no-store" } },
  );
}
