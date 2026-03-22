import { redirect } from "next/navigation";

export default async function MoviesUpcomingRedirect({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  next.set("view", "upcoming");
  if (sp.page) next.set("page", sp.page);
  redirect(`/movies?${next.toString()}`);
}
