import { cn } from "@/lib/utils";

type SearchAnimeMarkProps = {
  className?: string;
};

/** Compact anime marker for search rows — 映 (eiga / film). */
export function SearchAnimeMark({ className }: SearchAnimeMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold leading-none text-current",
        className,
      )}
    >
      映
    </span>
  );
}
