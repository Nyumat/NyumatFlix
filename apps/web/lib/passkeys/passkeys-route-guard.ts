import { getPasskeysEnabled } from "@/lib/passkeys/passkeys-enabled-server";
import { NextResponse } from "next/server";

export async function passkeysDisabledResponse(): Promise<NextResponse> {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function requirePasskeysEnabled(): Promise<NextResponse | null> {
  if (!(await getPasskeysEnabled())) {
    return await passkeysDisabledResponse();
  }
  return null;
}
