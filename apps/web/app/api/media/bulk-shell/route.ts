import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import {
  BULK_MEDIA_SHELL_MAX_ITEMS,
  fetchBulkMediaShells,
  parseBulkMediaShellRequestItems,
} from "@/lib/server/bulk-media-shell";
import { NextResponse } from "next/server";

type BulkShellRequestBody = {
  items?: unknown;
};

export async function POST(request: Request) {
  const capDenied = await rejectUnlessCapAllowed(request);
  if (capDenied) return capDenied;

  let body: BulkShellRequestBody;

  try {
    body = (await request.json()) as BulkShellRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const items = parseBulkMediaShellRequestItems(body.items);
  if (!items) {
    return NextResponse.json(
      {
        error: `items must contain 1-${BULK_MEDIA_SHELL_MAX_ITEMS} valid { mediaType, contentId } entries`,
      },
      { status: 400 },
    );
  }

  const results = await fetchBulkMediaShells(items);

  return NextResponse.json(
    { items: results },
    { headers: catalogCacheHeaders() },
  );
}
