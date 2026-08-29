import "server-only";

import { allowsCapProtectedAccess } from "@/lib/cap/access";
import { NextResponse } from "next/server";

export const rejectUnlessCapAllowed = async (
  request: Request,
): Promise<NextResponse | null> => {
  if (await allowsCapProtectedAccess(request)) {
    return null;
  }

  return NextResponse.json(
    { error: "Human verification required" },
    { status: 403, headers: { "X-Cap-Required": "1" } },
  );
};
