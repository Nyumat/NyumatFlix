import { redirect } from "next/navigation";

export default async function TvPopularRedirect({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  next.set("view", "popular");
  next.set("mode", "results");
  if (sp.page) next.set("page", sp.page);
  redirect(`/tvshows?${next.toString()}`);
}
