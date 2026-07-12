import { NextResponse } from "next/server";
import { z } from "zod";

import {
  authorizeScrapeVpnRotateRequest,
  getScrapeVpnStatus,
  rotateScrapeVpnEgress,
} from "@/lib/scrape/vpn-rotate";

export const dynamic = "force-dynamic";

const rotateBodySchema = z.object({
  countries: z.array(z.string().min(1)).optional(),
});

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET(request: Request) {
  if (!authorizeScrapeVpnRotateRequest(request)) {
    return unauthorized();
  }

  const status = await getScrapeVpnStatus();
  if (!status.ok) {
    return NextResponse.json(status, { status: 503 });
  }

  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!authorizeScrapeVpnRotateRequest(request)) {
    return unauthorized();
  }

  const parsed = rotateBodySchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const result = await rotateScrapeVpnEgress({
    countries: parsed.data.countries,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 503 });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
