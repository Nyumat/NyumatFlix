import { redirect } from "next/navigation";

export default async function TvTopRatedRedirect({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const next = new URLSearchParams();
  next.set("view", "top_rated");
  if (sp.page) next.set("page", sp.page);
  redirect(`/tvshows?${next.toString()}`);
}
