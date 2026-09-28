import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "./page-loading-shell";

export function LivePageLoading() {
  return (
    <PageLoadingShell contentTopSpacing={false}>
      <section className="min-h-screen w-full pb-16 pt-[4.75rem] md:pt-20">
        <div className="index-container space-y-4 md:space-y-5" aria-hidden>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-36 rounded-lg md:h-10 md:w-44" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/30 shadow-xl shadow-black/20 backdrop-blur-md">
            <div className="border-b border-white/10 bg-black/30 px-4 py-3 md:px-5">
              <Skeleton className="h-4 w-36 rounded-md" />
            </div>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
              <Skeleton className="aspect-video rounded-none" />
              <div className="hidden border-l border-white/10 bg-black/30 p-4 lg:block">
                <Skeleton className="mb-2.5 h-9 w-full rounded-xl" />
                <div className="flex gap-1.5">
                  <Skeleton className="h-7 w-12 rounded-full" />
                  <Skeleton className="h-7 w-16 rounded-full" />
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
                <div className="mt-3 space-y-1.5">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLoadingShell>
  );
}
