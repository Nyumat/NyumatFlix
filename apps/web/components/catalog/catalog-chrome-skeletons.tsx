import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const DiscoverToolbarSkeleton = () => (
  <div
    className="flex flex-wrap items-center justify-between gap-2"
    aria-hidden
  >
    <Skeleton className="h-10 w-32 rounded-md" />
    <Skeleton className="h-10 w-28 rounded-md" />
  </div>
);

export const AniListToolbarSkeleton = () => (
  <Skeleton className="h-10 w-32 rounded-md" aria-hidden />
);

type QueryPageHeaderSkeletonProps = {
  showBack?: boolean;
  showDescription?: boolean;
  className?: string;
};

export const QueryPageHeaderSkeleton = ({
  showBack = false,
  showDescription = true,
  className,
}: QueryPageHeaderSkeletonProps) => (
  <header className={cn("space-y-1 text-left", className)} aria-hidden>
    <div className="flex items-center gap-3">
      {showBack ? (
        <Skeleton className="size-11 shrink-0 rounded-full md:size-9" />
      ) : null}
      <Skeleton className="h-9 w-48 max-w-[70%] rounded-lg sm:h-10 md:h-12" />
    </div>
    {showDescription ? (
      <Skeleton className="h-5 w-full max-w-md rounded-md" />
    ) : null}
  </header>
);

type CatalogPageShellHeaderSkeletonProps = {
  showAction?: boolean;
  toolbar?: "discover" | "anilist";
};

export const CatalogPageShellHeaderSkeleton = ({
  showAction = false,
}: Pick<CatalogPageShellHeaderSkeletonProps, "showAction">) => (
  <header className="space-y-2 text-center md:text-left" aria-hidden>
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <Skeleton className="mx-auto h-9 w-40 rounded-lg sm:h-10 md:mx-0 md:h-12" />
      {showAction ? (
        <Skeleton className="mx-auto h-10 w-28 rounded-md md:mx-0" />
      ) : null}
    </div>
  </header>
);

export const CatalogHubChromeSkeleton = () => (
  <>
    <QueryPageHeaderSkeleton showDescription={false} />
    <DiscoverToolbarSkeleton />
  </>
);

export const CatalogPageShellChromeSkeleton = ({
  showAction = false,
  toolbar = "discover",
}: CatalogPageShellHeaderSkeletonProps) => (
  <>
    <CatalogPageShellHeaderSkeleton showAction={showAction} />
    {toolbar === "anilist" ? (
      <div
        className="flex flex-wrap items-center justify-between gap-2"
        aria-hidden
      >
        <AniListToolbarSkeleton />
      </div>
    ) : (
      <DiscoverToolbarSkeleton />
    )}
  </>
);

export const CatalogListHeaderSkeleton = ({
  centered = false,
}: {
  centered?: boolean;
}) => (
  <div
    className={cn(
      "flex flex-col gap-4",
      centered ? "text-center" : "text-left",
    )}
    aria-hidden
  >
    <Skeleton
      className={cn(
        "h-9 w-56 rounded-lg sm:h-10 md:h-12",
        centered ? "mx-auto" : undefined,
      )}
    />
    <Skeleton
      className={cn(
        "h-5 w-full max-w-md rounded-md",
        centered ? "mx-auto" : undefined,
      )}
    />
  </div>
);
