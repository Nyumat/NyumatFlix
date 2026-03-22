import { normalizeRouteSearchParams } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function TvBrowseRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const next = new URLSearchParams();
  next.set("view", "discover");
  for (const [k, v] of Object.entries(sp)) {
    if (k === "view") continue;
    next.set(k, v);
  }
  redirect(`/tvshows?${next.toString()}`);
}
