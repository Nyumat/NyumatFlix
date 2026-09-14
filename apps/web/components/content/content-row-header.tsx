import { contentRowActionLinkClassName } from "@/lib/content-row-action-link";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ContentRowHeaderProps {
  title: string;
  href: string;
  bleed?: boolean;
}

export function ContentRowHeader({
  title,
  href,
  bleed,
}: ContentRowHeaderProps) {
  return (
    <div
      className={cn(
        "content-row-header mb-4 flex items-baseline justify-between gap-3",
        bleed ? "index-rail-padding" : "px-1 md:px-0",
      )}
    >
      <h2 className="truncate text-lg font-semibold tracking-tight md:text-xl">
        {title}
      </h2>
      <Link href={href} className={contentRowActionLinkClassName}>
        View all
      </Link>
    </div>
  );
}
