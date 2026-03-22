import { redirect } from "next/navigation";

export default async function TvAiringTodayRedirect({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  next.set("view", "airing_today");
  next.set("mode", "results");
  if (sp.page) next.set("page", sp.page);
  redirect(`/tvshows?${next.toString()}`);
}
