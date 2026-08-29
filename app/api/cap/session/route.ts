import {
  CAP_SESSION_COOKIE,
  CAP_SESSION_TTL_SECONDS,
  createCapSessionToken,
  requestHasCapSession,
  verifyCapToken,
} from "@/lib/cap/server";
import { NextResponse } from "next/server";

export function GET(request: Request) {
  if (!requestHasCapSession(request)) {
    return NextResponse.json({ verified: false }, { status: 401 });
  }
  return NextResponse.json({ verified: true });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: unknown;
  } | null;
  if (!(await verifyCapToken(body?.token))) {
    return NextResponse.json(
      { error: "Human verification failed" },
      { status: 400 },
    );
  }

  const response = NextResponse.json({ verified: true });
  response.cookies.set(CAP_SESSION_COOKIE, createCapSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CAP_SESSION_TTL_SECONDS,
  });
  return response;
}
