import { redirect } from "next/navigation";

export default async function MoviesPopularRedirect({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  next.set("view", "popular");
  if (sp.page) next.set("page", sp.page);
  redirect(`/movies?${next.toString()}`);
}
