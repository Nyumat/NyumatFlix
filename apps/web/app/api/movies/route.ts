import { rejectUnlessCapAllowed } from "@/lib/api/cap-route-guard";
import { catalogCacheHeaders } from "@/lib/http-cache";
import { NextRequest } from "next/server";
import { getMovies } from "@/lib/server/actions";
import { MovieCategory } from "@/lib/domain/typings";

export async function GET(req: NextRequest) {
  const capDenied = await rejectUnlessCapAllowed(req);
  if (capDenied) return capDenied;

  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get("query");
  const page = searchParams.get("page") ?? "1";
  const type = query as MovieCategory;
  const movies = await getMovies(type as MovieCategory, Number(page));
  return new Response(JSON.stringify(movies), {
    headers: {
      "Content-Type": "application/json",
      ...catalogCacheHeaders(),
    },
  });
}
