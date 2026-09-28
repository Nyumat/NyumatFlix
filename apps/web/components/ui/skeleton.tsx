import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-[length:200%_100%] bg-gradient-to-r from-white/[0.08] via-white/[0.18] to-white/[0.08] animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
