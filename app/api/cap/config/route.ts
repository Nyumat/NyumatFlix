import { getCapApiEndpoint } from "@/lib/cap/config";
import { NextResponse } from "next/server";

export function GET() {
  try {
    return NextResponse.json(
      { endpoint: getCapApiEndpoint() },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return NextResponse.json({ error: "Cap is unavailable" }, { status: 503 });
  }
}
