import { redirect } from "next/navigation";

export default async function MoviesTopRatedRedirect({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  next.set("view", "top_rated");
  next.set("mode", "results");
  if (sp.page) next.set("page", sp.page);
  redirect(`/movies?${next.toString()}`);
}
