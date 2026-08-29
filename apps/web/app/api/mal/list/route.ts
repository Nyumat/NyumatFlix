import { auth } from "@/auth";
import { malErrorResponse } from "@/lib/mal/error-response";
import { getMalListIndexForUser } from "@/lib/mal/list-index";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const index = await getMalListIndexForUser(session.user.id);
    return NextResponse.json(index);
  } catch (error) {
    return malErrorResponse(error, "Error fetching MAL list index:");
  }
}
