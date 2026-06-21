import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "./page-loading-shell";

export function HeroPageLoading() {
  return (
    <PageLoadingShell>
      <div className="container space-y-6 px-4 py-14">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </PageLoadingShell>
  );
}
