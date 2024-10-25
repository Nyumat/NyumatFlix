import { getMovies } from "@/app/actions";
import { MovieCategory } from "@/utils/typings";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get("query");
  const page = searchParams.get("page") ?? "1";
  const type = query as MovieCategory;
  const movies = await getMovies(type as MovieCategory, Number(page));
  return new Response(JSON.stringify(movies), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
