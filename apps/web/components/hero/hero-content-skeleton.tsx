import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type HeroContentSkeletonVariant = "index" | "detail" | "spotlight";

type HeroContentSkeletonProps = {
  variant?: HeroContentSkeletonVariant;
  className?: string;
  align?: "left" | "center" | "index-hub";
};

const variantClasses: Record<
  HeroContentSkeletonVariant,
  { logo: string; action: string }
> = {
  index: {
    logo: "h-16 w-56 max-w-[70vw] rounded-md sm:h-20 sm:w-72 lg:h-28 lg:w-88",
    action: "h-11 w-56 max-w-full rounded-full sm:w-64",
  },
  detail: {
    logo: "h-14 w-48 rounded-md sm:h-16 sm:w-56",
    action: "h-10 w-44 rounded-full sm:w-52",
  },
  spotlight: {
    logo: "h-10 w-[min(70%,20rem)] rounded-lg md:h-12",
    action: "h-10 w-44 rounded-full sm:w-52",
  },
};

export function HeroContentSkeleton({
  variant = "detail",
  className,
  align = "left",
}: HeroContentSkeletonProps) {
  const styles = variantClasses[variant];

  return (
    <div
      className={cn(
        "space-y-4",
        align === "center" && "flex flex-col items-center",
        align === "index-hub" &&
          "mx-auto flex w-full max-w-2xl flex-col items-center lg:mx-0 lg:items-start",
        className,
      )}
      aria-hidden
    >
      <Skeleton className={styles.logo} />
      <Skeleton className={styles.action} />
    </div>
  );
}
