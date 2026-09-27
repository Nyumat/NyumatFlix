import { getPasskeysEnabled } from "@/lib/passkeys/passkeys-enabled-server";
import { resolvePasskeyEndpointUrls } from "@/lib/passkeys/rp-config";
import { NextResponse } from "next/server";

export async function GET() {
  if (!(await getPasskeysEnabled())) {
    return NextResponse.json({}, { status: 404 });
  }

  const endpoints = resolvePasskeyEndpointUrls();

  return NextResponse.json(
    {
      enroll: endpoints.enroll,
      manage: endpoints.manage,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
