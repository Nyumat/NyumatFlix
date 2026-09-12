import { redirect } from "next/navigation";

export default async function MoviesNowPlayingRedirect({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  next.set("view", "now_playing");
  next.set("mode", "results");
  if (sp.page) next.set("page", sp.page);
  redirect(`/movies?${next.toString()}`);
}
