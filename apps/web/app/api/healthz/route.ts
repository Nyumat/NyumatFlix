import { connection } from "next/server";
import { NextResponse } from "next/server";

export async function GET() {
  await connection();

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
