import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "./page-loading-shell";

export function LivePageLoading() {
  return (
    <PageLoadingShell contentTopSpacing={false}>
      <section className="min-h-screen w-full pb-16 pt-[4.75rem] md:pt-20">
        <div className="site-container space-y-8 md:space-y-10" aria-hidden>
          <header>
            <Skeleton className="h-9 w-56 rounded-lg sm:h-10 md:h-12" />
          </header>

          <div className="overflow-hidden rounded-[8px] border border-border bg-card/40 shadow-2xl shadow-black/35 backdrop-blur-md">
            <Skeleton className="aspect-video w-full rounded-none" />
          </div>
        </div>
      </section>
    </PageLoadingShell>
  );
}
