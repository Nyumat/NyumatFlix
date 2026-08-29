import { getCapApiEndpoint, getCapWasmUrl } from "@/lib/cap/config";
import { NextResponse } from "next/server";

export function GET() {
  try {
    return NextResponse.json(
      { endpoint: getCapApiEndpoint(), wasmUrl: getCapWasmUrl() },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch {
    return NextResponse.json({ error: "Cap is unavailable" }, { status: 503 });
  }
}
