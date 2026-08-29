import { Skeleton } from "@/components/ui/skeleton";
import { PageLoadingShell } from "./page-loading-shell";

export function SearchPageLoading() {
  return (
    <PageLoadingShell withPageContainer={false} contentTopSpacing={false}>
      <div className="flex w-full flex-col items-center pt-12">
        <div className="my-12 text-center" aria-hidden>
          <Skeleton className="mx-auto h-10 w-40 rounded-lg md:h-16 md:w-56" />
        </div>
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4" aria-hidden>
          <Skeleton className="mx-auto h-12 w-full max-w-2xl rounded-xl" />
          <div className="flex flex-wrap justify-center gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-20 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </PageLoadingShell>
  );
}
