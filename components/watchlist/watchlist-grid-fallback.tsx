import { Skeleton } from "@/components/ui/skeleton";

export function WatchlistGridFallback() {
  return (
    <div
      className="relative w-full max-w-7xl mx-auto min-h-[calc(100vh-7rem)] px-4 pt-10 pb-14 space-y-5"
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[70vh] bg-linear-to-b from-black/80 via-black/70 to-transparent" />

      <div className="rounded-2xl border border-white/10 bg-background/82 p-4 shadow-xl shadow-black/20 backdrop-blur-xl md:p-5">
        <div className="space-y-3">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-9 w-48 rounded-lg" />
          <Skeleton className="h-4 w-64 max-w-full rounded-md" />
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-card/28 p-3 shadow-lg shadow-black/10 backdrop-blur-md">
        <Skeleton className="h-9 rounded-full" />
        <div className="mt-3 flex gap-2 border-t border-white/8 pt-3">
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
      </div>

      <div className="space-y-4">
        {["watching", "waiting", "finished"].map((section) => (
          <div
            key={section}
            className="rounded-xl border border-white/10 bg-card/20 p-4 shadow-lg shadow-black/10"
          >
            <div className="mb-3 flex items-center gap-2 border-b border-white/8 pb-3">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-5 w-8 rounded-full" />
            </div>
            <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={index}
                  className="relative min-h-44 overflow-hidden rounded-2xl border border-white/12 bg-black/30 shadow-lg shadow-black/20"
                >
                  <Skeleton className="absolute inset-0 rounded-none opacity-60" />
                  <div className="relative flex min-h-44 flex-col justify-between p-4">
                    <div className="max-w-[70%] space-y-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2">
                      <Skeleton className="h-5 w-full rounded-md" />
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-14 rounded-full" />
                        <Skeleton className="h-4 w-10 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
