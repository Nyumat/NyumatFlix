import { getPasskeysEnabled } from "@/lib/passkeys/passkeys-enabled-server";
import { resolveWebAuthnRelatedOrigins } from "@/lib/passkeys/rp-config";
import { NextResponse } from "next/server";

export async function GET() {
  if (!(await getPasskeysEnabled())) {
    return NextResponse.json({}, { status: 404 });
  }

  return NextResponse.json(
    {
      origins: resolveWebAuthnRelatedOrigins(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
