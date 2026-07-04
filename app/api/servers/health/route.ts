import {
  checkVideoServerUrl,
  isAllowedVideoServerUrl,
} from "@/lib/server/video-server-health";
import { NextResponse } from "next/server";

type HealthRequestBody = {
  url?: unknown;
};

export async function POST(request: Request) {
  let body: HealthRequestBody;

  try {
    body = (await request.json()) as HealthRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.url !== "string" || !isAllowedVideoServerUrl(body.url)) {
    return NextResponse.json(
      { error: "URL is not an allowed video server URL" },
      { status: 400 },
    );
  }

  const result = await checkVideoServerUrl(body.url);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}
