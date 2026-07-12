import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  readAdminFlagState,
  writeAdminFlagState,
} from "@/lib/flags/flipt-admin";
import {
  applyPlaybackMutualExclusion,
  buildDefaultAdminFlagState,
  type AdminFlagState,
} from "@/lib/flags/flag-catalog";
import { assertFfsHost } from "@/lib/ffs/require-ffs-host";

export async function GET(request: NextRequest) {
  if (!assertFfsHost(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const flags = await readAdminFlagState();
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("[ffs] GET flags failed:", error);
    return NextResponse.json(
      { flags: buildDefaultAdminFlagState(), degraded: true },
      { status: 200 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  if (!assertFfsHost(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { flags?: AdminFlagState };
  try {
    body = (await request.json()) as { flags?: AdminFlagState };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.flags || typeof body.flags !== "object") {
    return NextResponse.json({ error: "Missing flags" }, { status: 400 });
  }

  const flags = applyPlaybackMutualExclusion(body.flags);

  try {
    await writeAdminFlagState(flags);
    return NextResponse.json({ flags, ok: true });
  } catch (error) {
    console.error("[ffs] PATCH flags failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 502 },
    );
  }
}
