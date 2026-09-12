import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type QueryPageHeaderProps = {
  title: string;
  description?: string;
  backHref?: string;
  action?: ReactNode;
  className?: string;
};

export const QueryPageHeader = ({
  title,
  description,
  backHref,
  action,
  className,
}: QueryPageHeaderProps) => (
  <header
    className={cn(
      "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
      className,
    )}
  >
    <div className="min-w-0 space-y-3">
      <div className="flex items-center gap-2">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back to index"
            className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
        ) : null}
        <h1 className="text-3xl font-black tracking-tight md:text-5xl lg:text-6xl">
          {title}
        </h1>
      </div>

      {description ? (
        <p className="max-w-xl text-muted-foreground">{description}</p>
      ) : null}
    </div>

    {action ? <div className="shrink-0">{action}</div> : null}
  </header>
);
