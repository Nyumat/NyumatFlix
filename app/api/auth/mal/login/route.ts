import { buildMalAuthUrl, getBaseUrl } from "@/lib/mal/oauth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const returnUrl = request.nextUrl.searchParams.get("callbackUrl") || "/";
    const baseUrl = getBaseUrl(request.url);
    const { url } = await buildMalAuthUrl(baseUrl, returnUrl);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("Error initiating MAL OAuth:", error);
    return NextResponse.redirect(
      new URL("/login/error?error=Configuration", request.url),
    );
  }
}
