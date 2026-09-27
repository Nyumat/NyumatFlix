import { contentRowActionLinkClassName } from "@/lib/content-row-action-link";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

interface ContentRowHeaderProps {
  title: string;
  href?: string;
  bleed?: boolean;
  action?: ReactNode;
}

export function ContentRowHeader({
  title,
  href,
  bleed,
  action,
}: ContentRowHeaderProps) {
  const trailing =
    action ??
    (href ? (
      <Link href={href} className={contentRowActionLinkClassName}>
        View all
      </Link>
    ) : null);

  return (
    <div
      className={cn(
        "content-row-header mb-4 flex items-baseline justify-between gap-3",
        bleed ? "index-rail-padding" : "px-1 md:px-0",
      )}
    >
      <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <span className="h-[1.2em] w-1 shrink-0 bg-pink-500" aria-hidden />
        <h2 className="truncate text-xl font-semibold tracking-tight md:text-2xl">
          {title}
        </h2>
      </div>
      {trailing}
    </div>
  );
}
