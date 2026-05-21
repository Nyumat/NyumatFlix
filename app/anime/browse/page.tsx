import { normalizeRouteSearchParams } from "@/lib/utils";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AnimeBrowseRedirect({ searchParams }: PageProps) {
  const raw = await searchParams;
  const sp = normalizeRouteSearchParams(raw);
  const next = new URLSearchParams(sp);
  next.set("mode", "results");

  redirect(`/anime?${next.toString()}`);
}
